import { FuzzySuggestModal, type App, type TFile } from 'obsidian';

export class RelocateModal extends FuzzySuggestModal<TFile> {
  private onSelectCallback: (file: TFile) => void;

  constructor(app: App, onSelectCallback: (file: TFile) => void) {
    super(app);
    this.onSelectCallback = onSelectCallback;
    this.setPlaceholder('Search for a note to relocate this clip...');
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
    this.onSelectCallback(file);
  }
}
