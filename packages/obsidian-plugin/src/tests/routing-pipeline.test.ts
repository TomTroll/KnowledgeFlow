// packages/obsidian-plugin/src/tests/routing-pipeline.test.ts
// TDD tests for the full routing pipeline.
// Written BEFORE implementation (RED phase).
//
// Strategy: All Gemini API calls and vault operations are injected as stubs.
// We test the pipeline's orchestration logic, not the actual APIs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutingPipeline, type RoutingDeps } from '../routing-pipeline';
import { VectorStore } from '../vector-store';
import { ClipLog } from '../clip-log';
import { DEFAULT_PLUGIN_SETTINGS } from '@knowledgeflow/shared';
import type { ClipRequest } from '@knowledgeflow/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIP_REQUEST: ClipRequest = {
  selectedText: 'Neural networks learn hierarchical representations of data.',
  sourceUrl: 'https://example.com/ml-article',
  pageTitle: 'Deep Learning Basics',
  tags: ['ml', 'research'],
  comment: 'Key insight about representation learning',
};

/** Build a note body with N paragraphs (for batch-call-count tests). */
function makeNote(numParagraphs: number, heading = 'Test Section'): string {
  const paras: string[] = [];
  for (let i = 0; i < numParagraphs; i++) {
    paras.push(`Paragraph ${i}: This is content for paragraph number ${i}.`);
  }
  return `## ${heading}\n\n${paras.join('\n\n')}`;
}

