console.log('[ELH-helper] [universal_run/batch_runner.js] Loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ELH_BATCH_RUN_STEP') {
        console.log('[ELH-helper] [universal_run/batch_runner.js] Received batch step:', message);
        handleBatchStep(message.data)
            .then(() => sendResponse({ success: true }))
            .catch(err => {
                console.error('[ELH-helper] [universal_run/batch_runner.js] Error:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true; // Keep channel open
    }
});

async function handleBatchStep(jsonData) {
    if (!jsonData) throw new Error('No JSON data provided.');

    // 1. Check if we need to go to "Blocked Dates"
    // The user specifically asked for this flow: Open URL -> Click Blocked Dates -> Paste
    // We assume the URL opened by the background/options page lands us on the Listing or Room page.

    // Attempt to find the "Blocked Dates" button.
    // Selector strategy: find a button that contains a span with "Blocked Dates"
    const blockedDatesBtn = findButtonByText('Blocked Dates');

    if (blockedDatesBtn) {
        console.log('[ELH-helper] [universal_run/batch_runner.js] Found "Blocked Dates" button. Clicking...');
        blockedDatesBtn.click();

        // 2. Wait for navigation/update
        // We can wait a fixed time or wait for a specific element (like the calendar).
        // Let's wait 1.5 seconds for safe measure + element check
        await new Promise(r => setTimeout(r, 1500));
    } else {
        console.warn('[ELH-helper] [universal_run/batch_runner.js] "Blocked Dates" button not found. Assuming we are already there or it is not needed.');
    }

    // 3. Paste JSON
    // We need to use the existing RoomMapper.
    // Since we are in a module content script, we can try to import it.
    // Path relative to this file: ../universal_json/mappings/room.js

    try {
        console.log('[ELH-helper] [universal_run/batch_runner.js] Importing RoomMapper...');
        const module = await import(chrome.runtime.getURL('src/content/universal_json/mappings/room.js'));
        const RoomMapper = module.RoomMapper;

        if (!RoomMapper) throw new Error('RoomMapper not found in module.');

        // The step name for blocked dates in RoomMapper might be 'BlockedDatesStep' or similar.
        // We can inspect the JSON to see what keys it has, OR just run the mapper generally.
        // RoomMapper.handle usually takes (stepName, data, contextElement).
        // If we are on the page, contextElement might be document body or a specific container.

        // Let's assume RoomMapper can handle "auto" detection or we simply pass the step we expect.
        // However, RoomMapper.handle signature in button_injector was: handle(step, jsonData, element)

        // We'll try to detect the step or just pass 'BlockedDatesStep' if that's what we are targeting.
        // Inspecting the JSON:
        let step = 'unknown';
        if (jsonData.room_data && jsonData.room_data.BlockedDatesStep) {
            step = 'BlockedDatesStep';
        }

        console.log(`[ELH-helper] [universal_run/batch_runner.js] Executing RoomMapper for step: ${step}`);
        await RoomMapper.handle(step, jsonData, document.body);
        console.log('[ELH-helper] [universal_run/batch_runner.js] Paste complete.');

    } catch (e) {
        console.error('[ELH-helper] [universal_run/batch_runner.js] Failed to run mapper:', e);
        throw e;
    }
}

function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => btn.textContent.includes(text));
}
