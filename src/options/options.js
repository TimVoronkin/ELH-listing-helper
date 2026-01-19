// options.js (moved to src/options)
// Copy of original options.js
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('save');
  const clearBtn = document.getElementById('clear');
  const envFile = document.getElementById('envFile');
  const status = document.getElementById('status');
  const promptObjEl = document.getElementById('promptObj');
  const validateBtn = document.getElementById('validate');
  const prettyBtn = document.getElementById('pretty');
  const defaultsBtn = document.getElementById('defaults');
  const jsonStatus = document.getElementById('jsonStatus');
  const promptDescEl = document.getElementById('promptDescObj');
  const validateDescBtn = document.getElementById('validateDesc');
  const prettyDescBtn = document.getElementById('prettyDesc');
  const defaultsDescBtn = document.getElementById('defaultsDesc');
  const promptAddressEl = document.getElementById('promptAddressObj');
  const validateAddressBtn = document.getElementById('validateAddress');
  const prettyAddressBtn = document.getElementById('prettyAddress');
  const defaultsAddressBtn = document.getElementById('defaultsAddress');
  const jsonAddressStatus = document.getElementById('jsonAddressStatus');
  const randomNamesEl = document.getElementById('randomNamesObj');
  const defaultsNamesBtn = document.getElementById('defaultsNames');
  const namesStatus = document.getElementById('namesStatus');
  const openListingRoomsInBGCheckbox = document.getElementById('openListingRoomsInBG');
  const openInSameTabGroupCheckbox = document.getElementById('openInSameTabGroup');
  const deleteBlockedDatesBeforePastingCheckbox = document.getElementById('deleteBlockedDatesBeforePasting');
  const batchProcessInBackgroundCheckbox = document.getElementById('batchProcessInBackground');

  async function fetchdefaultPromptForNameFile() {
    try {
      const resp = await fetch(chrome.runtime.getURL('data/defaultPromptForName.json'));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      return json;
    } catch (err) {
      return { contents: [{ parts: [{ text: '{{PROMPT}}' }] }] };
    }
  }

  async function fetchdefaultPromptForDescriptionFile() {
    try {
      const resp = await fetch(chrome.runtime.getURL('data/defaultPromptForDescription.json'));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      return json;
    } catch (err) {
      return { instruction: 'Write a short description', input: { room_name: 'roomName' }, output_format: { description: 'string' } };
    }
  }

  async function fetchdefaultPromptForAddressFile() {
    try {
      const resp = await fetch(chrome.runtime.getURL('data/defaultPromptForAdress.json'));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      return json;
    } catch (err) {
      return { instruction: 'Extract address', input: '{{INPUT_ADRESS}}', output_format: { StreetAddress: 'string' } };
    }
  }

  async function fetchRandomNamesFile() {
    try {
      const resp = await fetch(chrome.runtime.getURL('data/RandomizedRoomNames.txt'));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      return text;
    } catch (err) {
      return '';
    }
  }

  chrome.storage.local.get(['GEMINI_API_KEY', 'PROMPT_OBJ'], (items) => {
    if (items && items.GEMINI_API_KEY) apiKeyInput.value = items.GEMINI_API_KEY;
    if (items && items.PROMPT_OBJ) {
      try {
        promptObjEl.value = JSON.stringify(items.PROMPT_OBJ, null, 2);
      } catch (e) {
        promptObjEl.value = String(items.PROMPT_OBJ);
      }
    } else {
      fetchdefaultPromptForNameFile().then((json) => {
        try {
          promptObjEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptObjEl.value = String(json);
        }
      });
    }
  });

  // load description prompt (separate storage key PROMPT_DESC_OBJ)
  chrome.storage.local.get(['PROMPT_DESC_OBJ'], (items) => {
    if (items && items.PROMPT_DESC_OBJ) {
      try {
        promptDescEl.value = JSON.stringify(items.PROMPT_DESC_OBJ, null, 2);
      } catch (e) {
        promptDescEl.value = String(items.PROMPT_DESC_OBJ);
      }
    } else {
      fetchdefaultPromptForDescriptionFile().then((json) => {
        try {
          promptDescEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptDescEl.value = String(json);
        }
      });
    }
  });

  // load address prompt (separate storage key PROMPT_ADDRESS_OBJ)
  chrome.storage.local.get(['PROMPT_ADDRESS_OBJ'], (items) => {
    if (items && items.PROMPT_ADDRESS_OBJ) {
      try {
        promptAddressEl.value = JSON.stringify(items.PROMPT_ADDRESS_OBJ, null, 2);
      } catch (e) {
        promptAddressEl.value = String(items.PROMPT_ADDRESS_OBJ);
      }
    } else {
      fetchdefaultPromptForAddressFile().then((json) => {
        try {
          promptAddressEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptAddressEl.value = String(json);
        }
      });
    }
  });

  // load randomized names
  chrome.storage.local.get(['RANDOMIZED_ROOM_NAMES'], (items) => {
    if (items && items.RANDOMIZED_ROOM_NAMES) {
      randomNamesEl.value = items.RANDOMIZED_ROOM_NAMES;
    } else {
      fetchRandomNamesFile().then((text) => {
        randomNamesEl.value = text;
      });
    }
  });

  function showStatus(el, text, ok = true) {
    el.textContent = text;
    el.style.color = ok ? '#0b6623' : '#b30000';
  }

  saveBtn.addEventListener('click', () => {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    const key = apiKeyInput.value.trim();
    const openListingRoomsInBG = openListingRoomsInBGCheckbox ? openListingRoomsInBGCheckbox.checked : false;
    const openInSameTabGroup = openInSameTabGroupCheckbox ? openInSameTabGroupCheckbox.checked : false;
    const deleteBlockedDatesBeforePasting = deleteBlockedDatesBeforePastingCheckbox ? deleteBlockedDatesBeforePastingCheckbox.checked : false;
    const batchProcessInBackground = batchProcessInBackgroundCheckbox ? batchProcessInBackgroundCheckbox.checked : false;
    console.log('[ELH-helper] Saving batchProcessInBackground:', batchProcessInBackground, 'checkbox element:', batchProcessInBackgroundCheckbox);
    let parsed = null;
    try {
      parsed = JSON.parse(promptObjEl.value);
    } catch (err) {
      showStatus(jsonStatus, 'promptObj is not valid JSON: ' + err.message, false);
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      return;
    }
    let parsedDesc = null;
    try {
      parsedDesc = JSON.parse(promptDescEl.value);
    } catch (err) {
      showStatus(jsonDescStatus, 'promptDesc is not valid JSON: ' + err.message, false);
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      return;
    }
    let parsedAddress = null;
    try {
      parsedAddress = JSON.parse(promptAddressEl.value);
    } catch (err) {
      showStatus(jsonAddressStatus, 'promptAddress is not valid JSON: ' + err.message, false);
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      return;
    }
    const randomNames = randomNamesEl.value;

    chrome.storage.local.set({ GEMINI_API_KEY: key, PROMPT_OBJ: parsed, openListingRoomsInBG: openListingRoomsInBG, openInSameTabGroup: openInSameTabGroup, deleteBlockedDatesBeforePasting: deleteBlockedDatesBeforePasting, batchProcessInBackground: batchProcessInBackground, RANDOMIZED_ROOM_NAMES: randomNames }, () => {
      // save description prompt as well
      chrome.storage.local.set({ PROMPT_DESC_OBJ: parsedDesc }, () => {
        // save address prompt as well
        chrome.storage.local.set({ PROMPT_ADDRESS_OBJ: parsedAddress }, () => {
          showStatus(status, 'Saved.');
          /*
          // Silenced verbose messages as per user request
          showStatus(jsonStatus, 'promptObj saved.');
          showStatus(jsonDescStatus, 'promptDesc saved.');
          showStatus(jsonAddressStatus, 'promptAddress saved.');
          showStatus(namesStatus, 'Names saved.');
          */

          // Button feedback
          saveBtn.textContent = 'Saved!';
          setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
          }, 1500);
        });
      });
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['GEMINI_API_KEY', 'PROMPT_OBJ', 'PROMPT_DESC_OBJ', 'PROMPT_ADDRESS_OBJ', 'openListingRoomsInBG', 'openInSameTabGroup', 'deleteBlockedDatesBeforePasting', 'batchProcessInBackground', 'RANDOMIZED_ROOM_NAMES'], () => {
      apiKeyInput.value = '';
      if (openListingRoomsInBGCheckbox) openListingRoomsInBGCheckbox.checked = false;
      if (openInSameTabGroupCheckbox) openInSameTabGroupCheckbox.checked = false;
      if (deleteBlockedDatesBeforePastingCheckbox) deleteBlockedDatesBeforePastingCheckbox.checked = false;
      if (batchProcessInBackgroundCheckbox) batchProcessInBackgroundCheckbox.checked = false;
      fetchdefaultPromptForNameFile().then((json) => {
        try {
          promptObjEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptObjEl.value = String(json);
        }
      });
      fetchdefaultPromptForDescriptionFile().then((json) => {
        try {
          promptDescEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptDescEl.value = String(json);
        }
      });
      fetchdefaultPromptForAddressFile().then((json) => {
        try {
          promptAddressEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptAddressEl.value = String(json);
        }
      });
      fetchRandomNamesFile().then((text) => {
        randomNamesEl.value = text;
      });
      showStatus(status, 'Cleared.');
      showStatus(jsonStatus, 'promptObj cleared.');
      showStatus(jsonDescStatus, 'promptDesc cleared.');
      showStatus(jsonAddressStatus, 'promptAddress cleared.');
      showStatus(namesStatus, 'Names reset.');
    });
  });

  envFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const m = text.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
      if (m) {
        const found = m[1].trim();
        const key = found.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        chrome.storage.local.set({ GEMINI_API_KEY: key }, () => {
          apiKeyInput.value = key;
          showStatus(status, '.env parsed and saved.');
        });
      } else {
        showStatus(status, 'No GEMINI_API_KEY found in .env file.', false);
      }
    };
    reader.readAsText(file);
  });

  validateBtn.addEventListener('click', () => {
    try { JSON.parse(promptObjEl.value); showStatus(jsonStatus, 'Valid JSON.'); } catch (err) { showStatus(jsonStatus, 'Invalid JSON: ' + err.message, false); }
  });

  prettyBtn.addEventListener('click', () => {
    try { const p = JSON.parse(promptObjEl.value); promptObjEl.value = JSON.stringify(p, null, 2); showStatus(jsonStatus, 'Pretty printed.'); } catch (err) { showStatus(jsonStatus, 'Invalid JSON: ' + err.message, false); }
  });

  defaultsBtn.addEventListener('click', async () => {
    const json = await fetchdefaultPromptForNameFile();
    try { promptObjEl.value = JSON.stringify(json, null, 2); showStatus(jsonStatus, 'Default loaded.'); } catch (e) { promptObjEl.value = String(json); showStatus(jsonStatus, 'Default loaded (non-JSON fallback).'); }
  });

  // Description prompt controls
  validateDescBtn.addEventListener('click', () => {
    try { JSON.parse(promptDescEl.value); showStatus(jsonDescStatus, 'Valid JSON.'); } catch (err) { showStatus(jsonDescStatus, 'Invalid JSON: ' + err.message, false); }
  });

  prettyDescBtn.addEventListener('click', () => {
    try { const p = JSON.parse(promptDescEl.value); promptDescEl.value = JSON.stringify(p, null, 2); showStatus(jsonDescStatus, 'Pretty printed.'); } catch (err) { showStatus(jsonDescStatus, 'Invalid JSON: ' + err.message, false); }
  });

  defaultsDescBtn.addEventListener('click', async () => {
    const json = await fetchdefaultPromptForDescriptionFile();
    try { promptDescEl.value = JSON.stringify(json, null, 2); showStatus(jsonDescStatus, 'Default loaded.'); } catch (e) { promptDescEl.value = String(json); showStatus(jsonDescStatus, 'Default loaded (non-JSON fallback).'); }
  });

  // Address prompt controls
  validateAddressBtn.addEventListener('click', () => {
    try { JSON.parse(promptAddressEl.value); showStatus(jsonAddressStatus, 'Valid JSON.'); } catch (err) { showStatus(jsonAddressStatus, 'Invalid JSON: ' + err.message, false); }
  });

  prettyAddressBtn.addEventListener('click', () => {
    try { const p = JSON.parse(promptAddressEl.value); promptAddressEl.value = JSON.stringify(p, null, 2); showStatus(jsonAddressStatus, 'Pretty printed.'); } catch (err) { showStatus(jsonAddressStatus, 'Invalid JSON: ' + err.message, false); }
  });

  defaultsAddressBtn.addEventListener('click', async () => {
    const json = await fetchdefaultPromptForAddressFile();
    try { promptAddressEl.value = JSON.stringify(json, null, 2); showStatus(jsonAddressStatus, 'Default loaded.'); } catch (e) { promptAddressEl.value = String(json); showStatus(jsonAddressStatus, 'Default loaded (non-JSON fallback).'); }
  });

  defaultsNamesBtn.addEventListener('click', async () => {
    const text = await fetchRandomNamesFile();
    randomNamesEl.value = text;
    showStatus(namesStatus, 'Default names loaded.');
  });

  // Load checkbox state for openListingRoomsInBG and openInSameTabGroup
  // Load checkbox state for openListingRoomsInBG and openInSameTabGroup
  /* Variables moved to top of scope */

  if (openListingRoomsInBGCheckbox || openInSameTabGroupCheckbox || deleteBlockedDatesBeforePastingCheckbox || batchProcessInBackgroundCheckbox) {
    chrome.storage.local.get(['openListingRoomsInBG', 'openInSameTabGroup', 'deleteBlockedDatesBeforePasting', 'batchProcessInBackground'], (items) => {
      console.log('[ELH-helper] Loaded settings:', items);
      if (openListingRoomsInBGCheckbox && items && items.openListingRoomsInBG !== undefined) {
        openListingRoomsInBGCheckbox.checked = items.openListingRoomsInBG;
      }
      if (openInSameTabGroupCheckbox && items && items.openInSameTabGroup !== undefined) {
        openInSameTabGroupCheckbox.checked = items.openInSameTabGroup;
      }
      if (deleteBlockedDatesBeforePastingCheckbox && items && items.deleteBlockedDatesBeforePasting !== undefined) {
        deleteBlockedDatesBeforePastingCheckbox.checked = items.deleteBlockedDatesBeforePasting;
      }
      if (batchProcessInBackgroundCheckbox && items && items.batchProcessInBackground !== undefined) {
        batchProcessInBackgroundCheckbox.checked = items.batchProcessInBackground;
      }
    });
  }
});