/** Create a fully stubbed RoutingDeps object. */
function makeDeps(overrides: Partial<RoutingDeps> = {}): RoutingDeps {
  const vectorStore = new VectorStore();
  const clipLog = new ClipLog();

  // Pre-populate vector store with 10 notes
  for (let i = 0; i < 10; i++) {
    vectorStore.upsert({
      vaultPath: `Notes/Note${i}.md`,
      title: `Note${i}`,
      embedding: new Array(768).fill(i === 0 ? 0.9 : 0.1), // Note0 is the "best match"
      updatedAt: Date.now(),
    });
  }

  // Mock embedder: returns a fixed embedding for any text
  const embedder = vi.fn().mockImplementation(async (texts: string[]) => {
    return texts.map(() => new Array(768).fill(0.9));
  });

  // Mock Flash validator
  const flashValidator = vi.fn().mockResolvedValue({
    chosenPath: 'Notes/Note0.md',
    justification: 'Best semantic match for ML content',
  });

  // Mock vault
  const vault = {
    read: vi.fn().mockResolvedValue(makeNote(5)),
    process: vi.fn().mockImplementation(async (_file: any, fn: (content: string) => string) => {
      return fn(makeNote(5));
    }),
    getAbstractFileByPath: vi.fn().mockReturnValue({ path: 'Notes/Note0.md', stat: { mtime: Date.now() } }),
    create: vi.fn().mockResolvedValue({ path: 'New Note.md', stat: { mtime: Date.now() } }),
  } as any;

  return {
    embedder,
    flashValidator,
    vectorStore,
    clipLog,
    vault,
    getSettings: () => ({ ...DEFAULT_PLUGIN_SETTINGS }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RoutingPipeline', () => {
  it('returns 200 OK shape with matchedPath and justification', async () => {
    const deps = makeDeps();
    const pipeline = new RoutingPipeline(deps);

    const result = await pipeline.process(CLIP_REQUEST);

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('matchedPath');
    expect(result).toHaveProperty('justification');
    expect(result).toHaveProperty('clipId');
    expect(typeof result.clipId).toBe('string');
    expect(result.clipId.length).toBeGreaterThan(0);
  });

  it('makes exactly 4 embedder/flash calls when llmValidationEnabled is true', async () => {
    const deps = makeDeps();
    const pipeline = new RoutingPipeline(deps);

    await pipeline.process(CLIP_REQUEST);

    // Call 1: clip embedding
    // Call 2: Flash validation (flashValidator)
    // Call 3: section batch embedding
    // Call 4: paragraph batch embedding
    expect(deps.embedder).toHaveBeenCalledTimes(3); // calls 1, 3, 4
    expect(deps.flashValidator).toHaveBeenCalledTimes(1); // call 2
  });

  it('makes exactly 3 embedder calls when llmValidationEnabled is false', async () => {
    const deps = makeDeps({
      getSettings: () => ({ ...DEFAULT_PLUGIN_SETTINGS, llmValidationEnabled: false }),
    });
    const pipeline = new RoutingPipeline(deps);

    await pipeline.process(CLIP_REQUEST);

    // Call 1: clip embedding
    // Call 2: section batch embedding (no Flash)
    // Call 3: paragraph batch embedding
    expect(deps.embedder).toHaveBeenCalledTimes(3);
    expect(deps.flashValidator).not.toHaveBeenCalled();
  });

  it('a note with 30 paragraphs triggers exactly 1 batch embedding call for paragraphs', async () => {
    const noteWith30Paragraphs = makeNote(30);
    const deps = makeDeps({
      vault: {
        read: vi.fn().mockResolvedValue(noteWith30Paragraphs),
        process: vi.fn().mockImplementation(async (_file: any, fn: (c: string) => string) => {
          return fn(noteWith30Paragraphs);
        }),
        getAbstractFileByPath: vi.fn().mockReturnValue({ path: 'Notes/Note0.md', stat: { mtime: Date.now() } }),
        create: vi.fn(),
      } as any,
    });
    const pipeline = new RoutingPipeline(deps);

    await pipeline.process(CLIP_REQUEST);

    // embedder calls: [clip embed, section batch, paragraph batch]
    // The paragraph batch should be 1 call even for 30 paragraphs
    expect(deps.embedder).toHaveBeenCalledTimes(3);
    // The third call (paragraph batch) should have 30 texts
    const paragraphBatchCall = deps.embedder.mock.calls[2];
    expect(paragraphBatchCall[0]).toHaveLength(30);
  });

  it('below-threshold clip creates a new note tagged #kf-inbox', async () => {
    const vectorStore = new VectorStore();
    // Vector with 1 at index 0, 0 elsewhere
    const storeVec = new Array(768).fill(0);
    storeVec[0] = 1;
    for (let i = 0; i < 5; i++) {
      vectorStore.upsert({
        vaultPath: `Notes/Note${i}.md`,
        title: `Note${i}`,
        embedding: storeVec,
        updatedAt: Date.now(),
      });
    }

    const vault = {
      read: vi.fn().mockResolvedValue('Dummy content'),
      process: vi.fn(),
      getAbstractFileByPath: vi.fn().mockReturnValue({ path: 'Notes/Note0.md', stat: { mtime: Date.now() } }),
      create: vi.fn().mockResolvedValue({ path: 'Deep Learning Basics — 2026-06-28.md', stat: { mtime: Date.now() } }),
    } as any;

    // Vector with 1 at index 1, 0 elsewhere (orthogonal -> dot product 0)
    const queryVec = new Array(768).fill(0);
    queryVec[1] = 1;
    const embedder = vi.fn().mockImplementation(async (texts: string[]) => {
      return texts.map(() => queryVec);
    });

    const flashValidator = vi.fn().mockResolvedValue({
      chosenPath: '',
      justification: 'No good match found',
      suggestedTitle: 'AI Representation Learning',
    });

    const deps = makeDeps({
      vectorStore,
      vault,
      embedder,
      flashValidator,
      getSettings: () => ({ ...DEFAULT_PLUGIN_SETTINGS, threshold: 0.70 }),
    });
    const pipeline = new RoutingPipeline(deps);

    const result = await pipeline.process(CLIP_REQUEST);

    // Should have created a new note
    expect(vault.create).toHaveBeenCalled();
    const createCall = vault.create.mock.calls[0];
    // New note content should contain #kf-inbox tag
    expect(createCall[1]).toContain('#kf-inbox');
  });

  it('clip-id is present and unique across multiple clips', async () => {
    const deps = makeDeps();
    const pipeline = new RoutingPipeline(deps);

    const result1 = await pipeline.process(CLIP_REQUEST);
    const result2 = await pipeline.process(CLIP_REQUEST);

    expect(result1.clipId).toBeTruthy();
    expect(result2.clipId).toBeTruthy();
    expect(result1.clipId).not.toBe(result2.clipId);
  });

  it('appends entry to ClipLog after successful insertion', async () => {
    const deps = makeDeps();
    const pipeline = new RoutingPipeline(deps);

    await pipeline.process(CLIP_REQUEST);

    expect(deps.clipLog.getRecent()).toHaveLength(1);
    expect(deps.clipLog.getRecent()[0].sourceUrl).toBe('https://example.com/ml-article');
    expect(deps.clipLog.getRecent()[0].status).toBe('inserted');
  });

  it('vault.process callback inserts callout without mutating other content', async () => {
    const originalNote = `## Research\n\nFirst para.\n\nSecond para.\n\nThird para.`;
    let processedContent = '';

    const deps = makeDeps({
      vault: {
        read: vi.fn().mockResolvedValue(originalNote),
        process: vi.fn().mockImplementation(async (_file: any, fn: (c: string) => string) => {
          processedContent = fn(originalNote);
          return processedContent;
        }),
        getAbstractFileByPath: vi.fn().mockReturnValue({ path: 'Notes/Note0.md', stat: { mtime: Date.now() } }),
        create: vi.fn(),
      } as any,
    });
    const pipeline = new RoutingPipeline(deps);

    await pipeline.process(CLIP_REQUEST);

    // All original paragraphs must still be present
    expect(processedContent).toContain('First para.');
    expect(processedContent).toContain('Second para.');
    expect(processedContent).toContain('Third para.');
    // Callout must be present
    expect(processedContent).toContain('[!quote]');
    expect(processedContent).toContain('[clip-id::');
  });
});
