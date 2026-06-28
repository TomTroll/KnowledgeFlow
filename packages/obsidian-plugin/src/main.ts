// packages/obsidian-plugin/src/main.ts
// KnowledgeFlow — Obsidian Plugin entry point.
//
// Responsibilities:
//   1. Load/save settings via Obsidian's native persistence API.
//   2. Start the localhost HTTP server on plugin load; stop it on unload.
//   3. Register the Settings tab.
//   4. Wire the ServerDeps interface with real runtime implementations.
//      (Vector sync, clip log, and routing pipeline are imported from their
//       respective modules as they are implemented in subsequent issues.)

import http from 'http';
import { Plugin, Notice } from 'obsidian';
import {
  DEFAULT_PLUGIN_SETTINGS,
  type PluginSettings,
  type ClipRequest,
  type ClipResponse,
  type ClipQueuedResponse,
  type ClipLogEntry,
} from '@knowledgeflow/shared';
import { createServer, type ServerDeps } from './server';
import { KnowledgeFlowSettingTab } from './settings-tab';
import { VectorStore } from './vector-store';
import { VectorSync } from './vector-sync';
import { getBatchEmbeddings } from './gemini-api';
import { validateWithFlash } from './gemini-flash';
import { ClipLog } from './clip-log';
import { RoutingPipeline } from './routing-pipeline';
import { ClipQueue } from './clip-queue';
import { ClipHistoryView, CLIP_HISTORY_VIEW_TYPE } from './ui/clip-history-view';

const PLUGIN_VERSION = '0.1.0';

