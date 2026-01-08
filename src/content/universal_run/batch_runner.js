console.log('[ELH-helper] [universal_run/batch_runner.js] Loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ELH_BATCH_RUN_STEP') {
        console.log('[ELH-helper] [universal_run/batch_runner.js] Received batch step:', message);
        handleBatchStep(message.data, message.progress)
            .then((result) => {
                markOverlayAsComplete(message.progress, result, message.data); // Pass result stats AND jsonData
                sendResponse({ success: true, stats: result });
            })
            .catch(err => {
                console.error('[ELH-helper] [universal_run/batch_runner.js] Error:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true; // Keep channel open
    }
    if (message.action === 'SAVE_AND_CLOSE') {
        handleSaveAndClose(message.validate);
    }
});

// Button Name Mapping (from User)
const STEP_BUTTON_MAP = {
    'FeaturesSteps': 'Room Features',       // or "Features"
    'PaymentSteps': 'Payment',              // or "Rental conditions"
    'BlockedDatesStep': 'Blocked dates',
    'PhotosStep': 'Photos and description'  // or "Media"
};

// Valid steps in order of execution preference
const ORDERED_STEPS = ['FeaturesSteps', 'PaymentSteps', 'BlockedDatesStep', 'PhotosStep'];

async function handleBatchStep(jsonData, progress) {
    if (progress) {
        showProgressOverlay(progress);
    }
    if (!jsonData) throw new Error('No JSON data provided.');

    const roomData = jsonData.room_data || {};

    // Check which steps are present in JSON
    const stepsToRun = ORDERED_STEPS.filter(stepKey =>
        Object.prototype.hasOwnProperty.call(roomData, stepKey) &&
        // Ensure not empty object? 
        roomData[stepKey]
    );

    console.log('[ELH-helper] [universal_run/batch_runner.js] Steps to run:', stepsToRun);

    // Import RoomMapper once
    console.log('[ELH-helper] [universal_run/batch_runner.js] Importing RoomMapper...');
    const module = await import(chrome.runtime.getURL('src/content/universal_json/mappings/room.js'));
    const RoomMapper = module.RoomMapper;
    if (!RoomMapper) throw new Error('RoomMapper not found in module.');

    // Results aggregator
    const aggregatedResults = {
        matched: 0,
        added: 0,
        deleted: 0,
        ignored: 0,
        old_dates: []
    };

    // Execute each step
    for (const stepKey of stepsToRun) {
        const btnText = STEP_BUTTON_MAP[stepKey];
        if (!btnText) {
            console.warn(`[ELH-helper] No button text mapped for step ${stepKey}. Skipping.`);
            continue;
        }

        const btn = findButtonByText(btnText);
        if (btn) {
            console.log(`[ELH-helper] Clicking "${btnText}" for step ${stepKey}...`);
            btn.click();

            // Wait for navigation
            await new Promise(r => setTimeout(r, 1500));

            // Validate we are on the step? (Optional but good)

            // Run Mapper
            try {
                console.log(`[ELH-helper] executing RoomMapper for ${stepKey}`);
                const result = await RoomMapper.handle(stepKey, jsonData, document.body);

                // Aggregate Stats
                if (result) {
                    if (result.matched) aggregatedResults.matched += result.matched;
                    if (result.added) aggregatedResults.added += result.added;
                    if (result.deleted) aggregatedResults.deleted += result.deleted;
                    if (result.ignored) aggregatedResults.ignored += result.ignored;
                    if (result.old_dates) aggregatedResults.old_dates.push(...result.old_dates);
                }
            } catch (err) {
                console.error(`[ELH-helper] Error in step ${stepKey}:`, err);
                // Continue to next step? or Fail?
                // Let's log and continue
            }

            // Artificial delay between steps
            await new Promise(r => setTimeout(r, 500));

        } else {
            console.warn(`[ELH-helper] Button "${btnText}" not found. Skipping step ${stepKey}.`);
        }
    }

    console.log('[ELH-helper] [universal_run/batch_runner.js] All steps complete. Result:', aggregatedResults);
    return aggregatedResults;
}

function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    const lowerText = text.toLowerCase();
    return buttons.find(btn => btn.textContent.toLowerCase().includes(lowerText));
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

function markOverlayAsComplete(progress, stats, jsonData) {
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

    // Add Copy JSON Button
    if (jsonData) {
        const jsonString = JSON.stringify(jsonData);
        // We'll add a button that we attach a listener to below
        const btnId = 'elh-overlay-copy-json-' + Date.now();
        overlay.innerHTML += `
            <div style="margin-top:8px;">
                <button id="${btnId}" style="
                    background: #333; 
                    color: white; 
                    border: 1px solid #555; 
                    border-radius: 4px; 
                    padding: 2px 6px; 
                    font-size: 10px; 
                    cursor: pointer;
                    pointer-events: auto;
                ">📋<br>u-JSON</button>
            </div>
        `;

        // Use timeout to ensure DOM update (fast/sync usually works but safer)
        setTimeout(() => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.onclick = () => {
                    navigator.clipboard.writeText(jsonString).then(() => {
                        const original = btn.textContent;
                        btn.textContent = 'Copied!';
                        btn.style.borderColor = '#4ade80';
                        setTimeout(() => {
                            btn.textContent = original;
                            btn.style.borderColor = '#555';
                        }, 1000);
                    });
                };
            }
        }, 50);
    }

    // Show Old Dates
    let datesHtml = 'none';
    if (stats && stats.old_dates && stats.old_dates.length > 0) {
        datesHtml = stats.old_dates.map(d => `<div style="font-size:10px; color:#aaa; margin-top:2px;">${d}</div>`).join('');
    } else {
        datesHtml = `<div style="font-size:10px; color:#aaa; margin-top:2px;">none</div>`;
    }

    overlay.innerHTML += `<div style="margin-top:8px; padding-top:4px; border-top:1px solid #444;">Previous dates: ${datesHtml}</div>`;
}

