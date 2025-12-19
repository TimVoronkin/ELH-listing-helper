// src/content/universal_json/loader.js
(async () => {
    try {
        const src = chrome.runtime.getURL('src/content/universal_json/main.js');
        console.log('[ELH-helper] [universal_json/loader.js] Dynamically importing:', src);
        await import(src);
    } catch (e) {
        console.error('[ELH-helper] [universal_json/loader.js] Failed to load main module:', e);
    }
})();
