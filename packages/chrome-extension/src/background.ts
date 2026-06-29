// packages/chrome-extension/src/background.ts
// KnowledgeFlow – Background Service Worker
//
// Handles the keyboard shortcut command and forwards it to the active tab's
// content script. If the tab was open before the extension loaded (so the
// content script was never injected), we fall back to scripting.executeScript
// to inject it on-demand before sending the message.

chrome.commands.onCommand.addListener(async (command: string) => {
  if (command !== 'trigger-clip') return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  try {
    // Fast path: content script is already running in this tab.
    await chrome.tabs.sendMessage(activeTab.id, { type: 'show-clip-popup' });
  } catch {
    // Slow path: tab was open before extension loaded — inject the content
    // script now, then retry the message.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['dist/content.js'],
      });
      await chrome.tabs.sendMessage(activeTab.id, { type: 'show-clip-popup' });
    } catch {
      // Protected page (chrome://, edge://, etc.) — nothing we can do.
    }
  }
});