export default class KnowledgeFlowPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
  private httpServer: http.Server | null = null;

  private callsToday = 0;
  private lastQuotaDate = '';
  
  private vectorStore!: VectorStore;
  private vectorSync!: VectorSync;
  private clipLog!: ClipLog;
  private routingPipeline!: RoutingPipeline;
  private clipQueue!: ClipQueue;


  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new KnowledgeFlowSettingTab(this.app, this));
    
    this.registerView(
      CLIP_HISTORY_VIEW_TYPE,
      (leaf) => new ClipHistoryView(leaf, this)
    );
    
    this.addRibbonIcon('history', 'KnowledgeFlow Clip History', () => {
      this.activateHistoryView();
    });
    
    this.addCommand({
      id: 'open-clip-history',
      name: 'Open Clip History',
      callback: () => {
        this.activateHistoryView();
      }
    });

    this.vectorStore = new VectorStore();
    const statusBarItem = this.addStatusBarItem();
    
    this.vectorSync = new VectorSync({
      vault: this.app.vault,
      vectorStore: this.vectorStore,
      getSettings: () => this.settings,
      plugin: this,
      statusBarItem,
      embedder: async (texts: string[]) => {
        const embeddings = await getBatchEmbeddings(texts, this.settings.geminiKey);
        this.incrementApiCalls(1);
        return embeddings;
      },
      getDailyQuotaRemaining: () => this.getDailyQuotaRemaining()
    });
    
    const embedder = async (texts: string[]) => {
      const embeddings = await getBatchEmbeddings(texts, this.settings.geminiKey);
      this.incrementApiCalls(1);
      return embeddings;
    };
    
    this.routingPipeline = new RoutingPipeline({
      embedder,
      flashValidator: validateWithFlash,
      vectorStore: this.vectorStore,
      clipLog: this.clipLog,
      vault: this.app.vault,
      getSettings: () => this.settings,
    });
    
    this.clipQueue = new ClipQueue(
      (req, clipId) => this.routingPipeline.process(req, clipId),
      this.clipLog,
      () => this.saveSettings()
    );
    
    this.vectorSync.start();
    
    this.startServer();
  }

  onunload(): void {
    this.stopServer();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    // Bug fix: handle both the new nested format { settings: {…} } and a legacy
    // flat format where the settings were stored at the top level.
    const settingsSource =
      saved && typeof saved === 'object' && 'settings' in saved
        ? (saved as { settings: Partial<PluginSettings> }).settings
        : (saved as Partial<PluginSettings> | null) ?? {};
    this.settings = Object.assign({}, DEFAULT_PLUGIN_SETTINGS, settingsSource);
    this.callsToday = (saved as { callsToday?: number } | null)?.callsToday ?? 0;
    this.lastQuotaDate = (saved as { lastQuotaDate?: string } | null)?.lastQuotaDate ?? '';
    
    if (!this.clipLog) {
      this.clipLog = new ClipLog();
    }
    this.clipLog.loadAll((saved as any)?.clipLog ?? []);
    
    this.resetQuotaIfNewDay();
  }

  async saveSettings(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      callsToday: this.callsToday,
      lastQuotaDate: this.lastQuotaDate,
      clipLog: this.clipLog ? this.clipLog.getAll() : [],
    });
  }

  // ---------------------------------------------------------------------------
  // Daily quota tracking
  // ---------------------------------------------------------------------------

  private resetQuotaIfNewDay(): void {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    if (this.lastQuotaDate !== today) {
      this.callsToday = 0;
      this.lastQuotaDate = today;
    }
  }

  incrementApiCalls(n = 1): void {
    this.resetQuotaIfNewDay();
    this.callsToday += n;
    this.saveSettings();
  }

  getDailyQuotaRemaining(): number {
    this.resetQuotaIfNewDay();
    return Math.max(0, 1500 - this.callsToday);
  }

  // ---------------------------------------------------------------------------
  // View Management
  // ---------------------------------------------------------------------------

  async activateHistoryView() {
    const { workspace } = this.app;
    
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(CLIP_HISTORY_VIEW_TYPE);
    
    if (leaves.length > 0) {
      // View is already open, just focus it
      leaf = leaves[0];
    } else {
      // Create a new leaf in the right sidebar
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: CLIP_HISTORY_VIEW_TYPE, active: true });
      }
    }
    
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP Server
  // ---------------------------------------------------------------------------

  private buildServerDeps(): ServerDeps {
    return {
      getAuthHash: () => this.settings.authTokenHash,
      getPluginVersion: () => PLUGIN_VERSION,
      getIsIndexing: () => this.vectorSync?.isIndexing ?? false,
      getCachedNoteCount: () => this.vectorStore?.size ?? 0,
      getDailyQuotaRemaining: () => this.getDailyQuotaRemaining(),
      getLastIndexedAt: () => this.vectorSync?.lastIndexedAt ?? null,
      getQueuedClipsCount: () => this.clipQueue?.size ?? 0,
      getRecentClips: (): ClipLogEntry[] => this.clipLog?.getRecent() ?? [],
      handleClip: async (req: ClipRequest): Promise<ClipResponse | ClipQueuedResponse> => {
        return this.clipQueue.handleClip(req);
      },
    };
  }

  private startServer(): void {
    if (this.httpServer) return;
    const deps = this.buildServerDeps();
    this.httpServer = createServer(deps);
    this.httpServer.listen(this.settings.port, '127.0.0.1', () => {
      console.log(`[KnowledgeFlow] HTTP server listening on 127.0.0.1:${this.settings.port}`);
    });
    this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        new Notice(
          `[KnowledgeFlow] Port ${this.settings.port} is already in use. Change the port in settings.`,
        );
      } else {
        console.error('[KnowledgeFlow] Server error:', err);
      }
    });
  }

  private stopServer(): void {
    if (!this.httpServer) return;
    // Bug fix: null the reference INSIDE the callback, not before it.
    // Setting it to null immediately would allow startServer() to race
    // before the OS has actually released the port.
    const serverToClose = this.httpServer;
    this.httpServer = null;
    serverToClose.close(() => {
      console.log('[KnowledgeFlow] HTTP server stopped.');
    });
  }
}
