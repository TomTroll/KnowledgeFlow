// packages/obsidian-plugin/src/routing-pipeline.ts
// Orchestrates the 4-call clip routing pipeline.
//
// Pipeline steps:
//   1. Embed the clip text (1 API call)
//   2. Local cosine search for top-5 candidates (0 API calls)
//   3. Optional Flash LLM validation (1 API call if enabled)
//   4. Section batch embedding (1 API call)
//   5. Paragraph batch embedding (1 API call)
//   6. Insert callout via vault.process()
//   7. Append to ClipLog

import type { Vault, TFile } from 'obsidian';
import type {
  ClipRequest,
  ClipResponse,
  PluginSettings,
} from '@knowledgeflow/shared';
import { VectorStore } from './vector-store';
import { ClipLog } from './clip-log';
import { formatCallout } from './callout-formatter';
import {
  stripFrontmatter,
  splitSections,
  splitParagraphs,
  insertCalloutAfterParagraph,
} from './markdown-parser';
import type { FlashCandidate, FlashValidationResult } from './gemini-flash';
import { dotProduct } from './math-utils';

// ---------------------------------------------------------------------------
// Dependency interface (injected by Plugin, stubbed in tests)
// ---------------------------------------------------------------------------

export interface RoutingDeps {
  embedder: (texts: string[]) => Promise<number[][]>;
  flashValidator: (
    clipText: string,
    candidates: FlashCandidate[],
    apiKey: string,
    userComment?: string,
  ) => Promise<FlashValidationResult>;
  vectorStore: VectorStore;
  clipLog: ClipLog;
  vault: Vault;
  getSettings: () => PluginSettings;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class RoutingPipeline {
  private deps: RoutingDeps;

  constructor(deps: RoutingDeps) {
    this.deps = deps;
  }

  async process(req: ClipRequest, optionalClipId?: string): Promise<ClipResponse> {
    const clipId = optionalClipId || crypto.randomUUID();

    // ------------------------------------------------------------------
    // Step 1: Embed the clip text (API call #1)
    // ------------------------------------------------------------------
    const textToEmbed = req.comment
      ? `User Comment (Priority for routing): ${req.comment}\n\nClip Context:\n${req.selectedText}`
      : req.selectedText;
    const [clipEmbedding] = await this.deps.embedder([textToEmbed]);

    // ------------------------------------------------------------------
    // Step 2 & 3: Local cosine search and LLM validation
    // ------------------------------------------------------------------
    const matchResult = await this.matchTargetNote(req, clipEmbedding, clipId);

    // Early return if a new note was auto-created (it already has the callout)
    if (matchResult.isNewNote) {
      this.appendToLog(req, clipId, matchResult.chosenPath, matchResult.justification);
      return {
        success: true,
        clipId,
        matchedPath: matchResult.chosenPath,
        justification: matchResult.justification,
        suggestedTitle: matchResult.suggestedTitle,
      };
    }

    // ------------------------------------------------------------------
    // Step 4 & 5: Find best section and paragraph (Cached API calls)
    // ------------------------------------------------------------------
    const { bestSectionIdx, bestParaIdx, file } = await this.findBestInsertionPoint(
      clipEmbedding,
      matchResult.chosenPath,
    );

    // ------------------------------------------------------------------
    // Step 6: Insert callout via vault.process()
    // ------------------------------------------------------------------
    await this.executeInsertion(file, clipId, req, bestSectionIdx, bestParaIdx);

    // ------------------------------------------------------------------
    // Step 7: Append to ClipLog
    // ------------------------------------------------------------------
    this.appendToLog(req, clipId, matchResult.chosenPath, matchResult.justification);

    return {
      success: true,
      clipId,
      matchedPath: matchResult.chosenPath,
      justification: matchResult.justification,
    };
  }

  // ---------------------------------------------------------------------------
  // Core Steps
  // ---------------------------------------------------------------------------

  private async matchTargetNote(req: ClipRequest, clipEmbedding: number[], clipId: string) {
    const settings = this.deps.getSettings();
    const topK = this.deps.vectorStore.findTopK(clipEmbedding, 5);
    const topScore = topK.length > 0 ? topK[0].similarity : 0;

    let chosenPath: string;
    let justification: string | null = null;
    let suggestedTitle: string | undefined;
    let isNewNote = false;

    if (topScore < settings.threshold) {
      isNewNote = true;
      if (settings.llmValidationEnabled && topK.length > 0) {
        const candidates = await this.buildCandidates(topK);
        const flashResult = await this.deps.flashValidator(
          req.selectedText,
          candidates,
          settings.geminiKey,
          req.comment,
        );
        justification = flashResult.justification;
        suggestedTitle = flashResult.suggestedTitle;
      }

      const title = suggestedTitle || `${req.pageTitle} — ${new Date().toISOString().slice(0, 10)}`;
      const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
      chosenPath = `${safeName}.md`;
      const callout = formatCallout(req, clipId);
      const newContent = `#kf-inbox\n\n${callout}\n`;

      await this.deps.vault.create(chosenPath, newContent);
      return { chosenPath, justification, suggestedTitle, isNewNote };
    }

    if (settings.llmValidationEnabled) {
      const candidates = await this.buildCandidates(topK);
      const flashResult = await this.deps.flashValidator(
        req.selectedText,
        candidates,
        settings.geminiKey,
        req.comment,
      );
      chosenPath = flashResult.chosenPath || topK[0].vaultPath;
      justification = flashResult.justification;
    } else {
      chosenPath = topK[0].vaultPath;
    }

    return { chosenPath, justification, suggestedTitle, isNewNote };
  }

  private async findBestInsertionPoint(clipEmbedding: number[], chosenPath: string) {
    const file = this.deps.vault.getAbstractFileByPath(chosenPath) as TFile;
    const noteContent = await this.deps.vault.read(file);
    const mtime = file.stat.mtime;

    const strippedContent = stripFrontmatter(noteContent);
    const sections = splitSections(strippedContent);

    // Default fallback: append to the very end of the note
    let bestSectionIdx = Math.max(0, sections.length - 1);
    let bestParaIdx = Math.max(0, splitParagraphs(sections[bestSectionIdx]?.body || '').length - 1);

    try {
      // Fetch or generate section embeddings
      let sectionEmbeddings = this.deps.vectorStore.getSectionEmbeddings(chosenPath, mtime);
      if (!sectionEmbeddings) {
        const sectionTexts = sections.map((s) =>
          s.heading ? `${s.heading}\n${s.body.slice(0, 500)}` : s.body.slice(0, 500),
        );
        sectionEmbeddings = await this.deps.embedder(sectionTexts);
        this.deps.vectorStore.saveSectionEmbeddings(chosenPath, mtime, sectionEmbeddings);
      }

      let bestSectionScore = -1;
      for (let i = 0; i < sectionEmbeddings.length; i++) {
        const score = dotProduct(clipEmbedding, sectionEmbeddings[i]);
        if (score > bestSectionScore) {
          bestSectionScore = score;
          bestSectionIdx = i;
        }
      }

      const paragraphs = splitParagraphs(sections[bestSectionIdx].body);
      bestParaIdx = 0;

      if (paragraphs.length > 1) {
        // Fetch or generate paragraph embeddings for this specific section
        let paraEmbeddings = this.deps.vectorStore.getParagraphEmbeddings(chosenPath, mtime, bestSectionIdx);
        if (!paraEmbeddings) {
          paraEmbeddings = await this.deps.embedder(paragraphs);
          this.deps.vectorStore.saveParagraphEmbeddings(chosenPath, mtime, bestSectionIdx, paraEmbeddings);
        }

        let bestParaScore = -1;
        for (let i = 0; i < paraEmbeddings.length; i++) {
          const score = dotProduct(clipEmbedding, paraEmbeddings[i]);
          if (score > bestParaScore) {
            bestParaScore = score;
            bestParaIdx = i;
          }
        }
      }
    } catch (err) {
      console.warn('[KnowledgeFlow] Fine-grained chunk matching failed, gracefully falling back to end of note.', err);
    }

    return { bestSectionIdx, bestParaIdx, file };
  }

  private async executeInsertion(
    file: TFile,
    clipId: string,
    req: ClipRequest,
    bestSectionIdx: number,
    bestParaIdx: number
  ) {
    const callout = formatCallout(req, clipId);
    await this.deps.vault.process(file, (content: string) => {
      return insertCalloutAfterParagraph(content, bestSectionIdx, bestParaIdx, callout);
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async buildCandidates(
    topK: { vaultPath: string; title: string }[],
  ): Promise<FlashCandidate[]> {
    return Promise.all(
      topK.map(async (entry) => {
        let excerpt = '';
        try {
          const file = this.deps.vault.getAbstractFileByPath(entry.vaultPath) as TFile;
          if (file) {
            const content = await this.deps.vault.read(file);
            if (content) {
              const stripped = stripFrontmatter(content);
              excerpt = stripped.split(/\s+/).slice(0, 50).join(' ');
            }
          }
        } catch {
          // If file read fails, use empty excerpt
        }
        return {
          path: entry.vaultPath,
          title: entry.title,
          excerpt,
        };
      }),
    );
  }

  private appendToLog(
    req: ClipRequest,
    clipId: string,
    matchedPath: string,
    justification: string | null,
  ): void {
    this.deps.clipLog.append({
      id: clipId,
      sourceUrl: req.sourceUrl,
      pageTitle: req.pageTitle,
      selectedText: req.selectedText,
      timestamp: new Date().toISOString(),
      matchedPath,
      justification,
      tags: req.tags,
      comment: req.comment,
      status: 'inserted',
    });
  }
}
