"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => KnowledgeFlowPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// ../shared/src/types.ts
var DEFAULT_PLUGIN_SETTINGS = {
  geminiKey: "",
  authTokenHash: "",
  port: 37321,
  threshold: 0.7,
  llmValidationEnabled: true,
  autoSyncEnabled: true
};

// src/server.ts
var import_http = __toESM(require("http"));

// src/auth.ts
async function hashToken(rawToken) {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function validateBearer(authHeader, storedHash) {
  if (!storedHash) return false;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const rawToken = authHeader.slice("Bearer ".length);
  if (!rawToken) return false;
  const incoming = await hashToken(rawToken);
  return incoming === storedHash;
}

// src/server.ts
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
function createServer(deps) {
  return import_http.default.createServer(async (req, res) => {
    const authHeader = req.headers["authorization"];
    const isAuthed = await validateBearer(authHeader, deps.getAuthHash());
    if (!isAuthed) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    const method = req.method ?? "GET";
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (method === "GET" && pathname === "/status") {
        const body = {
          pluginVersion: deps.getPluginVersion(),
          isIndexing: deps.getIsIndexing(),
          cachedNoteCount: deps.getCachedNoteCount(),
          dailyQuotaRemaining: deps.getDailyQuotaRemaining(),
          lastIndexedAt: deps.getLastIndexedAt(),
          queuedClips: deps.getQueuedClipsCount()
        };
        return sendJson(res, 200, body);
      }
      if (method === "GET" && pathname === "/clips") {
        return sendJson(res, 200, { clips: deps.getRecentClips() });
      }
      if (method === "POST" && pathname === "/clip") {
        const raw = await readBody(req);
        if (!raw.trim()) {
          return sendJson(res, 400, { error: "Request body is required" });
        }
        let clipRequest;
        try {
          clipRequest = JSON.parse(raw);
        } catch {
          return sendJson(res, 400, { error: "Invalid JSON body" });
        }
        const result = await deps.handleClip(clipRequest);
        const status = result.success ? 200 : 202;
        return sendJson(res, status, result);
      }
      sendJson(res, 404, { error: "Not Found" });
    } catch (err) {
      sendJson(res, 500, { error: "Internal Server Error" });
    }
  });
}