const testBtn = document.getElementById('test');
const testResult = document.getElementById('testResult');
testBtn.addEventListener('click', async () => {
  showStatus(testResult, 'Running test...', true);
  let parsed;
  try { parsed = JSON.parse(promptObjEl.value); } catch (err) { showStatus(testResult, 'promptObj JSON invalid: ' + err.message, false); return; }
  try {
    chrome.runtime.sendMessage({ action: 'gemini_request', prompt: 'Test prompt for preview' }, (resp) => {
      if (chrome.runtime.lastError) { console.error('[ELH-helper] [options] Runtime message error:', chrome.runtime.lastError); showStatus(testResult, 'Runtime error: ' + chrome.runtime.lastError.message, false); return; }
      try { testResult.textContent = JSON.stringify(resp, null, 2); } catch (e) { testResult.textContent = String(resp); }
    });
  } catch (err) { console.error('[ELH-helper] [options] Test send error:', err); showStatus(testResult, 'Error sending test: ' + err.message, false); }
}); // end testBtn listener

// Batch Processing Logic
const batchInput = document.getElementById('batchInput');
const batchPreviewContainer = document.getElementById('batchPreviewContainer');
const batchProcessBtn = document.getElementById('batchProcessBtn');
const batchControls = document.getElementById('batchControls'); // Container
const batchStatus = document.getElementById('batchStatus');
const autoPauseLimitEl = document.getElementById('autoPauseLimit');

