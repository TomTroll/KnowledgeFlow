// packages/obsidian-plugin/src/settings-tab.ts
// Obsidian PluginSettingTab for KnowledgeFlow.
//
// Provides configuration for:
//   - Gemini API key (with live validation)
//   - Authorization token generator (raw shown once, hash stored)
//   - Port number (server restarts on change)
//   - Similarity threshold
//   - LLM Validation toggle
//   - Auto-sync toggle

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type KnowledgeFlowPlugin from './main';
import { hashToken } from './auth';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TASK_TYPE } from './gemini-models';

export class KnowledgeFlowSettingTab extends PluginSettingTab {
  plugin: KnowledgeFlowPlugin;

  constructor(app: App, plugin: KnowledgeFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'KnowledgeFlow Settings' });

    // ------------------------------------------------------------------
    // Gemini API Key
    // ------------------------------------------------------------------
    new Setting(containerEl)
      .setName('Gemini API Key')
      .setDesc('Your personal Google AI Studio key. Never leaves this device.')
      .addText((text) => {
        // Bug fix: mask the API key so it isn't visible in screen recordings
        // or over the shoulder.
        text.inputEl.type = 'password';
        return text
          .setPlaceholder('AIza…')
          .setValue(this.plugin.settings.geminiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiKey = value;
            await this.plugin.saveSettings();
          });
      })
      .addButton((btn) =>
        btn.setButtonText('Validate').onClick(async () => {
          const key = this.plugin.settings.geminiKey;
          if (!key) {
            new Notice('❌ Enter a Gemini API key first.');
            return;
          }
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${key}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: `models/${EMBEDDING_MODEL}`,
                  content: { parts: [{ text: 'KnowledgeFlow key check' }] },
                  outputDimensionality: EMBEDDING_DIMENSIONS,
                  taskType: EMBEDDING_TASK_TYPE,
                }),
              },
            );
            if (resp.ok) {
              new Notice('✅ Gemini API key is valid!');
            } else {
              const err = await resp.json().catch(() => ({}));
              new Notice(`❌ Invalid key: ${(err as { error?: { message?: string } }).error?.message ?? resp.status}`);
            }
          } catch {
            new Notice('❌ Network error — is Obsidian online?');
          }
        }),
      );

    // ------------------------------------------------------------------
    // Authorization Token
    // ------------------------------------------------------------------
    const tokenSetting = new Setting(containerEl)
      .setName('Authorization Token')
      .setDesc(
        'Paste this token into the Chrome Extension options page. The token is shown below and copied to your clipboard automatically.',
      )
      .addButton((btn) =>
        btn.setButtonText('Generate Token').onClick(async () => {
          const rawToken = crypto.randomUUID();
          const hash = await hashToken(rawToken);
          this.plugin.settings.authTokenHash = hash;
          await this.plugin.saveSettings();

          // Show the token as a selectable read-only input directly in the tab
          tokenDisplay.value = rawToken;
          tokenRow.style.display = 'flex';

          // Also copy to clipboard for convenience
          try {
            await navigator.clipboard.writeText(rawToken);
            new Notice('🔑 Token generated and copied to clipboard!');
          } catch {
            // Clipboard can fail if Obsidian lacks focus — the text field is the fallback
            new Notice('🔑 Token generated — copy it from the field below.');
          }
        }),
      );

    // Read-only token display row (hidden until a token is generated)
    const tokenRow = containerEl.createDiv({
      attr: { style: 'display:none; align-items:center; gap:8px; margin-top:6px; margin-bottom:12px;' },
    });
    const tokenDisplay = tokenRow.createEl('input', {
      type: 'text',
      attr: {
        readonly: 'true',
        style: 'flex:1; font-family:monospace; font-size:12px; padding:4px 8px; border:1px solid var(--background-modifier-border); border-radius:4px; background:var(--background-secondary); color:var(--text-normal); cursor:text;',
        placeholder: 'Token appears here after generation…',
      },
    }) as HTMLInputElement;
    const copyBtn = tokenRow.createEl('button', {
      text: 'Copy',
      attr: { style: 'padding:4px 12px; border-radius:4px; cursor:pointer;' },
    });
    copyBtn.addEventListener('click', async () => {
      if (!tokenDisplay.value) return;
      await navigator.clipboard.writeText(tokenDisplay.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
    tokenRow.appendChild(tokenDisplay);
    tokenRow.appendChild(copyBtn);

    // ------------------------------------------------------------------
    // Port
    // ------------------------------------------------------------------
    new Setting(containerEl)
      .setName('Local Port')
      .setDesc('The port the plugin HTTP server listens on (default: 37321). Requires Obsidian restart.')
      .addText((text) =>
        text
          .setPlaceholder('37321')
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!Number.isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          }),
      );

    // ------------------------------------------------------------------
    // Similarity Threshold
    // ------------------------------------------------------------------
    new Setting(containerEl)
      .setName('Similarity Threshold')
      .setDesc(
        'Cosine similarity score (0–1) below which a new note is auto-created instead of routing (default: 0.70).',
      )
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.01)
          .setValue(this.plugin.settings.threshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.threshold = value;
            await this.plugin.saveSettings();
          }),
      );

    // ------------------------------------------------------------------
    // LLM Validation Toggle
    // ------------------------------------------------------------------
    new Setting(containerEl)
      .setName('LLM Validation')
      .setDesc(
        'When enabled, uses Gemini Flash to validate routing and generate a justification. Disable to save quota.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.llmValidationEnabled)
          .onChange(async (value) => {
            this.plugin.settings.llmValidationEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    // ------------------------------------------------------------------
    // Auto-Sync Toggle
    // ------------------------------------------------------------------
    new Setting(containerEl)
      .setName('Auto-Sync')
      .setDesc(
        'When enabled, the plugin continuously embeds new and modified notes in the background.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSyncEnabled)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncEnabled = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
