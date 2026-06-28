import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import type KnowledgeFlowPlugin from '../main';
import type { ClipLogEntry } from '@knowledgeflow/shared';
import { extractAndRemoveCallout } from '../actions/undo-action';
import { RelocateModal } from './relocate-modal';

export const CLIP_HISTORY_VIEW_TYPE = 'knowledgeflow-history-view';

export class ClipHistoryView extends ItemView {
  private plugin: KnowledgeFlowPlugin;
  private searchTerm: string = '';
  private listContainer: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: KnowledgeFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.listContainer = this.contentEl.createDiv('kf-history-list');
  }

  getViewType(): string {
    return CLIP_HISTORY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Clip History';
  }

  getIcon(): string {
    return 'history';
  }

  async onOpen() {
    this.contentEl.empty();
    
    // Header
    this.contentEl.createEl('h3', { text: 'Clip History' });

    // Search bar
    const searchContainer = this.contentEl.createDiv('kf-history-search-container');
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search clips or notes...',
    });
    searchInput.style.width = '100%';
    searchInput.style.marginBottom = '15px';
    
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderList();
    });

    this.listContainer = this.contentEl.createDiv('kf-history-list');
    this.listContainer.style.display = 'flex';
    this.listContainer.style.flexDirection = 'column';
    this.listContainer.style.gap = '10px';

    this.renderList();
  }

  private renderList() {
    this.listContainer.empty();
    const clips = this.plugin.clipLog.getAll();
    
    // Filter and sort most recent first
    const filteredClips = clips
      .filter((c) => {
        const term = this.searchTerm;
        if (!term) return true;
        return (
          c.selectedText.toLowerCase().includes(term) ||
          c.matchedPath.toLowerCase().includes(term) ||
          c.pageTitle.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filteredClips.length === 0) {
      this.listContainer.createEl('div', { text: 'No clips found.', cls: 'kf-empty-state' });
      return;
    }

    for (const clip of filteredClips) {
      this.renderClipItem(clip);
    }
  }

  private renderClipItem(clip: ClipLogEntry) {
    const itemEl = this.listContainer.createDiv('kf-history-item');
    itemEl.style.border = '1px solid var(--background-modifier-border)';
    itemEl.style.padding = '10px';
    itemEl.style.borderRadius = '5px';
    itemEl.style.position = 'relative';

    // Header: Timestamp & Badge
    const headerEl = itemEl.createDiv();
    headerEl.style.display = 'flex';
    headerEl.style.justifyContent = 'space-between';
    headerEl.style.marginBottom = '5px';

    const date = new Date(clip.timestamp);
    headerEl.createEl('small', { text: date.toLocaleString() });

    const badgeEl = headerEl.createEl('span', { text: clip.status.toUpperCase() });
    badgeEl.style.fontSize = '0.7em';
    badgeEl.style.padding = '2px 6px';
    badgeEl.style.borderRadius = '4px';
    badgeEl.style.fontWeight = 'bold';
    
    if (clip.status === 'inserted') {
      badgeEl.style.backgroundColor = 'var(--interactive-success)';
      badgeEl.style.color = 'var(--text-on-accent)';
    } else if (clip.status === 'undone') {
      badgeEl.style.backgroundColor = 'var(--interactive-hover)';
      badgeEl.style.color = 'var(--text-muted)';
    } else if (clip.status === 'relocated') {
      badgeEl.style.backgroundColor = 'var(--interactive-accent)';
      badgeEl.style.color = 'var(--text-on-accent)';
    } else {
      badgeEl.style.backgroundColor = 'var(--background-modifier-error)';
    }

    // Body: Path and Text
    itemEl.createEl('div', { text: `📁 ${clip.matchedPath || 'Unknown'}` }).style.fontWeight = 'bold';
    itemEl.createEl('div', { text: clip.selectedText.substring(0, 80) + '...' }).style.fontSize = '0.9em';

    // Actions
    if (clip.status === 'inserted') {
      const actionsEl = itemEl.createDiv();
      actionsEl.style.marginTop = '10px';
      actionsEl.style.display = 'flex';
      actionsEl.style.gap = '5px';

      const undoBtn = actionsEl.createEl('button', { text: 'Undo' });
      undoBtn.onclick = () => this.handleUndo(clip);

      const relocateBtn = actionsEl.createEl('button', { text: 'Relocate' });
      relocateBtn.onclick = () => this.handleRelocate(clip);
    }
  }

  private async handleUndo(clip: ClipLogEntry) {
    const file = this.app.vault.getAbstractFileByPath(clip.matchedPath);
    if (!file || !(file instanceof TFile)) {
      new Notice('Target note not found.');
      return;
    }

    let success = false;
    await this.app.vault.process(file, (data) => {
      const result = extractAndRemoveCallout(data, clip.id);
      if (result) {
        success = true;
        return result.newContent;
      }
      return data;
    });

    if (success) {
      clip.status = 'undone';
      await this.plugin.saveSettings();
      new Notice('Clip undone successfully.');
      this.renderList();
    } else {
      new Notice('Could not find the clip callout block in the note.');
    }
  }

  private async handleRelocate(clip: ClipLogEntry) {
    const oldFile = this.app.vault.getAbstractFileByPath(clip.matchedPath);
    if (!oldFile || !(oldFile instanceof TFile)) {
      new Notice('Original target note not found.');
      return;
    }

    // Step 1: Extract the callout from the current file
    let extractedCallout: string | null = null;
    let oldContent = await this.app.vault.read(oldFile);
    const result = extractAndRemoveCallout(oldContent, clip.id);
    
    if (result) {
      extractedCallout = result.extractedCallout;
    }

    if (!extractedCallout) {
      new Notice('Could not find the clip callout block to relocate.');
      return;
    }

    // Step 2: Ask user for new location
    new RelocateModal(this.app, async (newFile: TFile) => {
      // Execute the move
      await this.app.vault.process(oldFile, (data) => {
        const res = extractAndRemoveCallout(data, clip.id);
        return res ? res.newContent : data;
      });

      await this.app.vault.process(newFile, (data) => {
        const prefix = data.endsWith('\n') || data.trim() === '' ? '' : '\n\n';
        return data + prefix + extractedCallout;
      });

      // Update log
      clip.status = 'relocated';
      clip.matchedPath = newFile.path;
      await this.plugin.saveSettings();
      new Notice(`Clip relocated to ${newFile.path}`);
      this.renderList();
    }).open();
  }

  async onClose() {
    this.contentEl.empty();
  }
}
