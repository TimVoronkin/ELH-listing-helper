// openTabsHandler.js - background service worker handler for opening tabs in background
console.log('[ELH-helper] [openTabsHandler] service worker loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'openTabsInBackground' || !Array.isArray(message.urls)) {
    return;
  }

  const urls = message.urls;
  console.log('[ELH-helper] [openTabsHandler] background handler: opening', urls.length, 'tabs in background');

  // Open each URL with a small delay to avoid focus/throttling issues
  let delay = 0;
  for (const url of urls) {
    setTimeout(() => {
      chrome.tabs.create({ url: url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn('[ELH-helper] [openTabsHandler] Failed to create tab for', url, chrome.runtime.lastError);
        } else {
          console.log('[ELH-helper] [openTabsHandler] opened tab in background:', url, 'tabId:', tab.id);
        }
      });
    }, delay);
    delay += 150; // 150ms between tab creations
  }

  sendResponse({ success: true, count: urls.length });
});
