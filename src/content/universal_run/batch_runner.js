console.log('[ELH-helper] [universal_run/batch_runner.js] Loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ELH_BATCH_RUN_STEP') {
        console.log('[ELH-helper] [universal_run/batch_runner.js] Received batch step:', message);
        if (message.action === 'ELH_BATCH_RUN_STEP') {
            console.log('[ELH-helper] [universal_run/batch_runner.js] Received batch step:', message);
            handleBatchStep(message.data, message.progress)
                .then((result) => {
                    markOverlayAsComplete(message.progress, result); // Pass result stats
                    sendResponse({ success: true, stats: result });
                })
                .catch(err => {
                    console.error('[ELH-helper] [universal_run/batch_runner.js] Error:', err);
                    sendResponse({ success: false, error: err.message });
                });
            return true; // Keep channel open
        }
    }
});

async function handleBatchStep(jsonData, progress) {
    if (progress) {
        showProgressOverlay(progress);
    }
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
        const result = await RoomMapper.handle(step, jsonData, document.body);
        console.log('[ELH-helper] [universal_run/batch_runner.js] Paste complete. Result:', result);
        return result;

    } catch (e) {
        console.error('[ELH-helper] [universal_run/batch_runner.js] Failed to run mapper:', e);
        throw e;
    }
}

function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => btn.textContent.includes(text));
}

function showProgressOverlay(progress) {
    // Check if overlay already exists
    let overlay = document.getElementById('elh-batch-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'elh-batch-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '20px';
        overlay.style.right = '20px';
        overlay.style.zIndex = '999999';
        overlay.style.background = 'rgba(0, 0, 0, 0.85)';
        overlay.style.color = 'white';
        overlay.style.padding = '15px 20px';
        overlay.style.borderRadius = '8px';
        overlay.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        overlay.style.fontFamily = 'sans-serif';
        overlay.style.fontSize = '14px';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.gap = '5px';
        overlay.style.pointerEvents = 'none'; // Click-through
        document.body.appendChild(overlay);
    }

    const { current, total } = progress || { current: '?', total: '?' };

    // Clear previous if any
    overlay.innerHTML = '';

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '5px';

    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; color: #4ade80;">
            <div style="animation: spin 1s linear infinite; font-size: 16px;">↻</div>
            <strong>Batch Runner in progress</strong>
        </div>
        <div>Processing room <b>${current}</b> of <b>${total}</b>...</div>
        <div id="elh-batch-warning" style="font-size: 11px; opacity: 0.7; margin-top: 4px;">Please do not close this tab.</div>
        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
        </style>
    `;

    // Button Container
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '5px';
    btnContainer.style.marginTop = '8px';

    const createBtn = (text, bg) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.padding = '4px 8px';
        b.style.fontSize = '12px';
        b.style.color = 'white';
        b.style.background = bg;
        b.style.border = 'none';
        b.style.borderRadius = '4px';
        b.style.cursor = 'pointer';
        b.style.pointerEvents = 'auto';
        return b;
    };

    const pauseBtn = createBtn('❚❚ Pause', '#f59e0b'); // Warning/Amber
    const resumeBtn = createBtn('▶︎ Resume', '#16a34a'); // Primary/Green
    const stopBtn = createBtn('■ Stop', '#dc2626'); // Danger/Red

    // Initial State: Running -> Show Pause
    resumeBtn.style.display = 'none';
    stopBtn.style.display = 'none';

    pauseBtn.onclick = () => {
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'inline-block';
        stopBtn.style.display = 'inline-block';

        // Update text to indicate paused state
        // Maybe change the "Batch Runner in progress" text too?
        // But for now just buttons as requested.
        chrome.runtime.sendMessage({ action: 'ELH_BATCH_PAUSE' });
    };

    resumeBtn.onclick = () => {
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        chrome.runtime.sendMessage({ action: 'ELH_BATCH_RESUME' });
    };

    stopBtn.onclick = () => {
        stopBtn.textContent = 'Stopping...';
        stopBtn.disabled = true;
        resumeBtn.disabled = true;
        chrome.runtime.sendMessage({ action: 'ELH_BATCH_FORCE_STOP' });
    };

    btnContainer.appendChild(pauseBtn);
    btnContainer.appendChild(resumeBtn);
    btnContainer.appendChild(stopBtn);
    container.appendChild(btnContainer);
    overlay.appendChild(container);
}

function markOverlayAsComplete(progress, stats) {
    const overlay = document.getElementById('elh-batch-overlay');
    if (!overlay) return;

    const { current, total } = progress || { current: '?', total: '?' };

    overlay.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; color: #4ade80;">
            <div style="font-size: 16px;">✓</div>
            <strong>Processed</strong>
        </div>
        <div style="margin-top:4px;">Room <b>${current}</b> of <b>${total}</b> is done.</div>
    `;

    // Show Old Dates
    if (stats && stats.old_dates && stats.old_dates.length > 0) {
        let datesHtml = stats.old_dates.map(d => `<div style="font-size:10px; color:#aaa; margin-top:2px;">${d}</div>`).join('');
        overlay.innerHTML += `<div style="margin-top:8px; padding-top:4px; border-top:1px solid #444;">Previous dates: ${datesHtml}</div>`;
    }

    // Remove background opacity or change it to be less intrusive?
    // User requested: "changes design... disappears warning... disappears stop button"
    // The innerHTML replacement handles disappearing Stop/Warning.
    // Let's make it fade out after a few seconds?
    // Maybe not requested, but good UX.
    // User requested: "changes design... disappears warning... disappears stop button"
    // The innerHTML replacement handles disappearing Stop/Warning.
    // Opacity change removed as per user request.
}
