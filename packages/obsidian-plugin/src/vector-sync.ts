import { Vault, TFile, Plugin, TAbstractFile } from 'obsidian';
import { VectorStore } from './vector-store';
import { PluginSettings, VectorCacheEntry } from '@knowledgeflow/shared';

export interface VectorSyncDeps {
  vault: Vault;
  vectorStore: VectorStore;
  getSettings: () => PluginSettings;
  plugin: Plugin;
  statusBarItem: HTMLElement;
  embedder: (texts: string[]) => Promise<number[][]>;
  getDailyQuotaRemaining: () => number;
}

export class VectorSync {
  private vault: Vault;
  private vectorStore: VectorStore;
  private getSettings: () => PluginSettings;
  private plugin: Plugin;
  private statusBarItem: HTMLElement;
  private embedder: (texts: string[]) => Promise<number[][]>;
  private getDailyQuotaRemaining: () => number;
  
  public isIndexing = false;
  public lastIndexedAt: string | null = null;
  private cachePath: string;

  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(deps: VectorSyncDeps) {
    this.vault = deps.vault;
    this.vectorStore = deps.vectorStore;
    this.getSettings = deps.getSettings;
    this.plugin = deps.plugin;
    this.statusBarItem = deps.statusBarItem;
    this.embedder = deps.embedder;
    this.getDailyQuotaRemaining = deps.getDailyQuotaRemaining;
    this.cachePath = this.plugin.manifest.dir + '/vector-cache.json';
    
    this.registerEvents();
  }

  private registerEvents() {
    this.plugin.registerEvent(this.vault.on('modify', (file: TAbstractFile) => {
      if (!('extension' in file) || (file as TFile).extension !== 'md') return;
      if (!this.getSettings().autoSyncEnabled) return;
      
      const existingTimer = this.debounceTimers.get(file.path);
      if (existingTimer) clearTimeout(existingTimer);
      
      const timer = setTimeout(() => {
        this.batchEmbed([file as TFile]).catch(e => {
          console.error('Failed to embed modified file', e);
          this.setStatus('offline');
        });
        this.debounceTimers.delete(file.path);
      }, 5000);
      
      this.debounceTimers.set(file.path, timer);
    }));

    this.plugin.registerEvent(this.vault.on('create', (file: TAbstractFile) => {
      if (!('extension' in file) || (file as TFile).extension !== 'md') return;
      if (!this.getSettings().autoSyncEnabled) return;
      this.batchEmbed([file as TFile]).catch(e => {
        console.error('Failed to embed new file', e);
        this.setStatus('offline');
      });
    }));

    this.plugin.registerEvent(this.vault.on('delete', (file: TAbstractFile) => {
      if (!('extension' in file) || (file as TFile).extension !== 'md') return;
      this.vectorStore.delete(file.path);
      // Synchronous removal from cache memory, persist async
      this.saveCache();
    }));
  }

  async start() {
    this.setStatus('syncing');
    await this.loadCache();
    
    const files = this.vault.getMarkdownFiles();
    const toEmbed: TFile[] = [];
    
    // Find completely new or modified files
    for (const file of files) {
      // Find existing entry in vectorStore by vaultPath
      const entry = this.vectorStore.getAll().find(e => e.vaultPath === file.path);
      if (!entry || file.stat.mtime > entry.updatedAt) {
        toEmbed.push(file);
      }
    }
    
    try {
      if (toEmbed.length > 0) {
        await this.batchEmbed(toEmbed);
      }
      this.setStatus('synced');
    } catch (e) {
      console.error('Vector sync failed on startup:', e);
      this.setStatus('offline');
    }
  }

  private async loadCache() {
    try {
      if (await this.vault.adapter.exists(this.cachePath)) {
        const data = await this.vault.adapter.read(this.cachePath);
        if (data) {
          const entries = JSON.parse(data) as VectorCacheEntry[];
          this.vectorStore.loadAll(entries);
        }
      }
    } catch (e) {
      console.error('Failed to load vector cache', e);
    }
  }

  private async saveCache() {
    try {
      const data = JSON.stringify(this.vectorStore.getAll());
      await this.vault.adapter.write(this.cachePath, data);
    } catch (e) {
      console.error('Failed to save vector cache', e);
    }
  }

  private async batchEmbed(files: TFile[]) {
    // Only fetch content up to 200 words, strip frontmatter
    const texts = await Promise.all(files.map(async file => {
      const content = await this.vault.read(file);
      const stripped = this.stripFrontmatter(content);
      const words = stripped.split(/\s+/).slice(0, 200).join(' ');
      return file.basename + '\n' + words;
    }));
    
    // Batch into chunks of 100
    for (let i = 0; i < texts.length; i += 100) {
      const batchTexts = texts.slice(i, i + 100);
      const batchFiles = files.slice(i, i + 100);
      const embeddings = await this.embedder(batchTexts);
      
      for (let j = 0; j < batchFiles.length; j++) {
        const file = batchFiles[j];
        this.vectorStore.upsert({
          vaultPath: file.path,
          title: file.basename,
          embedding: embeddings[j],
          updatedAt: file.stat.mtime
        });
      }
      
      await this.saveCache();
    }
  }

  private stripFrontmatter(content: string): string {
    const match = content.match(/^---\n[\s\S]*?\n---\n/);
    if (match) {
      return content.slice(match[0].length);
    }
    return content;
  }
  
  private setStatus(state: 'syncing' | 'synced' | 'offline') {
    if (state === 'syncing') {
      this.isIndexing = true;
      this.statusBarItem.setText('⏳ syncing');
    } else if (state === 'synced') {
      this.isIndexing = false;
      this.lastIndexedAt = new Date().toISOString();
      this.statusBarItem.setText('✅ synced');
    } else {
      this.isIndexing = false;
      this.statusBarItem.setText('⛔ offline');
    }
    
    this.updateTooltip();
  }

  private updateTooltip() {
    const quota = this.getDailyQuotaRemaining().toLocaleString('en-US');
    const count = this.vectorStore.size.toLocaleString('en-US');
    const lastDate = this.lastIndexedAt 
      ? new Date(this.lastIndexedAt).toLocaleTimeString('en-US') 
      : 'Never';
      
    const tooltip = `Last indexed: ${lastDate}\n${count} notes cached\n${quota} API calls remaining today`;
    this.statusBarItem.setAttribute('aria-label', tooltip);
  }
}
