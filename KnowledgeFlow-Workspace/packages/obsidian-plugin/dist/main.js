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

// src/vector-store.ts
var VectorStore = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
  }
  /** Number of entries currently in the store. */
  get size() {
    return this.cache.size;
  }
  /** Insert or replace an entry by vaultPath. */
  upsert(entry) {
    this.cache.set(entry.vaultPath, entry);
  }
  /** Remove an entry by vaultPath. No-op if not found. */
  delete(vaultPath) {
    this.cache.delete(vaultPath);
  }
  /** Return all entries as an array (order not guaranteed). */
  getAll() {
    return Array.from(this.cache.values());
  }
  /**
   * Replace all entries atomically (used when deserializing the cache file
   * on startup). Clears any existing in-memory state first.
   */
  loadAll(entries) {
    this.cache.clear();
    for (const e of entries) {
      this.cache.set(e.vaultPath, e);
    }
  }
  /**
   * Linear cosine-similarity scan across all entries.
   * Returns the top-k entries sorted by descending similarity.
   *
   * Both `queryVector` and stored embeddings are assumed to be pre-normalised.
   * Cosine similarity reduces to a dot product for unit vectors.
   */
  findTopK(queryVector, k) {
    const scored = [];
    for (const entry of this.cache.values()) {
      const similarity = dotProduct(queryVector, entry.embedding);
      scored.push({ ...entry, similarity });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, k);
  }
};
function dotProduct(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// src/vector-sync.ts
var VectorSync = class {
  constructor(deps) {
    this.isIndexing = false;
    this.lastIndexedAt = null;
    this.debounceTimers = /* @__PURE__ */ new Map();
    this.vault = deps.vault;
    this.vectorStore = deps.vectorStore;
    this.getSettings = deps.getSettings;
    this.plugin = deps.plugin;
    this.statusBarItem = deps.statusBarItem;
    this.embedder = deps.embedder;
    this.getDailyQuotaRemaining = deps.getDailyQuotaRemaining;
    this.cachePath = this.plugin.manifest.dir + "/vector-cache.json";
    this.registerEvents();
  }
  registerEvents() {
    this.plugin.registerEvent(this.vault.on("modify", (file) => {
      if (!("extension" in file) || file.extension !== "md") return;
      if (!this.getSettings().autoSyncEnabled) return;
      const existingTimer = this.debounceTimers.get(file.path);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        this.batchEmbed([file]).catch((e) => {
          console.error("Failed to embed modified file", e);
          this.setStatus("offline");
        });
        this.debounceTimers.delete(file.path);
      }, 5e3);
      this.debounceTimers.set(file.path, timer);
    }));
    this.plugin.registerEvent(this.vault.on("create", (file) => {
      if (!("extension" in file) || file.extension !== "md") return;
      if (!this.getSettings().autoSyncEnabled) return;
      this.batchEmbed([file]).catch((e) => {
        console.error("Failed to embed new file", e);
        this.setStatus("offline");
      });
    }));
    this.plugin.registerEvent(this.vault.on("delete", (file) => {
      if (!("extension" in file) || file.extension !== "md") return;
      this.vectorStore.delete(file.path);
      this.saveCache();
    }));
  }
  async start() {
    this.setStatus("syncing");
    await this.loadCache();
    const files = this.vault.getMarkdownFiles();
    const toEmbed = [];
    for (const file of files) {
      const entry = this.vectorStore.getAll().find((e) => e.vaultPath === file.path);
      if (!entry || file.stat.mtime > entry.updatedAt) {
        toEmbed.push(file);
      }
    }
    try {
      if (toEmbed.length > 0) {
        await this.batchEmbed(toEmbed);
      }
      this.setStatus("synced");
    } catch (e) {
      console.error("Vector sync failed on startup:", e);
      this.setStatus("offline");
    }
  }
  async loadCache() {
    try {
      if (await this.vault.adapter.exists(this.cachePath)) {
        const data = await this.vault.adapter.read(this.cachePath);
        if (data) {
          const entries = JSON.parse(data);
          this.vectorStore.loadAll(entries);
        }
      }
    } catch (e) {
      console.error("Failed to load vector cache", e);
    }
  }
  async saveCache() {
    try {
      const data = JSON.stringify(this.vectorStore.getAll());
      await this.vault.adapter.write(this.cachePath, data);
    } catch (e) {
      console.error("Failed to save vector cache", e);
    }
  }
  async batchEmbed(files) {
    const texts = await Promise.all(files.map(async (file) => {
      const content = await this.vault.read(file);
      const stripped = this.stripFrontmatter(content);
      const words = stripped.split(/\s+/).slice(0, 200).join(" ");
      return file.basename + "\n" + words;
    }));
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
  stripFrontmatter(content) {
    const match = content.match(/^---\n[\s\S]*?\n---\n/);
    if (match) {
      return content.slice(match[0].length);
    }
    return content;
  }
  setStatus(state) {
    if (state === "syncing") {
      this.isIndexing = true;
      this.statusBarItem.setText("\u23F3 syncing");
    } else if (state === "synced") {
      this.isIndexing = false;
      this.lastIndexedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.statusBarItem.setText("\u2705 synced");
    } else {
      this.isIndexing = false;
      this.statusBarItem.setText("\u26D4 offline");
    }
    this.updateTooltip();
  }
  updateTooltip() {
    const quota = this.getDailyQuotaRemaining().toLocaleString("en-US");
    const count = this.vectorStore.size.toLocaleString("en-US");
    const lastDate = this.lastIndexedAt ? new Date(this.lastIndexedAt).toLocaleTimeString("en-US") : "Never";
    const tooltip = `Last indexed: ${lastDate}
${count} notes cached
${quota} API calls remaining today`;
    this.statusBarItem.setAttribute("aria-label", tooltip);
  }
};