// --- Save & Close Logic ---

async function handleSaveAndClose(validate) {
    console.log('[ELH-helper] [batch_runner] Starting Save & Close sequence. Validate:', validate);

    // 1. Validation (Optional)
    if (validate) {
        // User requested to KEEP the existing overlay content (which shows old dates).
        // So we DO NOT call showProgressOverlay here, as it clears the innerHTML.
        // showProgressOverlay({ current: 'Validating', total: 'Dates' });

        const blockedTab = findButtonByText('Blocked Dates');
        if (blockedTab) {
            blockedTab.click();
            await new Promise(r => setTimeout(r, 1000));

            // Check for empty inputs in the Blocked Dates section
            // Look for row containers.
            // We assume if a start date exists, an end date must exist.
            const startLabels = Array.from(document.querySelectorAll('label')).filter(l => l.textContent.trim() === 'Start Date');
            let invalid = false;

            for (const sLabel of startLabels) {
                // Find Start Input/Button
                const sBtn = sLabel.nextElementSibling?.querySelector('button') || sLabel.nextElementSibling;
                // Find End Input/Button
                const rowContainer = sLabel.closest('.flex.items-center.gap-4'); // Reuse known selector
                if (!rowContainer) continue;

                const eLabel = Array.from(rowContainer.querySelectorAll('label')).find(l => l.textContent.trim() === 'End Date');
                const eBtn = eLabel?.nextElementSibling?.querySelector('button') || eLabel?.nextElementSibling;

                const sVal = sBtn ? sBtn.textContent.trim() : '';
                const eVal = eBtn ? eBtn.textContent.trim() : '';

                // If Start is set (not "Select date") but End is "Select date" or empty -> Invalid
                // Actually button text is "Select date" if empty.
                const sSet = sVal && sVal !== 'Select date';
                const eSet = eVal && eVal !== 'Select date';

                if (sSet && !eSet) {
                    console.warn('[ELH-helper] Validation Failed: Start date set without End date.');
                    invalid = true;
                    // Highlight?
                    if (eBtn) eBtn.style.border = '2px solid red';
                }
                if (!sSet && eSet) {
                    console.warn('[ELH-helper] Validation Failed: End date set without Start date.');
                    invalid = true;
                    if (sBtn) sBtn.style.border = '2px solid red';
                }
            }

            if (invalid) {
                alert('ELH Validation Failed: Incomplete Blocked Dates found. Please fix and try again.');
                // User requested NOT to change the overlay text.
                // markOverlayAsComplete({ current: 'Error', total: 'Validation' });
                return; // Abort
            }

        } else {
            console.warn('[ELH-helper] "Blocked Dates" tab not found for validation. Skipping check.');
        }
    }

    // 2. Go to Revision Step
    // showProgressOverlay({ current: 'Saving', total: '...' });

    // User HTML: <button ...>Revision and publication...
    // We look for button containing specific text structure if possible, or just "Revision and publication"
    // Using findButtonByText might match sub-buttons?
    // Let's look specifically for the step button.
    const steps = Array.from(document.querySelectorAll('button'));
    const revisionBtn = steps.find(b => b.textContent.includes('Revision and publication'));

    if (!revisionBtn) {
        console.error('[ELH-helper] "Revision and publication" button not found.');
        alert('ELH Error: Could not find Revision step.');
        return;
    }

    revisionBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    // 3. Click Update
    // Look for button with text "update" (lowercase in user HTML span, but check textContent)
    // User HTML: <span>update<svg...
    // textContent might be "update" (whitespace trimmed).
    const updateBtns = Array.from(document.querySelectorAll('button'));
    // Filter for buttons that exactly match "update" or contain it + arrow?
    // The Update button usually is "Update" or "update".
    const updateBtn = updateBtns.find(b => b.textContent.trim().toLowerCase() === 'update');

    if (!updateBtn) {
        console.error('[ELH-helper] "update" button not found.');
        alert('ELH Error: Could not find Update button.');
        return;
    }

    updateBtn.click();
    console.log('[ELH-helper] Update button clicked. Waiting for redirection (handled by options.js)...');

    // We do NOT close the window here. options.js monitors the tab URL for success.
    // If we closed it here immediately, the update might not submit.
}