// Load auto-pause limit
chrome.storage.local.get(['BATCH_AUTO_PAUSE_LIMIT'], (items) => {
  if (items && items.BATCH_AUTO_PAUSE_LIMIT) {
    autoPauseLimitEl.value = items.BATCH_AUTO_PAUSE_LIMIT;
  }
});

autoPauseLimitEl.addEventListener('change', () => {
  chrome.storage.local.set({ BATCH_AUTO_PAUSE_LIMIT: autoPauseLimitEl.value });
  // Trigger batchInput input event to refresh warning
  batchInput.dispatchEvent(new Event('input'));
});

let batchState = 'IDLE'; // IDLE, RUNNING, PAUSED
let resumeResolve = null; // Function to resolve the pause promise
let isStopRequested = false;
let batchOpenedTabs = []; // Store: { tabId: number, rowId: number, changeCount: number }

function updateBatchUI() {
  batchControls.innerHTML = ''; // Clear container

  if (batchState === 'IDLE') {
    const startBtn = document.createElement('button');
    startBtn.id = 'batchProcessBtn';
    startBtn.textContent = '▶︎ Start Batch Process';
    // Enable if we have valid rows (logic for disabled depends on validation, 
    // but we can trust the validation logic to set disabled on the element with this ID if it exists, 
    // OR we just re-run validation check? 
    // Better: The validation logic (lines 383+) modifies 'batchProcessBtn'. 
    // We should ensure that logic still finds the button.
    // Since we are clearing innerHTML, we might lose the 'disabled' state set by validation.
    // We should probably just toggle visibility instead of recreating?
    // user wants specific buttons.
    // Let's keep distinct buttons in the DOM and toggle display?
    // Or just recreate and set disabled based on row count?
    // Let's recreate. We'll need to check row count.
    // For now, assume enabled if logic allows.

    startBtn.addEventListener('click', startBatch);
    batchControls.appendChild(startBtn);

    // Trigger validation logic again to set disabled state?
    // We can just manually check if batchInput has valid content.
    const text = batchInput.value;
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) startBtn.disabled = true;
    else startBtn.classList.add('primary');

  } else if (batchState === 'RUNNING') {
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = '❚❚ Pause';
    pauseBtn.className = 'warning';
    pauseBtn.addEventListener('click', () => pauseBatch('user'));
    batchControls.appendChild(pauseBtn);

  } else if (batchState === 'PAUSED') {
    const resumeBtn = document.createElement('button');
    resumeBtn.textContent = '▶︎ Resume';
    resumeBtn.className = 'primary';
    resumeBtn.addEventListener('click', resumeBatch);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = '■ Stop';
    stopBtn.className = 'danger';
    stopBtn.addEventListener('click', stopBatch);

    batchControls.appendChild(resumeBtn);
    batchControls.appendChild(stopBtn);
  }
}

function pauseBatch(source) {
  if (batchState !== 'RUNNING') return;
  batchState = 'PAUSED';
  updateBatchUI();
  batchStatus.textContent = 'Batch processing is paused.';

  // If source is user (options page), we are already here.
  // If source is 'content', we should focus this tab.
  // If source is 'auto' (limit reached), we also want to bring user back here.
  if (source === 'content' || source === 'auto') {
    chrome.tabs.getCurrent(tab => {
      if (tab) chrome.tabs.update(tab.id, { active: true });
    });
  }
}

function resumeBatch() {
  if (batchState !== 'PAUSED') return;
  batchState = 'RUNNING';
  updateBatchUI();
  batchStatus.textContent = 'Resuming...';
  if (resumeResolve) {
    resumeResolve();
    resumeResolve = null;
  }
}

function stopBatch() {
  // If running, standard stop. If paused, we need to break the wait.
  isStopRequested = true;
  if (batchState === 'PAUSED') {
    // Resolve the pause so the loop can check isStopRequested
    if (resumeResolve) {
      resumeResolve();
      resumeResolve = null;
    }
  }
  // UI update happens when loop finishes
  batchStatus.textContent = 'Stopping...';
}

// Redefine startBatch which was the anonymous click handler
async function startBatch() {
  batchState = 'RUNNING';
  updateBatchUI();
  // Logic from previous click handler...
  processBatchLoop();
}

