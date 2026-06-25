# KnowledgeFlow — Stage 1: Intelligent Web Clipper (Optimized Local-First Edition)

**Triage-Label:** `ready-for-agent`

---

## Problem Statement

When a student or researcher finds a useful passage while browsing the web, capturing it correctly requires an expensive context switch: they must stop reading, switch to Obsidian, navigate to the exact right note, paste the text, format it, add a source URL, and decide where in the note it belongs. Most people don't do all of this — they either skip the capture entirely or dump everything into a generic inbox that never gets processed. The result is that valuable information is lost or siloed, disconnected from the evolving knowledge structure it was meant to enrich.

---

## Solution

A two-component, local-first architecture eliminates the filing problem entirely without the friction of external cloud hosting or user account creation.

A **Chrome Extension** captures highlighted web text and communicates directly via a secure `localhost` connection with an **Obsidian Plugin** running in the background. The plugin runs a built-in local HTTP server, manages a lightweight local vector index backed by a serialized JSON file, and orchestrates a highly optimized API pipeline to the user's personal free-tier Google AI Studio (Gemini) account.

When a clip is received, the system computes cosine similarity locally across the vector cache to find the top-5 candidate notes, optionally validates the winner via a Gemini Flash LLM call (configurable), performs an array-batched semantic drill-down to identify the precise paragraph context, and physically inserts the clip directly into the local Markdown file. The entire process keeps data completely local and private and requires zero cloud configuration beyond a personal Gemini API key.

### Architectural Overview

```
[ Chrome Extension ] --(Local HTTP / Bearer Token)--> [ Obsidian Plugin (Localhost Server) ]
                                                                   |
  [ Local Vault Markdown Files ] <--(app.vault.process)------------+---->(Personal Gemini API)
```

---

## User Stories

### Web Clipping — Keyboard Shortcut & Inline Popup

1. As a researcher, I want to trigger the "Save to Vault" popup via **Cmd/Ctrl + Shift + S** after selecting text, so that the extension UI only appears when I intentionally want to clip content.
2. As a researcher, I want the popup to appear within 200 ms of the shortcut trigger, so that my reading flow is not interrupted.
3. As a researcher, I want the popup to display a preview of the first 100 characters of my selection, so that I can confirm the right content is about to be saved.
4. As a researcher, I want an optional tag input in the popup, so that I can add lightweight metadata to a clip without filing it manually.
5. As a researcher, I want an optional comment field (collapsed by default, expandable on click) in the popup, so that I can annotate a clip with my own reaction or interpretation.
6. As a researcher, I want a **microphone toggle** in the popup that uses the **Web Speech API** to capture a voice annotation and transcribe it to text in the browser, so that I can append my intent (e.g., "Add this to the related work section") hands-free without any audio file being transmitted to the server.
7. As a researcher, I want to save a clip with a single button press, so that the entire capture takes less than two seconds of my attention.
8. As a researcher, I want to see a loading spinner while the plugin processes the routing, so that I have visual confirmation the system is working.
9. As a researcher, I want a success toast after saving that shows the matched note name and, when LLM validation is enabled, the AI's one-sentence routing justification, so that I can immediately verify the routing decision.
10. As a researcher, I want an error toast with clear retry guidance if the connection to `localhost` fails or if the Gemini API rate limit is hit, so that I understand what went wrong and how to resolve it.
11. As a researcher, I want to dismiss the popup by clicking outside it or pressing Escape, so that it never permanently blocks my reading.