// src/gemini-api.ts
async function getBatchEmbeddings(texts, apiKey) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;
  const body = {
    requests: texts.map((text) => ({
      model: "models/gemini-embedding-2",
      content: {
        parts: [{ text }]
      }
    }))
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }
  const data = await response.json();
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error("Invalid response from Gemini API");
  }
  return data.embeddings.map((e) => e.values);
}

// src/main.ts
var PLUGIN_VERSION = "0.1.0";
var KnowledgeFlowPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_PLUGIN_SETTINGS };
    this.httpServer = null;
    this.callsToday = 0;
    this.lastQuotaDate = "";
  }
  // Filled in by later issues:
  // private clipLog: ClipLog;
  // private routingPipeline: RoutingPipeline;
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new KnowledgeFlowSettingTab(this.app, this));
    this.vectorStore = new VectorStore();
    const statusBarItem = this.addStatusBarItem();
    this.vectorSync = new VectorSync({
      vault: this.app.vault,
      vectorStore: this.vectorStore,
      getSettings: () => this.settings,
      plugin: this,
      statusBarItem,
      embedder: async (texts) => {
        const embeddings = await getBatchEmbeddings(texts, this.settings.geminiKey);
        this.incrementApiCalls(1);
        return embeddings;
      },
      getDailyQuotaRemaining: () => this.getDailyQuotaRemaining()
    });
    this.vectorSync.start();
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
  getDailyQuotaRemaining() {
    this.resetQuotaIfNewDay();
    return Math.max(0, 1500 - this.callsToday);
  }
  // ---------------------------------------------------------------------------
  // HTTP Server
  // ---------------------------------------------------------------------------
  buildServerDeps() {
    return {
      getAuthHash: () => this.settings.authTokenHash,
      getPluginVersion: () => PLUGIN_VERSION,
      getIsIndexing: () => this.vectorSync?.isIndexing ?? false,
      getCachedNoteCount: () => this.vectorStore?.size ?? 0,
      getDailyQuotaRemaining: () => this.getDailyQuotaRemaining(),
      getLastIndexedAt: () => this.vectorSync?.lastIndexedAt ?? null,
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
