import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VectorStore } from '../vector-store';
import { VectorSync } from '../vector-sync';
import { DEFAULT_PLUGIN_SETTINGS } from '@knowledgeflow/shared';

// Mock Obsidian TFile and Vault
class MockTFile {
  path: string;
  basename: string;
  stat: { mtime: number };
  extension: string = 'md';

  constructor(path: string, mtime: number = Date.now()) {
    this.path = path;
    const parts = path.split('/');
    this.basename = parts[parts.length - 1].replace('.md', '');
    this.stat = { mtime };
  }
}

class MockVault {
  files: MockTFile[] = [];
  fileContents = new Map<string, string>();
  adapter = {
    read: vi.fn(),
    write: vi.fn(),
    exists: vi.fn().mockResolvedValue(true)
  };
  events: Record<string, Function[]> = {};

  getMarkdownFiles() {
    return this.files.filter(f => f.extension === 'md');
  }

  async read(file: MockTFile) {
    return this.fileContents.get(file.path) || '';
  }

  async cachedRead(file: MockTFile) {
    return this.read(file);
  }

  on(eventName: string, callback: Function) {
    if (!this.events[eventName]) this.events[eventName] = [];
    this.events[eventName].push(callback);
    return { eventName, callback }; // EventRef
  }
}

describe('VectorSync', () => {
  let vault: MockVault;
  let vectorStore: VectorStore;
  let getSettings: any;
  let pluginMock: any;
  let statusBarMock: HTMLElement;
  let apiCallTracker: { texts: string[] }[];
  
  beforeEach(() => {
    vi.useFakeTimers();
    vault = new MockVault();
    vectorStore = new VectorStore();
    getSettings = () => ({ ...DEFAULT_PLUGIN_SETTINGS });
    apiCallTracker = [];
    
    pluginMock = {
      manifest: { dir: '.obsidian/plugins/knowledgeflow' },
      incrementApiCalls: vi.fn(),
      registerEvent: vi.fn()
    };
    
    statusBarMock = {
      setText: vi.fn(),
      setAttribute: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('On startup, only notes with mtime newer than their cache entry are re-embedded', async () => {
    // 1. Setup 500 files
    const now = 1000000;
    for (let i = 0; i < 500; i++) {
      const file = new MockTFile(`Note ${i}.md`, now - 1000); // 1000ms old
      vault.files.push(file);
      vault.fileContents.set(file.path, `Content of note ${i}`);
    }
    
    // 2. Setup 498 existing cache entries that are completely up to date
    const cachedEntries = vault.files.slice(0, 498).map(f => ({
      vaultPath: f.path,
      title: f.basename,
      embedding: new Array(768).fill(0.1),
      updatedAt: f.stat.mtime // exactly matching
    }));
    vault.adapter.read.mockResolvedValue(JSON.stringify(cachedEntries));

    // 3. Make note 498 "newer" than its cache entry
    const oldCacheEntry = {
      vaultPath: vault.files[498].path,
      title: vault.files[498].basename,
      embedding: new Array(768).fill(0.1),
      updatedAt: now - 5000 // Cache is older than file (now-1000)
    };
    cachedEntries.push(oldCacheEntry);
    vault.adapter.read.mockResolvedValue(JSON.stringify(cachedEntries));

    // Note 499 has NO cache entry at all.
    
    // 4. Initialize VectorSync
    const mockEmbedder = vi.fn().mockImplementation(async (texts: string[]) => {
      apiCallTracker.push({ texts });
      return texts.map(() => new Array(768).fill(0.9));
    });
    
    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings,
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1500
    });

    await sync.start();

    // 5. Assert that only 2 files (Note 498 and Note 499) were sent for embedding
    expect(mockEmbedder).toHaveBeenCalledTimes(1);
    expect(apiCallTracker[0].texts.length).toBe(2);
    expect(apiCallTracker[0].texts[0]).toContain('Note 498');
    expect(apiCallTracker[0].texts[1]).toContain('Note 499');
    
    // The vector store should now have 500 items
    expect(vectorStore.size).toBe(500);
    
    // The adapter write should be called with 500 items
    expect(vault.adapter.write).toHaveBeenCalled();
    const writeCall = vault.adapter.write.mock.calls[vault.adapter.write.mock.calls.length - 1];
    const saved = JSON.parse(writeCall[1]);
    expect(saved.length).toBe(500);
  });

  it('Initial index of a vault with 250 notes triggers exactly 3 batch calls (100 + 100 + 50)', async () => {
    const now = Date.now();
    for (let i = 0; i < 250; i++) {
      const file = new MockTFile(`Note ${i}.md`, now);
      vault.files.push(file);
      vault.fileContents.set(file.path, `Content ${i}`);
    }
    
    // Empty cache
    vault.adapter.exists.mockResolvedValue(false);
    
    const mockEmbedder = vi.fn().mockImplementation(async (texts: string[]) => {
      apiCallTracker.push({ texts });
      return texts.map(() => new Array(768).fill(0.5));
    });

    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings,
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1500
    });

    await sync.start();

    expect(mockEmbedder).toHaveBeenCalledTimes(3);
    expect(apiCallTracker[0].texts.length).toBe(100);
    expect(apiCallTracker[1].texts.length).toBe(100);
    expect(apiCallTracker[2].texts.length).toBe(50);
  });

  it('A file saved rapidly 4 times in 6 seconds triggers exactly 1 re-embedding call', async () => {
    const mockEmbedder = vi.fn().mockResolvedValue([[0.1]]);
    
    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings,
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1500
    });
    
    // We mock start to avoid startup embeddings
    await sync.start();
    mockEmbedder.mockClear();

    const file = new MockTFile('test.md', Date.now());
    vault.files.push(file);
    
    // Trigger modify 4 times quickly
    const modifyCallbacks = vault.events['modify'] || [];
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(1500); // 1.5s between saves, 4.5s total
      file.stat.mtime = Date.now();
      for (const cb of modifyCallbacks) {
        cb(file);
      }
    }

    // Still shouldn't have been called because debounce is 5 seconds from the *last* save
    expect(mockEmbedder).not.toHaveBeenCalled();

    // Advance 5.1s past the LAST save and resolve promises
    await vi.advanceTimersByTimeAsync(5100);

    // Now it should be called exactly once
    expect(mockEmbedder).toHaveBeenCalledTimes(1);
  });

  it('A deleted note is removed from the in-memory cache before vault.on("delete") callback returns', async () => {
    const mockEmbedder = vi.fn().mockResolvedValue([]);
    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings,
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1500
    });
    
    // Add an item to the store
    vectorStore.upsert({
      vaultPath: 'to-delete.md',
      title: 'to-delete',
      embedding: new Array(768).fill(0.1),
      updatedAt: Date.now()
    });
    
    expect(vectorStore.size).toBe(1);
    
    // Trigger delete event
    const deleteCallbacks = vault.events['delete'] || [];
    const file = new MockTFile('to-delete.md');
    
    for (const cb of deleteCallbacks) {
      cb(file);
    }
    
    // Should be synchronously removed
    expect(vectorStore.size).toBe(0);
    // Should save cache async
    expect(vault.adapter.write).toHaveBeenCalled();
  });

  it('Status bar icon updates to ⏳ syncing during an active embedding batch and returns to ✅ synced on completion', async () => {
    let resolveEmbedder: any;
    const mockEmbedder = vi.fn().mockImplementation(() => {
      return new Promise(resolve => {
        resolveEmbedder = resolve;
      });
    });

    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings,
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1500
    });

    const file = new MockTFile('test.md', Date.now());
    vault.files.push(file);
    vault.adapter.exists.mockResolvedValue(false);

    const startPromise = sync.start();
    
    // flush promises so vault.read finishes and embedder is called
    for(let i = 0; i < 15; i++) {
      await Promise.resolve();
    }
    
    // wait until the embedder mock is actually called
    while (!resolveEmbedder) {
      await new Promise(r => setTimeout(r, 10));
    }
    
    // While embedding is ongoing, status is syncing
    expect(statusBarMock.setText).toHaveBeenCalledWith('⏳ syncing');
    
    // Resolve embedding
    resolveEmbedder([[0.5]]);
    await startPromise;

    // Upon completion, status returns to synced
    expect(statusBarMock.setText).toHaveBeenCalledWith('✅ synced');
  });

  it('Hover tooltip displays correct note count and daily quota estimate', async () => {
    const mockEmbedder = vi.fn().mockResolvedValue([]);
    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings,
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1400
    });

    // Assume store has 150 items
    for (let i = 0; i < 150; i++) {
      vectorStore.upsert({
        vaultPath: `note${i}.md`,
        title: `note${i}`,
        embedding: [0.1],
        updatedAt: Date.now()
      });
    }

    await sync.start();
    
    // Status bar tooltip is set via setAttribute('aria-label', text)
    expect(statusBarMock.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringContaining('150 notes')
    );
    expect(statusBarMock.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringContaining('1,400 API calls remaining today')
    );
  });

  it('Auto-sync toggle in settings stops all background embedding when disabled', async () => {
    const mockEmbedder = vi.fn().mockResolvedValue([[0.1]]);
    let autoSync = false;
    const sync = new VectorSync({
      vault: vault as any,
      vectorStore,
      getSettings: () => ({ ...DEFAULT_PLUGIN_SETTINGS, autoSyncEnabled: autoSync }),
      plugin: pluginMock,
      statusBarItem: statusBarMock,
      embedder: mockEmbedder,
      getDailyQuotaRemaining: () => 1500
    });

    await sync.start();
    mockEmbedder.mockClear();

    const file = new MockTFile('test.md', Date.now());
    vault.files.push(file);

    // Modify file
    const modifyCallbacks = vault.events['modify'] || [];
    for (const cb of modifyCallbacks) cb(file);
    
    // Create file
    const createCallbacks = vault.events['create'] || [];
    for (const cb of createCallbacks) cb(file);

    await vi.advanceTimersByTimeAsync(5100);

    // Should not have called embedder because autoSync is false
    expect(mockEmbedder).not.toHaveBeenCalled();
  });
});