> [!NOTE]
> All user stories referring to "popup" refer to the **Shadow DOM** inline popup injected by the content script — not the browser action popup. Voice input (US #6) must be transcribed to text entirely within the browser before the payload is sent to the Obsidian plugin.

### Extension Popup & Options

12. As a researcher, I want to open the extension action popup from the browser toolbar and see my ten most recent clips fetched live from the Obsidian plugin, so that I can glance at what I have saved without opening Obsidian.
13. As a researcher, I want the extension popup to clearly display an "Obsidian Offline" state when the localhost server is unreachable, so that I always understand system status.
14. As a researcher, I want an extension options page where I configure the `localhost` port and paste my local authorization token, so that the extension securely pairs with my active Obsidian vault.
15. As a researcher, I want a "Test Connection" button on the options page that validates live communication with the local Obsidian server, so that I know the extension is correctly configured before I start clipping.

### Obsidian Plugin — Differential Vault Sync & Indexing

16. As an Obsidian user, I want the plugin to perform a differential metadata sync on startup by checking modified timestamps (`mtime`) against a local cache, so that only new or edited notes are re-embedded and my daily API quota is not wasted on unchanged content.
17. As an Obsidian user, I want the initial indexing of a large vault to be processed in sequential batches of 100 notes per API call to the batch embedding endpoint, so that my personal Gemini free-tier daily quota is never exhausted during setup.
18. As an Obsidian user, I want note changes to update the local vector index within 5 seconds of a file save, so that the index is constantly fresh for routing.
19. As an Obsidian user, I want deleted notes to be purged from the local vector index instantly on the `vault.on('delete')` event, so that the system never routes clips to dead links.
20. As an Obsidian user, I want a sync status indicator in Obsidian's bottom status bar showing a live icon (✅ synced / ⏳ syncing / ⛔ offline) with the last index timestamp, cached note count, and remaining daily API quota estimate visible on hover, so that I can monitor index health at a glance.
21. As an Obsidian user, I want an auto-sync toggle in the plugin settings, so that I can disable all background embedding activity when working completely offline.

### Obsidian Plugin — Authentication & Configuration

22. As an Obsidian user, I want to generate a local authorization token from the plugin settings with one click, so that I can securely pair the Chrome Extension with my vault without configuring external credentials.
23. As an Obsidian user, I want to enter my personal Google AI Studio (Gemini) API key directly into the plugin settings, so that all AI operations run inside my own free-tier limits.
24. As an Obsidian user, I want the plugin to validate my Gemini API key on entry via a test embedding call and display immediate success or failure visual feedback, so that I can catch misconfiguration before attempting to use the system.
25. As an Obsidian user, I want an LLM Validation toggle in the plugin settings, so that I can disable the Flash routing justification call to save API quota when I trust the embedding-only routing.

### Intelligent Clip Insertion

26. As an Obsidian user, I want saved clips to be written directly to my local Markdown files using Obsidian's native `app.vault.process()` API, so that safe, concurrent-write-safe modifications are guaranteed and never collide with background cloud sync providers.
27. As an Obsidian user, I want each clip inserted immediately after the paragraph most semantically similar to the clip, determined through a header-then-paragraph drill-down using array-batched embedding calls, so that the clip lands in a contextually precise location without exhausting my API quota.
28. As an Obsidian user, I want each inserted clip formatted as an Obsidian `[!quote]` callout block containing the clipped text, a hyperlinked source URL, an ISO timestamp, and any user-provided tags as Dataview-compatible inline fields, so that clips are natively rendered, searchable, and queryable.
29. As an Obsidian user, I want clips whose top cosine similarity score falls below 0.70 (configurable) to automatically generate a new note with an AI-generated title and an implicit `#kf-inbox` tag, so that low-confidence clips are safely captured for later review rather than misrouted.
30. As an Obsidian user, I want the auto-generated note title to be produced within the same Flash validation call (via an optional `suggestedTitle` field in the JSON response), so that no additional API call is consumed for this operation.

### Rate Limit Handling

31. As an Obsidian user, I want the plugin to accept an incoming clip immediately and queue it when the Gemini rate limit is hit, so that the capture is never lost.
32. As a researcher, I want a persistent countdown banner in the extension popup and a Notice in Obsidian showing the retry timer when a clip is queued due to rate limiting, so that I understand the system is working and when to expect completion.
33. As an Obsidian user, I want queued clips to be retried automatically after the rate-limit reset window, so that I never have to manually intervene.

### Clip History — Extension & Obsidian Views

34. As a researcher, I want the extension action popup to fetch and display my ten most recent clips from the Obsidian plugin via `GET /clips`, so that clip history is always sourced from a single source of truth.
35. As an Obsidian user, I want to open a searchable, filterable "Clip History" leaf view inside Obsidian to review all past clips in one place.
36. As an Obsidian user, I want each history row to feature an **Undo / Relocate** button, so that I can instantly pull a clip out of an incorrect note and move it to the right destination if the AI routing made a mistake.
37. As an Obsidian user, I want the Undo action to remove the callout block from the target file using `vault.process`, searching by the clip's unique embedded ID, so that removal is always safe and precise regardless of subsequent edits to the file.
38. As an Obsidian user, I want the Relocate action to open Obsidian's built-in fuzzy-note-search modal so I can select the correct destination note with minimal friction.

---

## Implementation Decisions

### Repository & Build Structure

- **Monorepo** using npm workspaces with three packages:
  - `packages/shared` — TypeScript interfaces for `ClipRequest`, `ClipResponse`, `StatusResponse`, `ClipLogEntry`, and all shared payload shapes. Both other packages depend on this.
  - `packages/obsidian-plugin` — Plugin source code.
  - `packages/chrome-extension` — Extension source code.
- **Build tooling:** TypeScript and esbuild for both packages. The extension uses esbuild's `entryPoints` array to produce separate bundles for the Service Worker, content script, options page, and action popup.
- **Single `tsconfig.json`** at the root with path aliases for the `shared` package.

### Chrome Extension Architecture

- **Manifest V3** with a Service Worker background script.
- **Keyboard shortcut flow:**
  1. Service Worker receives `chrome.commands.onCommand` for `Ctrl/Cmd+Shift+S`.
  2. It sends a message to the content script in the active tab via `chrome.tabs.sendMessage`.
  3. The content script reads `window.getSelection()`, then injects the clipping popup into the page DOM.
- **Popup rendering:** The content script injects a floating popup element wrapped in a **Shadow DOM** to fully isolate styles from the host page. This is the only path that meets the 200 ms appearance SLA. The popup includes a text area for contextual annotations and a **microphone toggle** powered by the **Web Speech API** for voice input, which is transcribed to text in the browser before the payload is dispatched.
- **Configuration storage:** `chrome.storage.sync` holds port number and raw authorization token.

### Obsidian Plugin Architecture

- **Desktop-only** plugin. The HTTP server is instantiated via `require('http')` (Node.js), accessible in the Electron runtime that powers Obsidian desktop. This is the established pattern used by existing community plugins.
- **HTTP server** listens exclusively on `127.0.0.1:<port>` (default `37321`). All endpoints require `Authorization: Bearer <token>`.
- **Plugin data** is persisted via Obsidian's `this.loadData()` / `this.saveData()` API, which handles serialization and backs data up with vault sync automatically.

### API Surface (Localhost Server)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/clip` | Accept clip payload, run the routing pipeline, return matched note + justification |
| `GET` | `/status` | Return plugin version and active indexing state (used by extension options "Test Connection") |
| `GET` | `/clips` | Return last 10 `ClipLogEntry` objects (used by extension action popup history view) |

All endpoints return JSON. Unauthenticated requests receive `401 Unauthorized`. Rate-limited clips receive `202 Accepted` with a `retryAfter` field; the extension polls for completion.

### Local Data Schemas

```typescript
// packages/shared/types.ts (decision-encoding prototype — trimmed to key shapes)

interface VectorCacheEntry {
  vaultPath: string;
  title: string;
  embedding: number[];          // 768-dimensional, text-embedding-004
  updatedAt: number;            // mtime Unix ms
}

interface ClipLogEntry {
  id: string;                   // crypto.randomUUID() — also embedded in callout for Undo
  sourceUrl: string;
  pageTitle: string;
  selectedText: string;
  timestamp: string;            // ISO 8601
  matchedPath: string;
  justification: string | null; // null when LLM validation is disabled
  tags: string[];
  comment: string;
  status: 'inserted' | 'undone' | 'relocated';
}

interface PluginSettings {
  geminiKey: string;
  authTokenHash: string;        // SHA-256 of the raw token; raw token shown once in UI
  port: number;                 // default 37321
  threshold: number;            // cosine similarity, default 0.70
  llmValidationEnabled: boolean;
  autoSyncEnabled: boolean;
}
```

### Vector Store

- In-memory JavaScript array of `VectorCacheEntry` objects.
- Deserialized from a `vector-cache.json` file inside the plugin data directory on startup.
- Serialized back on every update (differential saves only the changed entry).
- Cosine similarity computed via a local dot-product loop — sub-10 ms for vaults up to 5,000 notes.

### Embedding Model

- Model: `text-embedding-004` at **768 dimensions** (default output dimensionality).
- Used for both vault indexing and clip embedding.
- Per-note indexing input: note title + first 200 words of body content (frontmatter stripped).

### Rate Limit & API Pipeline (4 Calls Per Clip)

To protect the user's free-tier quota (15 RPM / 1,500 RPD):

1. **Call 1 — Clip Embedding:** One call to `text-embedding-004` to embed the incoming clip text.
2. **Local Cosine Search:** Dot-product loop across the `VectorCache` array. Produces the top-5 candidate notes. No API call.
3. **Call 2 — LLM Validation (configurable):** When enabled, the clip + top-5 note titles/excerpts are sent to `gemini-1.5-flash` with a strict JSON schema response (`{ chosenPath: string, justification: string, suggestedTitle?: string }`). A guardrail validates that `chosenPath` is within the top-5 set; if not, the system falls back to the highest cosine-similarity winner. When LLM validation is disabled, this call is skipped (3 total calls).
4. **Call 3 — Section Batch Embedding:** The winning Markdown file is parsed into sections by `##` headers (frontmatter stripped). All section texts are compiled into one array-batch call to `text-embedding-004`. Local comparison finds the winning section.
5. **Call 4 — Paragraph Batch Embedding:** The winning section is split into paragraphs by double-newline. Code fences and tables are treated as atomic paragraphs. All paragraph texts are compiled into one array-batch call. Local comparison finds the winning paragraph index.

**Total: 4 API calls (or 3 when LLM validation is disabled).**

### Markdown Parsing Rules for Drill-Down

1. Strip frontmatter (content between leading `---` delimiters).
2. Split by `##` headings into sections. If no `##` headings exist, treat the whole note as one section.
3. Within each section, split by double-newline (`\n\n`) into paragraphs.
4. Code blocks (`` ``` `` fences) and Markdown tables are treated as single atomic paragraph units — they are never split and clips are never inserted inside them.

### Clip Callout Format

```markdown
> [!quote] Clip — 2026-06-19T14:22:29+02:00
> {{selected_text}}
>
> **Source:** [{{page_title}}]({{source_url}})
> **Tags:** #tag1 #tag2
> **Comment:** {{user_comment}}
> [clip-id:: {{id}}]
```

The hidden `[clip-id:: {{id}}]` Dataview inline field is the anchor used by the Undo mechanism to locate and remove the callout with `vault.process`.

### Authorization Token

- Generated via `crypto.randomUUID()` in the Obsidian plugin settings UI.
- The raw UUID is displayed once for the user to copy into the Chrome Extension options page.
- The **SHA-256 hash** of the raw token is stored in plugin settings. All incoming requests are validated by hashing the provided `Bearer` token and comparing to the stored hash.
- Uses the Web Crypto API (`crypto.subtle.digest`), available in both Electron and Chrome Extension contexts — zero dependencies.

### Real-Time Index Updates

- Listen to `vault.on('modify', file)` with a **5-second debounce per file path**. Rapid saves reset the timer; only the final save triggers a re-embedding call.
- Listen to `vault.on('delete', file)` with no debounce. The deleted note is synchronously removed from the in-memory cache and the serialized JSON.
- `vault.on('create', file)` triggers a fresh embedding call for new notes.

### Undo / Relocate Mechanism

- **Undo:** `vault.process` is called on the target file. The callback searches the current file content for the line `[clip-id:: {{id}}]`, identifies the enclosing callout block boundaries, removes the entire block, and returns the modified content. The `ClipLogEntry.status` is updated to `'undone'`.
- **Relocate:** Opens Obsidian's `FuzzySuggestModal` pre-populated with all vault notes. On selection, the clip callout is re-inserted into the chosen note at the end of the file (no re-routing pipeline), and `ClipLogEntry.status` is updated to `'relocated'`.

---

## Testing Decisions

Tests must validate external, observable system behavior — not internal variable states or private method calls. Mock at the network boundary (Gemini API calls), not inside business logic.

| Seam | Module | What is verified |
|------|--------|-----------------|
| **`POST /clip` HTTP Entry** | Obsidian Plugin | An unauthenticated request returns `401 Unauthorized`. A valid authenticated request with a mocked Gemini client returns `200 OK` containing `matchedNote` and `justification` fields. |
| **`GET /clips` History Endpoint** | Obsidian Plugin | Returns the last 10 `ClipLogEntry` objects in correct JSON shape after the log has been populated with test entries. |
| **Auth Token Validation** | Obsidian Plugin | SHA-256 comparison rejects a tampered token with `401`; accepts a valid raw token with `200`. |
| **Array-Batch Embedder** | Obsidian Plugin | A note with 30 paragraphs triggers exactly **1** network request to the Gemini batch embedding endpoint, not 30 separate calls. |
| **Safe Insertion Engine** | Obsidian Plugin | The `vault.process` callback, given a synthetic Markdown string and a target paragraph index, returns a string containing the correctly formatted callout block inserted at the right position, with no other content mutated. |
| **Extension Keyboard Shortcut → Payload** | Chrome Extension (Playwright) | Triggering `Ctrl+Shift+S` on an HTML fixture with a pre-selected text range causes the content script to produce a `POST /clip` network request to `localhost:37321` containing the correct `selectedText`, `sourceUrl`, and `tags` fields. |

**Testing frameworks:** Vitest for Obsidian plugin unit and integration tests; Playwright for the Chrome Extension end-to-end test.

---

## Out of Scope for Stage 1

- Support for cloud databases (Supabase, Firebase).
- Cross-device or mobile clipping (requires desktop browser + desktop Obsidian).
- Multi-vault switching from a single extension setup.
- Parsing non-text layout components (images, PDFs, audio, canvas frames).
- **Complex audio-file routing:** voice annotations must be transcribed to plain text in the browser via the Web Speech API before being sent to the plugin. No audio files are ever transmitted or stored.
- Full-text search inside the extension popup history view.
- Canvas or infinite whiteboard integrations.
- Publishing to the Chrome Web Store or the Obsidian community plugin directory.
- Any sync mechanism between vaults across machines.

---

## Further Notes

- The `GET /clips` endpoint is the single source of truth for clip history, eliminating any sync complexity between the plugin and the extension. The extension renders an "Obsidian Offline" state when the server is unreachable.
- The LLM validation toggle (User Story 25) also controls the auto-title generation pathway: when disabled, new notes created for below-threshold clips use `page_title + ISO timestamp` as their filename, since the Flash call that produces `suggestedTitle` is skipped.
- The daily quota estimate shown in the status bar item is computed locally: `1,500 - calls_today`, where `calls_today` is incremented and persisted in plugin data, reset at UTC midnight.
- Vault size sweet spot for the in-memory vector store is up to ~5,000 notes. Beyond this, cosine search time may exceed 50 ms; migrating to a more structured store (e.g., Orama) is a natural Stage 2 upgrade path without API changes.
