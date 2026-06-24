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

// Lazy imports — filled in by later issues:
// import { VectorSync } from './vector-sync';
// import { ClipLog } from './clip-log';
// import { RoutingPipeline } from './routing-pipeline';

const PLUGIN_VERSION = '0.1.0';

export default class KnowledgeFlowPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
  private httpServer: http.Server | null = null;

  // Filled in by later issues:
  // private vectorSync: VectorSync;
  // private clipLog: ClipLog;
  // private routingPipeline: RoutingPipeline;

  // Daily quota counter — persisted in plugin data, reset at UTC midnight
  private callsToday = 0;
  private lastQuotaDate = '';

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new KnowledgeFlowSettingTab(this.app, this));
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
    this.resetQuotaIfNewDay();
  }

  async saveSettings(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      callsToday: this.callsToday,
      lastQuotaDate: this.lastQuotaDate,
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

  // ---------------------------------------------------------------------------
  // HTTP Server
  // ---------------------------------------------------------------------------

  private buildServerDeps(): ServerDeps {
    return {
      getAuthHash: () => this.settings.authTokenHash,
      getPluginVersion: () => PLUGIN_VERSION,
      getIsIndexing: () => false, // TODO: wire VectorSync.isIndexing
      getCachedNoteCount: () => 0, // TODO: wire VectorStore.size
      getDailyQuotaRemaining: () => {
        this.resetQuotaIfNewDay();
        return Math.max(0, 1500 - this.callsToday);
      },
      getLastIndexedAt: () => null, // TODO: wire VectorSync.lastIndexedAt
      getQueuedClipsCount: () => 0, // TODO: wire ClipQueue.size
      getRecentClips: (): ClipLogEntry[] => [], // TODO: wire ClipLog.getRecent
      handleClip: async (req: ClipRequest): Promise<ClipResponse | ClipQueuedResponse> => {
        // TODO: wire RoutingPipeline.process(req)
        // Stub response for now — replaced in Issue #4
        return {
          success: true,
          clipId: crypto.randomUUID(),
          matchedPath: '',
          justification: null,
        };
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
