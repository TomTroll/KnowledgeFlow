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
    const settings = this.deps.getSettings();
    const clipId = optionalClipId || crypto.randomUUID();

    // ------------------------------------------------------------------
    // Step 1: Embed the clip text (API call #1)
    // ------------------------------------------------------------------
    const [clipEmbedding] = await this.deps.embedder([req.selectedText]);

    // ------------------------------------------------------------------
    // Step 2: Local cosine search — top 5 candidates (no API call)
    // ------------------------------------------------------------------
    const topK = this.deps.vectorStore.findTopK(clipEmbedding, 5);
    const topScore = topK.length > 0 ? topK[0].similarity : 0;

    // ------------------------------------------------------------------
    // Step 3: LLM validation or direct cosine winner
    // ------------------------------------------------------------------
    let chosenPath: string;
    let justification: string | null;
    let suggestedTitle: string | undefined;

    if (topScore < settings.threshold) {
      // Below threshold — create a new note
      if (settings.llmValidationEnabled && topK.length > 0) {
        const candidates = await this.buildCandidates(topK);
        const flashResult = await this.deps.flashValidator(
          req.selectedText,
          candidates,
          settings.geminiKey,
        );
        justification = flashResult.justification;
        suggestedTitle = flashResult.suggestedTitle;
      } else {
        justification = null;
      }

      // Create new note in vault root
      const title = suggestedTitle || `${req.pageTitle} — ${new Date().toISOString().slice(0, 10)}`;
      const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
      const newPath = `${safeName}.md`;
      const callout = formatCallout(req, clipId);
      const newContent = `#kf-inbox\n\n${callout}\n`;

      await this.deps.vault.create(newPath, newContent);

      this.appendToLog(req, clipId, newPath, justification);

      return {
        success: true,
        clipId,
        matchedPath: newPath,
        justification,
        suggestedTitle: title,
      };
    }

    // Above threshold — route to existing note
    if (settings.llmValidationEnabled) {
      const candidates = await this.buildCandidates(topK);
      const flashResult = await this.deps.flashValidator(
        req.selectedText,
        candidates,
        settings.geminiKey,
      );
      chosenPath = flashResult.chosenPath || topK[0].vaultPath;
      justification = flashResult.justification;
    } else {
      chosenPath = topK[0].vaultPath;
      justification = null;
    }

    // ------------------------------------------------------------------
    // Step 4: Section batch embedding (API call #3)
    // ------------------------------------------------------------------
    const file = this.deps.vault.getAbstractFileByPath(chosenPath) as TFile;
    const noteContent = await this.deps.vault.read(file);
    const strippedContent = stripFrontmatter(noteContent);
    const sections = splitSections(strippedContent);

    const sectionTexts = sections.map(s =>
      s.heading ? `${s.heading}\n${s.body.slice(0, 500)}` : s.body.slice(0, 500),
    );
    const sectionEmbeddings = await this.deps.embedder(sectionTexts);

    // Find best matching section
    let bestSectionIdx = 0;
    let bestSectionScore = -1;
    for (let i = 0; i < sectionEmbeddings.length; i++) {
      const score = dotProduct(clipEmbedding, sectionEmbeddings[i]);
      if (score > bestSectionScore) {
        bestSectionScore = score;
        bestSectionIdx = i;
      }
    }

    // ------------------------------------------------------------------
    // Step 5: Paragraph batch embedding (API call #4)
    // ------------------------------------------------------------------
    const paragraphs = splitParagraphs(sections[bestSectionIdx].body);

    let bestParaIdx = 0;
    if (paragraphs.length > 1) {
      const paraEmbeddings = await this.deps.embedder(paragraphs);

      let bestParaScore = -1;
      for (let i = 0; i < paraEmbeddings.length; i++) {
        const score = dotProduct(clipEmbedding, paraEmbeddings[i]);
        if (score > bestParaScore) {
          bestParaScore = score;
          bestParaIdx = i;
        }
      }
    }

    // ------------------------------------------------------------------
    // Step 6: Insert callout via vault.process()
    // ------------------------------------------------------------------
    const callout = formatCallout(req, clipId);

    await this.deps.vault.process(file, (content: string) => {
      return insertCalloutAfterParagraph(content, bestSectionIdx, bestParaIdx, callout);
    });

    // ------------------------------------------------------------------
    // Step 7: Append to ClipLog
    // ------------------------------------------------------------------
    this.appendToLog(req, clipId, chosenPath, justification);

    return {
      success: true,
      clipId,
      matchedPath: chosenPath,
      justification,
    };
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