async function processBatchLoop() {
  const text = batchInput.value;
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  // Ensure button reflects running state immediately
  // handled by startBatch calling updateBatchUI

  let processedCount = 0;

  let tabsSinceResume = 0;
  isStopRequested = false; // Reset flag

  // Capture current tab to refocus later
  const currentTab = await new Promise(resolve => chrome.tabs.getCurrent(resolve));

  for (let i = 0; i < lines.length; i++) {
    // 1. Check Stop
    if (isStopRequested) {
      break;
    }

    // 2. Check Pause
    if (batchState === 'PAUSED') {
      await new Promise(resolve => { resumeResolve = resolve; });
      // Re-check Stop after resume
      if (isStopRequested) break;
      tabsSinceResume = 0;
    }

    const line = lines[i];
    let url = '';
    let jsonStr = '';

    // 1. Try Markdown Table Format
    const pipeMatch = line.trim().match(/^\|(.*)\|(.*)\|$/);
    if (pipeMatch) {
      let rawUrlCol = pipeMatch[1].trim();
      let rawJsonCol = pipeMatch[2].trim();
      const mdLinkMatch = rawUrlCol.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (mdLinkMatch) url = mdLinkMatch[1].trim();
      else url = rawUrlCol;

      if (rawJsonCol.startsWith('`') && rawJsonCol.endsWith('`')) {
        jsonStr = rawJsonCol.slice(1, -1).trim();
      } else {
        jsonStr = rawJsonCol;
      }
    } else {
      // 2. TSV Fallback
      const partIndex = line.indexOf('\t');
      if (partIndex !== -1) {
        url = line.substring(0, partIndex).trim();
        jsonStr = line.substring(partIndex + 1).trim();
      } else {
        continue;
      }
    }

    if (url.toLowerCase() === 'url' || url.includes('---')) continue;
    if (!url.startsWith('http')) continue;

    // Handle Google Sheets escaping again for the actual data
    if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
      try {
        const unescaped = jsonStr.slice(1, -1).replace(/""/g, '"');
        JSON.parse(unescaped);
        jsonStr = unescaped;
      } catch (e) { }
    }

    let jsonData;
    try {
      jsonData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Skipping invalid JSON at row ' + (i + 1));
      continue;
    }

    let statusText = `Processing row ${i + 1} / ${lines.length}...`;
    const limitVal = parseInt(autoPauseLimitEl.value, 10) || 0;
    if (limitVal > 0) {
      const remainingAutoPause = Math.max(0, limitVal - tabsSinceResume);
      const remainingRows = lines.length - (i + 1);
      if (remainingAutoPause > 0 && remainingRows >= remainingAutoPause) {
        statusText += ` (Auto-pause in ${remainingAutoPause} tabs)`;
      }
    }
    batchStatus.textContent = statusText;

    try {
      // Open Tab
      const bgCheck = document.getElementById('batchProcessInBackground');
      const isBg = bgCheck ? bgCheck.checked : false;
      const tab = await chrome.tabs.create({ url: url, active: !isBg });

      // Wait for it to load
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Wait a bit more for scripts to init
      await new Promise(r => setTimeout(r, 2000));

      // Send Message and wait for response
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'ELH_BATCH_RUN_STEP',
        data: jsonData,
        progress: { current: i + 1, total: lines.length }
      });

      processedCount++;

      // Update Status Cell logic
      const targetRow = batchPreviewContainer.querySelector(`tr[data-original-index="${i}"]`);
      if (targetRow) {
        const oldDatesCell = targetRow.children[3]; // 4th column (Old Dates)
        const statusCell = targetRow.children[4];   // 5th column (Status)

        let changeCount = 0;

        if (response && response.stats) {
          const s = response.stats;

          // Populate Old Dates
          if (s.old_dates && s.old_dates.length > 0) {
            oldDatesCell.innerHTML = s.old_dates.map(d => `<div style="font-size:10px; line-height:1.2;"><b><code>${d}</code></b></div>`).join('');
            oldDatesCell.style.color = '#333';
            oldDatesCell.style.fontStyle = 'normal';
          } else {
            oldDatesCell.textContent = 'None';
          }

          const details = [];
          if (s.matched > 0) details.push(`<span style="color:gray" title="Already on site">${s.matched} same</span>`);
          if (s.deleted > 0) {
            details.push(`<span style="color:red; font-weight:bold;" title="Old dates removed">-${s.deleted}</span>`);
            changeCount += s.deleted;
          }
          if (s.added > 0) {
            details.push(`<span style="color:green; font-weight:bold;" title="New dates added">+${s.added}</span>`);
            changeCount += s.added;
          }
          if (s.ignored > 0) details.push(`<span style="color:orange;" title="Past dates ignored">Ign:${s.ignored}</span>`);

          if (details.length === 0) details.push('No changes');

          statusCell.innerHTML = `<div style="font-size:10px; display:flex; flex-direction:column; gap: 4px;">
                    <div style="display:flex; gap: 4px;">
                        <span style="font-weight:bold;">✓</span>
                        <span>${details.join(', ')}</span>
                    </div>
                    <button class="goto-tab-btn" data-tab-id="${tab.id}">go to tab ➚</button>
                 </div>`;
        } else {
          statusCell.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:4px;">
                <span style="font-weight:bold;">✓</span>
                <button class="goto-tab-btn" data-tab-id="${tab.id}">go to tab ➚</button>
            </div>`;
        }

        // Track for bulk closing
        batchOpenedTabs.push({ tabId: tab.id, rowId: i, changeCount: changeCount });
        updateTabManagementUI();
      }

    } catch (err) {
      console.error(`Error processing row ${i + 1}:`, err);
      batchStatus.textContent = `Error at row ${i + 1}: ${err.message}`;

      // Update table row with error
      const errorRow = batchPreviewContainer.querySelector(`tr[data-original-index="${i}"]`);
      if (errorRow) {
        const statusCell = errorRow.children[4]; // Status is 5th column now
        // Assuming tab exists if we reached here? Tab might be created but connection failed.
        // If tab was created, we should track it too.
        // We don't have 'tab' variable scope easily if it failed before assignment?
        // Actually tab is assigned inside try.
        // If error happens before tab creation, we can't track.
        statusCell.innerHTML = `<span style="color:red; font-weight:bold;">Error</span>`;
      }
    }

    // Artificial delay between tabs
    await new Promise(r => setTimeout(r, 1000));

    tabsSinceResume++;
    const currentLimit = parseInt(autoPauseLimitEl.value, 10) || 0;
    if (currentLimit > 0 && tabsSinceResume >= currentLimit) {
      pauseBatch('auto');
    }
  }

  batchStatus.textContent = isStopRequested
    ? `Stopped by user. Processed ${processedCount} rows.`
    : `Done! Processed ${processedCount} rows.`;

  batchState = 'IDLE';
  updateBatchUI();

  // Refocus Options Page
  if (currentTab) {
    chrome.tabs.update(currentTab.id, { active: true });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ELH_BATCH_FORCE_STOP') {
    console.log('[ELH-helper] Force stop requested.');
    stopBatch();
  }
  if (message.action === 'ELH_BATCH_PAUSE') {
    pauseBatch('content');
  }
  if (message.action === 'ELH_BATCH_RESUME') {
    resumeBatch();
  }
});

if (batchInput) {
  batchPreviewContainer.addEventListener('click', (e) => {
    // Copy
    if (e.target.closest('.batch-copy-btn')) {
      const btn = e.target.closest('.batch-copy-btn');
      const content = btn.getAttribute('data-content');
      if (content) {
        navigator.clipboard.writeText(content).then(() => {
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = originalText, 1000);
        });
      }
    }
    // Open URL
    else if (e.target.closest('.batch-open-btn')) {
      const btn = e.target.closest('.batch-open-btn');
      const url = btn.getAttribute('data-url');
      if (url) {
        window.open(url, '_blank');
      }
    }
    // Go to Tab
    else if (e.target.closest('.goto-tab-btn')) {
      const btn = e.target.closest('.goto-tab-btn');
      const tabId = parseInt(btn.getAttribute('data-tab-id'), 10);
      if (tabId) {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            btn.textContent = 'tab closed';
            btn.disabled = true;
            return;
          }
          chrome.windows.update(tab.windowId, { focused: true }, () => {
            chrome.tabs.update(tabId, { active: true });
          });
        });
      }
    }
  });


  // --- TAB MANAGEMENT LOGIC ---

  const tabManagementSection = document.getElementById('tabManagementSection');
  const closeAllTabsBtn = document.getElementById('closeAllTabsBtn');
  const closeUnchangedTabsBtn = document.getElementById('closeUnchangedTabsBtn');
  const openTabsStatus = document.getElementById('openTabsStatus');
  const saveAndCloseAllTabsBtn = document.getElementById('saveAndCloseAllTabsBtn');
  const saveAndCloseModifiedTabsBtn = document.getElementById('saveAndCloseModifiedTabsBtn');

  // Track tabs that represent a "Save" operation in progress
  const tabsPendingSave = new Set();

  // State for bulk operations (to lock UI)
  let currentTabOperation = null; // { type: 'save'|'close', button: HTMLElement, originalText: string, total: number, remaining: number }

  function startTabOperation(type, button, tabsCount) {
    if (currentTabOperation) return; // Already running
    currentTabOperation = {
      type: type,
      button: button,
      originalText: button ? button.textContent : '',
      total: tabsCount,
      remaining: tabsCount
    };

    // Disable all management buttons
    if (closeAllTabsBtn) closeAllTabsBtn.disabled = true;
    if (closeUnchangedTabsBtn) closeUnchangedTabsBtn.disabled = true;
    if (saveAndCloseAllTabsBtn) saveAndCloseAllTabsBtn.disabled = true;
    if (saveAndCloseModifiedTabsBtn) saveAndCloseModifiedTabsBtn.disabled = true;

    // Update Text
    if (button) {
      if (type === 'save') {
        button.textContent = `saving and closing ${tabsCount} tabs`;
      } else {
        button.textContent = `closing ${tabsCount} tabs...`;
      }
    }
  }

  function endTabOperation() {
    if (!currentTabOperation) return;

    const { button, originalText } = currentTabOperation;
    if (button) {
      button.textContent = originalText;
    }
    currentTabOperation = null;
    updateTabManagementUI(); // Will re-enable based on current count
  }

  function updateTabOperationProgress(tabIdClosed) {
    if (!currentTabOperation) return;

    currentTabOperation.remaining--;

    if (currentTabOperation.remaining <= 0) {
      endTabOperation();
      return;
    }

    // Update Text
    const { type, button, remaining } = currentTabOperation;
    if (button) {
      if (type === 'save') {
        button.textContent = `saving and closing ${remaining} tabs`;
      } else {
        button.textContent = `closing ${remaining} tabs...`;
      }
    }
  }

  // Listener to auto-close tabs upon successful redirection
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabsPendingSave.has(tabId)) {
      // user requested: "as soon as page redirected to /dashboard/admin/listings"
      // Check url (in changeInfo or tab object)
      const url = changeInfo.url || tab.url;
      if (url && url.includes('/dashboard/admin/listings')) {
        console.log(`[ELH-helper] Tab ${tabId} redirected to listings. Closing...`);
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
          tabsPendingSave.delete(tabId);
          // Clean up tracking
          batchOpenedTabs = batchOpenedTabs.filter(t => t.tabId !== tabId);

          // Update specific button UI to "Saved" (Not needed if we close, but kept for logic consistency or if close fails?)
          // actually tabs.remove callback implies it's gone.

          updateTabOperationProgress(tabId);
        });
      }
    }
  });

  // Listener for Manual Closure (or errors)
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // If we are tracking this tab for save, clean it up
    if (tabsPendingSave.has(tabId)) {
      tabsPendingSave.delete(tabId);
    }
    // Also update batch tracking
    const wasTracked = batchOpenedTabs.find(t => t.tabId === tabId);
    if (wasTracked) {
      batchOpenedTabs = batchOpenedTabs.filter(t => t.tabId !== tabId);
      // If we had an operation running that involved these tabs (likely), update progress
      if (currentTabOperation) {
        updateTabOperationProgress(tabId);
      }
      else {
        // Just refresh UI if no op running
        setTimeout(updateTabManagementUI, 500);
      }
    }
  });


  function updateTabManagementUI() {
    if (!tabManagementSection) return;
    if (currentTabOperation) return; // Do not touch UI if operation is in progress

    // Check which tabs are still alive
    const aliveTabsPromise = Promise.all(batchOpenedTabs.map(t => new Promise(resolve => {
      chrome.tabs.get(t.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) resolve(null);
        else resolve(t);
      });
    })));

    aliveTabsPromise.then(results => {
      const aliveCount = results.filter(r => r !== null).length;
      if (aliveCount > 0) {
        tabManagementSection.style.display = 'block';
        openTabsStatus.textContent = `${aliveCount} tabs active`;
        if (closeAllTabsBtn) closeAllTabsBtn.disabled = false;
        if (closeUnchangedTabsBtn) closeUnchangedTabsBtn.disabled = false;
        if (saveAndCloseAllTabsBtn) saveAndCloseAllTabsBtn.disabled = false;
        if (saveAndCloseModifiedTabsBtn) saveAndCloseModifiedTabsBtn.disabled = false;
      } else {
        openTabsStatus.textContent = `0 tabs active`;
        if (closeAllTabsBtn) closeAllTabsBtn.disabled = true;
        if (closeUnchangedTabsBtn) closeUnchangedTabsBtn.disabled = true;
        if (saveAndCloseAllTabsBtn) saveAndCloseAllTabsBtn.disabled = true;
        if (saveAndCloseModifiedTabsBtn) saveAndCloseModifiedTabsBtn.disabled = true;
      }
    });
  }

  // --- Button Listeners ---

  // 1. Close All Tabs
  closeAllTabsBtn.addEventListener('click', () => {
    const count = batchOpenedTabs.length;
    if (count === 0) return;
    if (!confirm(`This will close ALL ${count} tab(s) without saving.\n\nAre you sure you want to continue?`)) return;

    const idsToClose = batchOpenedTabs.map(t => t.tabId);

    startTabOperation('close', closeAllTabsBtn, idsToClose.length);

    chrome.tabs.remove(idsToClose, () => {
      // Mark buttons as closed immediately for visual feedback
      idsToClose.forEach(closedId => {
        const btn = document.querySelector(`.goto-tab-btn[data-tab-id="${closedId}"]`);
        if (btn) {
          btn.textContent = 'tab closed';
          btn.disabled = true;
          btn.classList.add('disabled-tab-btn');
        }
      });
      batchOpenedTabs = [];

      // Force end operation (restore UI)
      endTabOperation();
    });
  });

  // 2. Close Unchanged Tabs
  closeUnchangedTabsBtn.addEventListener('click', () => {
    const unchangedTabs = batchOpenedTabs.filter(t => t.changeCount === 0);
    const count = unchangedTabs.length;

    if (count === 0) {
      alert('No unchanged tabs found to close.');
      return;
    }
    if (!confirm(`This will close ${count} unchanged tab(s).\n\nAre you sure you want to continue?`)) return;

    const idsToClose = unchangedTabs.map(t => t.tabId);

    startTabOperation('close', closeUnchangedTabsBtn, idsToClose.length);

    chrome.tabs.remove(idsToClose, () => {
      idsToClose.forEach(closedId => {
        const btn = document.querySelector(`.goto-tab-btn[data-tab-id="${closedId}"]`);
        if (btn) {
          btn.textContent = 'tab closed';
          btn.disabled = true;
        }
      });
      batchOpenedTabs = batchOpenedTabs.filter(t => !idsToClose.includes(t.tabId));

      endTabOperation();
    });
  });

  async function triggerSaveAndClose(tabsToSave, validate) {
    if (tabsToSave.length === 0) return;

    let sentCount = 0;
    for (const t of tabsToSave) {
      // Add to tracking BEFORE sending message
      tabsPendingSave.add(t.tabId);

      chrome.tabs.get(t.tabId, (tab) => {
        if (!chrome.runtime.lastError && tab) {
          chrome.tabs.sendMessage(t.tabId, { action: 'SAVE_AND_CLOSE', validate: validate });

          const btn = document.querySelector(`.goto-tab-btn[data-tab-id="${t.tabId}"]`);
          if (btn) {
            btn.textContent = 'saving...';
            btn.disabled = true;
          }
        } else {
          // If tab dead locally, remove from pending
          tabsPendingSave.delete(t.tabId);
        }
      });
      sentCount++;
    }
    console.log(`[ELH-helper] Sent SAVE_AND_CLOSE to ${sentCount} tabs (Validate=${validate})`);
  }

  // 3. Save & Close All
  if (saveAndCloseAllTabsBtn) {
    saveAndCloseAllTabsBtn.addEventListener('click', () => {
      const count = batchOpenedTabs.length;
      if (count === 0) return;

      if (!confirm(`This will attempt to Save & Close ALL ${count} active tab(s).\n\nThey will be validated (if applicable), updated, and closed upon success.\n\nContinue?`)) return;

      startTabOperation('save', saveAndCloseAllTabsBtn, count);
      triggerSaveAndClose(batchOpenedTabs, false);
    });
  }

  // 4. Save & Close Modified
  if (saveAndCloseModifiedTabsBtn) {
    saveAndCloseModifiedTabsBtn.addEventListener('click', () => {
      const modifiedTabs = batchOpenedTabs.filter(t => t.changeCount > 0);
      const count = modifiedTabs.length;

      if (count === 0) {
        alert('No modified tabs found to save.');
        return;
      }

      if (!confirm(`This will attempt to Save & Close ONLY the ${count} Modified tab(s).\n\nThey will be explicitly validated for date consistency.\n\nContinue?`)) return;

      startTabOperation('save', saveAndCloseModifiedTabsBtn, count);
      triggerSaveAndClose(modifiedTabs, true);
    });
  }

  // Expose for usage
  window.updateTabManagementUI = updateTabManagementUI;

  // Update the batch loop to tracking


  // --- JSON Summary Helper ---
  function formatJsonSummary(obj, prefix = '') {
    const paths = [];
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (key === 'json_meta') continue;

      const val = obj[key];
      const newPrefix = prefix ? `${prefix} → ${key}` : key;

      if (val === null || val === undefined) {
        paths.push(`${newPrefix}=${val}`);
      } else if (Array.isArray(val)) {
        // Special handling for blocked_dates to format as "start - end"
        if (key === 'blocked_dates') {
          val.forEach((item, index) => {
            if (item && item.start) { // formatting check
              paths.push(`${newPrefix}[${index}]= <b>${item.start}</b> - <b>${item.end || '?'}</b>`);
            } else {
              paths.push(`${newPrefix}[${index}]= ${JSON.stringify(item)}`);
            }
          });
        } else {
          // Generic Array
          val.forEach((item, index) => {
            if (typeof item === 'object') {
              paths.push(...formatJsonSummary(item, `${newPrefix}[${index}]`));
            } else {
              paths.push(`${newPrefix}[${index}]=${item}`);
            }
          });
        }
      } else if (typeof val === 'object') {
        paths.push(...formatJsonSummary(val, newPrefix));
      } else {
        paths.push(`${newPrefix}= <b>${val}</b>`);
      }
    }
    return paths;
  }

  batchInput.addEventListener('input', () => {
    const updateStartBtn = (disabled) => {
      // Only update if we are in IDLE state where the button exists and is relevant
      if (batchState === 'IDLE') {
        const btn = document.getElementById('batchProcessBtn');
        if (btn) {
          btn.disabled = disabled;
          // Always keep it green (primary) as per user request
          btn.classList.add('primary');
        }
      }
    };

    const text = batchInput.value;
    if (!text.trim()) {
      batchPreviewContainer.innerHTML = '<p style="color: #888; font-style: italic;">Preview will appear here...</p>';
      updateStartBtn(true);
      batchStatus.textContent = '';
      return;
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      batchPreviewContainer.innerHTML = '<p style="color: #888; font-style: italic;">Preview will appear here...</p>';
      updateStartBtn(true);
      batchStatus.textContent = '';
      return;
    }

    let html = '<table style="width:100%; border-collapse: collapse; font-size: 11px;">';
    html += '<tr style="background:#eee; text-align:left;">';
    html += '<th style="padding:5px; border:1px solid #ccc; width: 20px; color: #666;">Row</th>';
    html += '<th style="padding:5px; border:1px solid #ccc; width: 180px;">room/listing URL</th>';
    html += '<th style="padding:5px; border:1px solid #ccc; width: 450px;">actions from u-JSON</th>'; // Wider column
    html += '<th style="padding:5px; border:1px solid #ccc;">Old Dates</th>';
    html += '<th style="padding:5px; border:1px solid #ccc;">Status</th>';
    html += '</tr>';

    let validCount = 0;

    lines.forEach((line, index) => {
      let url = '';
      let jsonStr = '';

      // 1. Try Markdown Table Format: | col1 | col2 |
      const pipeMatch = line.trim().match(/^\|(.*)\|(.*)\|$/);
      if (pipeMatch) {
        let rawUrlCol = pipeMatch[1].trim();
        let rawJsonCol = pipeMatch[2].trim();

        // Extract URL from Markdown link: [text](href) -> take text or href? 
        // User example: [clean_url](google_redirect) -> take clean_url
        const mdLinkMatch = rawUrlCol.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (mdLinkMatch) {
          url = mdLinkMatch[1].trim();
        } else {
          url = rawUrlCol;
        }

        // Clean JSON from backticks: `json` -> json
        if (rawJsonCol.startsWith('`') && rawJsonCol.endsWith('`')) {
          jsonStr = rawJsonCol.slice(1, -1).trim();
        } else {
          jsonStr = rawJsonCol;
        }
      } else {
        // 2. Fallback to TSV/Simple: Url \t Json
        const partIndex = line.indexOf('\t');
        if (partIndex !== -1) {
          url = line.substring(0, partIndex).trim();
          jsonStr = line.substring(partIndex + 1).trim();
        } else {
          url = line.trim();
        }
      }

      // Skip header row if it looks like "URL | JSON"
      if (url.toLowerCase() === 'url' || url.includes('---')) return;

      let urlOk = false;
      let jsonOk = false;
      let errorMsg = '';

      // Check URL
      if (url.startsWith('http') && url.includes('erasmuslifehousing.com')) {
        urlOk = true;
      } else if (!url.startsWith('http')) {
        errorMsg = 'Bad URL';
      } else {
        errorMsg = 'Wrong Domain'; // Valid http but not erasmuslifehousing
      }

      // Check JSON
      let cleanJson = jsonStr;
      if (!jsonStr) {
        if (!errorMsg) errorMsg = 'No JSON';
      } else {
        // Handle escaping
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
          try {
            const unescaped = jsonStr.slice(1, -1).replace(/""/g, '"');
            JSON.parse(unescaped);
            cleanJson = unescaped;
            jsonOk = true;
          } catch (e) { /* ignored, try regular parse next */ }
        }

        if (!jsonOk) {
          try {
            JSON.parse(jsonStr);
            jsonOk = true;
            cleanJson = jsonStr;
          } catch (e) {
            if (!errorMsg) errorMsg = 'Bad JSON';
          }
        }
      }

      // Final Row Status
      let rowStatusHtml = '';
      if (urlOk && jsonOk) {
        rowStatusHtml = '<span style="color:green;">Ready</span>';
        validCount++;
      } else {
        rowStatusHtml = '<span style="color:red;">Ignoring</span>';
      }

      // Prepare Cells
      const encodedUrl = url.replace(/"/g, '&quot;');
      const encodedJson = cleanJson ? cleanJson.replace(/"/g, '&quot;') : '';
      const safeRawUrl = url.replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // URL Cell
      let urlCellInner = '';
      if (urlOk) {
        // Extract IDs
        // URL format: 
        // Room: .../listings/{listingID}/rooms/form/{roomID}
        // Listing: .../dashboard/admin/houses/form/{listingID}

        const roomMatch = url.match(/\/listings\/([^/]+)\/rooms\/form\/([^/]+)/);
        const listingMatch = url.match(/\/dashboard\/admin\/houses\/form\/([^/]+)/);

        let idsHtml = '';

        if (roomMatch) {
          idsHtml = `<div style="font-size:10px; color:black; line-height:1.2;">
                    listing: <b><code>${roomMatch[1]}</code></b><br>room: <b><code>${roomMatch[2]}</code></b>
                </div>`;
        } else if (listingMatch) {
          idsHtml = `<div style="font-size:10px; color:black; line-height:1.2;">
                    listing: <b><code>${listingMatch[1]}</code></b>
                </div>`;
        } else {
          idsHtml = `<div style="font-size:10px; color:black;">${safeRawUrl.substring(0, 30)}...</div>`;
        }

        urlCellInner = `
                <div style="display:flex; justify-content: space-between; align-items: center;">
                    <div style="text-align:left;">
                        ${idsHtml}
                    </div>
                    <div style="display:flex; gap:5px; align-items:center; margin-left:10px;">
                        <span style="color:green; font-weight:bold;">OK</span>
                        <div style="display:flex; gap:5px; flex-direction:column;">
                            <button class="batch-open-btn" data-url="${encodedUrl}" style="cursor:pointer; height: 5px; padding: 8px 0 8px; width: 50px; font-size: 10px;">👉URL</button>
                            <button class="batch-copy-btn" data-content="${encodedUrl}" style="cursor:pointer;height: 5px; padding: 8px 0 8px; width: 50px; font-size: 10px;">📋URL</button>
                        </div>
                    </div>
                </div>
            `;
      } else {
        // Red error type, black text
        urlCellInner = `<span style="color:red; font-weight:bold;">${errorMsg}</span> <span style="color:black; font-size:10px;">"${safeRawUrl.substring(0, 30)}${safeRawUrl.length > 30 ? '...' : ''}"</span>`;
      }

      // JSON Cell with SUMMARY
      let jsonCellInner = '';
      if (jsonOk) {
        let summaryHtml = '';
        try {
          const parsed = JSON.parse(cleanJson);

          // Generate Summary
          let summaryLines = [];
          if (parsed.room_data) {
            // We focus on room_data as per request
            summaryLines = formatJsonSummary({ room_data: parsed.room_data }); // Wrap to keep room_data root prefix
          } else {
            // Fallback if structure is different
            summaryLines = formatJsonSummary(parsed);
          }

          if (summaryLines.length > 0) {
            summaryHtml = summaryLines.map(line => `<div style="white-space: nowrap;">${line}</div>`).join('');
          } else {
            summaryHtml = '<span style="color:#888;">Empty Object</span>';
          }

        } catch (e) {
          summaryHtml = '<span style="color:red;">Parse check failed</span>';
        }

        jsonCellInner = `
                <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                    <div style="text-align:left; line-height:1.3; font-family: monospace; font-size: 10px; max-height: 120px; overflow-y: auto; width: 100%;">
                         ${summaryHtml}
                    </div>
                    <div style="display:flex; gap:5px; align-items:center; margin-left:10px;">
                        <button class="batch-copy-btn" data-content="${encodedJson}" style="cursor:pointer; font-size:10px; padding: 8px 0 8px; width: 50px;">📋<br>u-JSON</button>
                    </div>
                </div>
            `;
      } else {
        // If json was empty, just show 'Missing JSON'
        if (!jsonStr) {
          jsonCellInner = '<span style="color:red; font-weight:bold;">Missing JSON</span>';
        } else {
          jsonCellInner = `<span style="color:red; font-weight:bold;">Invalid JSON</span> <span style="color:black; font-size:10px;">"..."</span>`;
        }
      }

      html += `<tr data-original-index="${index}">`;
      html += `<td style="padding:5px; border:1px solid #ccc; text-align: center; color:#888;">${index + 1}</td>`;
      html += `<td style="padding:5px; border:1px solid #ccc;">${urlCellInner}</td>`;
      html += `<td style="padding:5px; border:1px solid #ccc; width: 400px; max-width: 400px;">${jsonCellInner}</td>`; // Fixed width
      html += `<td style="padding:5px; border:1px solid #ccc; color:#aaa; font-style:italic;" id="old-dates-${index}">-</td>`;
      html += `<td style="padding:5px; border:1px solid #ccc;">${rowStatusHtml}</td>`;
      html += `</tr>`;
    });

    html += '</table>';
    batchPreviewContainer.innerHTML = html;

    if (validCount > 0) {
      updateStartBtn(false);

      // Calculate Estimate: 15 seconds per room (slightly increased for safety)
      const totalSeconds = validCount * 15;
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      let statusText = `${validCount} / ${lines.length} valid rows. (≈ ${timeStr} to process)`;

      const limitVal = parseInt(autoPauseLimitEl.value, 10) || 0;
      const isHighMemory = ((limitVal === 0) && (validCount > 100)) || ((limitVal > 0) && (limitVal > 100));

      if (isHighMemory) {
        statusText += ' <span style="color:orange; font-weight:bold;">⚠️ High memory usage warning!</span>';
      }

      batchStatus.innerHTML = statusText;
    } else {
      updateStartBtn(true);
      batchStatus.textContent = lines.length > 0 ? 'No valid rows.' : '';
    }
  });

  async function processBatchLoop() {
    const text = batchInput.value;
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

    // Ensure button reflects running state immediately
    // handled by startBatch calling updateBatchUI

    let processedCount = 0;
    isStopRequested = false; // Reset flag

    // Capture current tab to refocus later
    const currentTab = await new Promise(resolve => chrome.tabs.getCurrent(resolve));

    for (let i = 0; i < lines.length; i++) {
      // 1. Check Stop
      if (isStopRequested) {
        break;
      }

      // 2. Check Pause
      if (batchState === 'PAUSED') {
        await new Promise(resolve => { resumeResolve = resolve; });
        // Re-check Stop after resume
        if (isStopRequested) break;
      }

      const line = lines[i];
      let url = '';
      let jsonStr = '';

      // 1. Try Markdown Table Format
      const pipeMatch = line.trim().match(/^\|(.*)\|(.*)\|$/);
      if (pipeMatch) {
        let rawUrlCol = pipeMatch[1].trim();
        let rawJsonCol = pipeMatch[2].trim();
        const mdLinkMatch = rawUrlCol.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (mdLinkMatch) url = mdLinkMatch[1].trim();
        else url = rawUrlCol;

        if (rawJsonCol.startsWith('`') && rawJsonCol.endsWith('`')) {
          jsonStr = rawJsonCol.slice(1, -1).trim();
        } else {
          jsonStr = rawJsonCol;
        }
      } else {
        // 2. TSV Fallback
        const partIndex = line.indexOf('\t');
        if (partIndex !== -1) {
          url = line.substring(0, partIndex).trim();
          jsonStr = line.substring(partIndex + 1).trim();
        } else {
          continue;
        }
      }

      if (url.toLowerCase() === 'url' || url.includes('---')) continue;
      if (!url.startsWith('http')) continue;

      // Handle Google Sheets escaping again for the actual data
      if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        try {
          const unescaped = jsonStr.slice(1, -1).replace(/""/g, '"');
          JSON.parse(unescaped);
          jsonStr = unescaped;
        } catch (e) { }
      }

      let jsonData;
      try {
        jsonData = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Skipping invalid JSON at row ' + (i + 1));
        continue;
      }

      batchStatus.textContent = `Processing row ${i + 1} / ${lines.length}...`;

      try {
        // Open Tab
        const tab = await chrome.tabs.create({ url: url, active: true });

        // Wait for it to load
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Wait a bit more for scripts to init
        await new Promise(r => setTimeout(r, 2000));

        // Send Message and wait for response
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'ELH_BATCH_RUN_STEP',
          data: jsonData,
          progress: { current: i + 1, total: lines.length }
        });

        processedCount++;

        // Update Status Cell logic
        const targetRow = batchPreviewContainer.querySelector(`tr[data-original-index="${i}"]`);
        if (targetRow) {
          const oldDatesCell = targetRow.children[3]; // 4th column (Old Dates)
          const statusCell = targetRow.children[4];   // 5th column (Status)

          if (response && response.stats) {
            const s = response.stats;

            // Populate Old Dates
            if (s.old_dates && s.old_dates.length > 0) {
              oldDatesCell.innerHTML = s.old_dates.map(d => `<div style="font-size:10px; line-height:1.2;"><b><code>${d}</code></b></div>`).join('');
              oldDatesCell.style.color = '#333';
              oldDatesCell.style.fontStyle = 'normal';
            } else {
              oldDatesCell.textContent = 'None';
            }

            const details = [];
            if (s.matched > 0) details.push(`<span style="color:gray" title="Already on site">${s.matched} same</span>`);
            if (s.deleted > 0) details.push(`<span style="color:red; font-weight:bold;" title="Old dates removed">-${s.deleted}</span>`);
            if (s.added > 0) details.push(`<span style="color:green; font-weight:bold;" title="New dates added">+${s.added}</span>`);
            if (s.ignored > 0) details.push(`<span style="color:orange;" title="Past dates ignored">Ign:${s.ignored}</span>`);

            if (details.length === 0) details.push('No changes');

            statusCell.innerHTML = `<div style="font-size:10px; display:flex; flex-direction:column;">
                    <span style="font-weight:bold;">✓</span>
                    <span>${details.join(', ')}</span>
                 </div>`;
          } else {
            statusCell.innerHTML = '<span style="font-weight:bold;">✓</span>';
          }
        }

      } catch (err) {
        console.error(`Error processing row ${i + 1}:`, err);
        batchStatus.textContent = `Error at row ${i + 1}: ${err.message}`;

        // Update table row with error
        const errorRow = batchPreviewContainer.querySelector(`tr[data-original-index="${i}"]`);
        if (errorRow) {
          const statusCell = errorRow.children[4]; // Status is 5th column now
          statusCell.innerHTML = `<span style="color:red; font-weight:bold;">Error</span>`;
        }
      }

      // Artificial delay between tabs
      await new Promise(r => setTimeout(r, 1000));
    }

    batchStatus.textContent = isStopRequested
      ? `Stopped by user. Processed ${processedCount} rows.`
      : `Done! Processed ${processedCount} rows.`;

    batchState = 'IDLE';
    updateBatchUI();

    // Refocus Options Page
    if (currentTab) {
      chrome.tabs.update(currentTab.id, { active: true });
    }
  }

  // Initial UI Initialize (replaces the HTML hardcoded button with our dynamic one)
  updateBatchUI();



} // end if batchInput