// src/settings-tab.ts
var import_obsidian = require("obsidian");
var KnowledgeFlowSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "KnowledgeFlow Settings" });
    new import_obsidian.Setting(containerEl).setName("Gemini API Key").setDesc("Your personal Google AI Studio key. Never leaves this device.").addText((text) => {
      text.inputEl.type = "password";
      return text.setPlaceholder("AIza\u2026").setValue(this.plugin.settings.geminiKey).onChange(async (value) => {
        this.plugin.settings.geminiKey = value;
        await this.plugin.saveSettings();
      });
    }).addButton(
      (btn) => btn.setButtonText("Validate").onClick(async () => {
        const key = this.plugin.settings.geminiKey;
        if (!key) {
          new import_obsidian.Notice("\u274C Enter a Gemini API key first.");
          return;
        }
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: "KnowledgeFlow key check" }] }
              })
            }
          );
          if (resp.ok) {
            new import_obsidian.Notice("\u2705 Gemini API key is valid!");
          } else {
            const err = await resp.json().catch(() => ({}));
            new import_obsidian.Notice(`\u274C Invalid key: ${err.error?.message ?? resp.status}`);
          }
        } catch {
          new import_obsidian.Notice("\u274C Network error \u2014 is Obsidian online?");
        }
      })
    );
    const tokenSetting = new import_obsidian.Setting(containerEl).setName("Authorization Token").setDesc(
      "Paste this token into the Chrome Extension options page. The token is shown below and copied to your clipboard automatically."
    ).addButton(
      (btn) => btn.setButtonText("Generate Token").onClick(async () => {
        const rawToken = crypto.randomUUID();
        const hash = await hashToken(rawToken);
        this.plugin.settings.authTokenHash = hash;
        await this.plugin.saveSettings();
        tokenDisplay.value = rawToken;
        tokenRow.style.display = "flex";
        try {
          await navigator.clipboard.writeText(rawToken);
          new import_obsidian.Notice("\u{1F511} Token generated and copied to clipboard!");
        } catch {
          new import_obsidian.Notice("\u{1F511} Token generated \u2014 copy it from the field below.");
        }
      })
    );
    const tokenRow = containerEl.createDiv({
      attr: { style: "display:none; align-items:center; gap:8px; margin-top:6px; margin-bottom:12px;" }
    });
    const tokenDisplay = tokenRow.createEl("input", {
      type: "text",
      attr: {
        readonly: "true",
        style: "flex:1; font-family:monospace; font-size:12px; padding:4px 8px; border:1px solid var(--background-modifier-border); border-radius:4px; background:var(--background-secondary); color:var(--text-normal); cursor:text;",
        placeholder: "Token appears here after generation\u2026"
      }
    });
    const copyBtn = tokenRow.createEl("button", {
      text: "Copy",
      attr: { style: "padding:4px 12px; border-radius:4px; cursor:pointer;" }
    });
    copyBtn.addEventListener("click", async () => {
      if (!tokenDisplay.value) return;
      await navigator.clipboard.writeText(tokenDisplay.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2e3);
    });
    tokenRow.appendChild(tokenDisplay);
    tokenRow.appendChild(copyBtn);
    new import_obsidian.Setting(containerEl).setName("Local Port").setDesc("The port the plugin HTTP server listens on (default: 37321). Requires Obsidian restart.").addText(
      (text) => text.setPlaceholder("37321").setValue(String(this.plugin.settings.port)).onChange(async (value) => {
        const port = parseInt(value, 10);
        if (!Number.isNaN(port) && port > 0 && port < 65536) {
          this.plugin.settings.port = port;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Similarity Threshold").setDesc(
      "Cosine similarity score (0\u20131) below which a new note is auto-created instead of routing (default: 0.70)."
    ).addSlider(
      (slider) => slider.setLimits(0, 1, 0.01).setValue(this.plugin.settings.threshold).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.threshold = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("LLM Validation").setDesc(
      "When enabled, uses Gemini Flash to validate routing and generate a justification. Disable to save quota."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.llmValidationEnabled).onChange(async (value) => {
        this.plugin.settings.llmValidationEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Auto-Sync").setDesc(
      "When enabled, the plugin continuously embeds new and modified notes in the background."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoSyncEnabled).onChange(async (value) => {
        this.plugin.settings.autoSyncEnabled = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/main.ts
var PLUGIN_VERSION = "0.1.0";
var KnowledgeFlowPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_PLUGIN_SETTINGS };
    this.httpServer = null;
    // Filled in by later issues:
    // private vectorSync: VectorSync;
    // private clipLog: ClipLog;
    // private routingPipeline: RoutingPipeline;
    // Daily quota counter — persisted in plugin data, reset at UTC midnight
    this.callsToday = 0;
    this.lastQuotaDate = "";
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new KnowledgeFlowSettingTab(this.app, this));
    this.startServer();
  }
  onunload() {
    this.stopServer();
  }
  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  async loadSettings() {
    const saved = await this.loadData();
    const settingsSource = saved && typeof saved === "object" && "settings" in saved ? saved.settings : saved ?? {};
    this.settings = Object.assign({}, DEFAULT_PLUGIN_SETTINGS, settingsSource);
    this.callsToday = saved?.callsToday ?? 0;
    this.lastQuotaDate = saved?.lastQuotaDate ?? "";
    this.resetQuotaIfNewDay();
  }
  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      callsToday: this.callsToday,
      lastQuotaDate: this.lastQuotaDate
    });
  }
  // ---------------------------------------------------------------------------
  // Daily quota tracking
  // ---------------------------------------------------------------------------
  resetQuotaIfNewDay() {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (this.lastQuotaDate !== today) {
      this.callsToday = 0;
      this.lastQuotaDate = today;
    }
  }
  incrementApiCalls(n = 1) {
    this.resetQuotaIfNewDay();
    this.callsToday += n;
    this.saveSettings();
  }
  // ---------------------------------------------------------------------------
  // HTTP Server
  // ---------------------------------------------------------------------------
  buildServerDeps() {
    return {
      getAuthHash: () => this.settings.authTokenHash,
      getPluginVersion: () => PLUGIN_VERSION,
      getIsIndexing: () => false,
      // TODO: wire VectorSync.isIndexing
      getCachedNoteCount: () => 0,
      // TODO: wire VectorStore.size
      getDailyQuotaRemaining: () => {
        this.resetQuotaIfNewDay();
        return Math.max(0, 1500 - this.callsToday);
      },
      getLastIndexedAt: () => null,
      // TODO: wire VectorSync.lastIndexedAt
      getQueuedClipsCount: () => 0,
      // TODO: wire ClipQueue.size
      getRecentClips: () => [],
      // TODO: wire ClipLog.getRecent
      handleClip: async (req) => {
        return {
          success: true,
          clipId: crypto.randomUUID(),
          matchedPath: "",
          justification: null
        };
      }
    };
  }
  startServer() {
    if (this.httpServer) return;
    const deps = this.buildServerDeps();
    this.httpServer = createServer(deps);
    this.httpServer.listen(this.settings.port, "127.0.0.1", () => {
      console.log(`[KnowledgeFlow] HTTP server listening on 127.0.0.1:${this.settings.port}`);
    });
    this.httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        new import_obsidian2.Notice(
          `[KnowledgeFlow] Port ${this.settings.port} is already in use. Change the port in settings.`
        );
      } else {
        console.error("[KnowledgeFlow] Server error:", err);
      }
    });
  }
  stopServer() {
    if (!this.httpServer) return;
    const serverToClose = this.httpServer;
    this.httpServer = null;
    serverToClose.close(() => {
      console.log("[KnowledgeFlow] HTTP server stopped.");
    });
  }
};
//# sourceMappingURL=main.js.map
