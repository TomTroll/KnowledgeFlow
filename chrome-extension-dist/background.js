"use strict";
(() => {
  // src/background.ts
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "trigger-clip") return;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: "show-clip-popup" });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["dist/content.js"]
        });
        await chrome.tabs.sendMessage(activeTab.id, { type: "show-clip-popup" });
      } catch {
      }
    }
  });
})();
//# sourceMappingURL=background.js.map
