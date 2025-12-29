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

    chrome.storage.local.set({ GEMINI_API_KEY: key, PROMPT_OBJ: parsed, openListingRoomsInBG: openListingRoomsInBG, openInSameTabGroup: openInSameTabGroup, deleteBlockedDatesBeforePasting: deleteBlockedDatesBeforePasting, RANDOMIZED_ROOM_NAMES: randomNames }, () => {
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
    chrome.storage.local.remove(['GEMINI_API_KEY', 'PROMPT_OBJ', 'PROMPT_DESC_OBJ', 'PROMPT_ADDRESS_OBJ', 'openListingRoomsInBG', 'openInSameTabGroup', 'deleteBlockedDatesBeforePasting', 'RANDOMIZED_ROOM_NAMES'], () => {
      apiKeyInput.value = '';
      if (openListingRoomsInBGCheckbox) openListingRoomsInBGCheckbox.checked = false;
      if (openInSameTabGroupCheckbox) openInSameTabGroupCheckbox.checked = false;
      if (deleteBlockedDatesBeforePastingCheckbox) deleteBlockedDatesBeforePastingCheckbox.checked = false;
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
  const openListingRoomsInBGCheckbox = document.getElementById('openListingRoomsInBG');
  const openInSameTabGroupCheckbox = document.getElementById('openInSameTabGroup');
  const deleteBlockedDatesBeforePastingCheckbox = document.getElementById('deleteBlockedDatesBeforePasting');
  if (openListingRoomsInBGCheckbox || openInSameTabGroupCheckbox || deleteBlockedDatesBeforePastingCheckbox) {
    chrome.storage.local.get(['openListingRoomsInBG', 'openInSameTabGroup', 'deleteBlockedDatesBeforePasting'], (items) => {
      if (openListingRoomsInBGCheckbox && items && items.openListingRoomsInBG !== undefined) {
        openListingRoomsInBGCheckbox.checked = items.openListingRoomsInBG;
      }
      if (openInSameTabGroupCheckbox && items && items.openInSameTabGroup !== undefined) {
        openInSameTabGroupCheckbox.checked = items.openInSameTabGroup;
      }
      if (deleteBlockedDatesBeforePastingCheckbox && items && items.deleteBlockedDatesBeforePasting !== undefined) {
        deleteBlockedDatesBeforePastingCheckbox.checked = items.deleteBlockedDatesBeforePasting;
      }
    });
  }

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
  const batchStatus = document.getElementById('batchStatus');

  if (batchInput) {
    // Delegated listener for buttons in the table
    batchPreviewContainer.addEventListener('click', (e) => {
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
      } else if (e.target.closest('.batch-open-btn')) {
        const btn = e.target.closest('.batch-open-btn');
        const url = btn.getAttribute('data-url');
        if (url) {
          window.open(url, '_blank');
        }
      }
    });

    batchInput.addEventListener('input', () => {
      const text = batchInput.value;
      if (!text.trim()) {
        batchPreviewContainer.innerHTML = '<p style="color: #888; font-style: italic;">Preview will appear here...</p>';
        batchProcessBtn.disabled = true;
        batchProcessBtn.classList.remove('primary');
        batchStatus.textContent = '';
        return;
      }

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        batchPreviewContainer.innerHTML = '<p style="color: #888; font-style: italic;">Preview will appear here...</p>';
        batchProcessBtn.disabled = true;
        batchProcessBtn.classList.remove('primary');
        batchStatus.textContent = '';
        return;
      }

      let html = '<table style="width:100%; border-collapse: collapse; font-size: 11px;">';
      html += '<tr style="background:#eee; text-align:left;">';
      html += '<th style="padding:5px; border:1px solid #ccc; width: 30px; color: #666;">Row</th>';
      html += '<th style="padding:5px; border:1px solid #ccc;">URL</th>';
      html += '<th style="padding:5px; border:1px solid #ccc;">u-JSON</th>';
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
          rowStatusHtml = '<span style="color:green; font-weight:bold;">Ready</span>';
          validCount++;
        } else {
          rowStatusHtml = '<span style="color:red; font-weight:bold;">ignoring</span>';
        }

        // Prepare Cells
        const encodedUrl = url.replace(/"/g, '&quot;');
        const encodedJson = cleanJson ? cleanJson.replace(/"/g, '&quot;') : '';
        const safeRawUrl = url.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // URL Cell
        let urlCellInner = '';
        if (urlOk) {
          // Extract IDs
          // URL format: .../listings/{listingID}/rooms/form/{roomID}
          // Fix regex to be less greedy or direct
          const idMatch = url.match(/\/listings\/([^/]+)\/rooms\/form\/([^/]+)/);
          let idsHtml = '';

          if (idMatch) {
            idsHtml = `<div style="font-size:10px; color:black; line-height:1.2;">
                    listing: <b><code>${idMatch[1]}</code></b>, room: <b><code>${idMatch[2]}</code></b>
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
                        <button class="batch-open-btn" data-url="${encodedUrl}" style="cursor:pointer; font-size:10px;">Open</button>
                        <button class="batch-copy-btn" data-content="${encodedUrl}" style="cursor:pointer; font-size:10px;">Copy</button>
                    </div>
                </div>
            `;
        } else {
          // Red error type, black text
          urlCellInner = `<span style="color:red; font-weight:bold;">${errorMsg}</span> <span style="color:black; font-size:10px;">"${safeRawUrl.substring(0, 30)}${safeRawUrl.length > 30 ? '...' : ''}"</span>`;
        }

        // JSON Cell
        let jsonCellInner = '';
        if (jsonOk) {
          let datesHtml = '';
          try {
            const parsed = JSON.parse(cleanJson);
            // Check for blocked dates structure
            const dates = parsed?.room_data?.BlockedDatesStep?.blocked_dates;
            if (Array.isArray(dates) && dates.length > 0) {
              datesHtml = dates.map(d => `<div style="font-size:10px; white-space: nowrap;"><b><code>${d.start}</code></b> - <b><code>${d.end}</code></b></div>`).join('');
            } else {
              datesHtml = '<span style="font-size:10px; color:#888;">No dates found</span>';
            }
          } catch (e) {
            datesHtml = '<span style="font-size:10px; color:red;">Parse check failed</span>';
          }

          jsonCellInner = `
                <div style="display:flex; justify-content: space-between; align-items: center;">
                    <div style="text-align:left; line-height:1.2;">
                         ${datesHtml}
                    </div>
                    <div style="display:flex; gap:5px; align-items:center; margin-left:10px;">
                        <span style="color:green; font-weight:bold;">OK</span>
                        <button class="batch-copy-btn" data-content="${encodedJson}" style="cursor:pointer; font-size:10px;">Copy</button>
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

        html += `<tr>`;
        html += `<td style="padding:5px; border:1px solid #ccc; text-align: center; color:#888;">${index + 1}</td>`;
        html += `<td style="padding:5px; border:1px solid #ccc;">${urlCellInner}</td>`;
        html += `<td style="padding:5px; border:1px solid #ccc;">${jsonCellInner}</td>`;
        html += `<td style="padding:5px; border:1px solid #ccc;">${rowStatusHtml}</td>`;
        html += `</tr>`;
      });

      html += '</table>';
      batchPreviewContainer.innerHTML = html;

      if (validCount > 0) {
        batchProcessBtn.disabled = false;
        batchProcessBtn.classList.add('primary');
        batchStatus.textContent = `${validCount} / ${lines.length} ready.`;
      } else {
        batchProcessBtn.disabled = true;
        batchProcessBtn.classList.remove('primary');
        batchStatus.textContent = lines.length > 0 ? 'No valid rows.' : '';
      }
    });

    batchProcessBtn.addEventListener('click', async () => {
      const text = batchInput.value;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

      batchProcessBtn.disabled = true;
      let processedCount = 0;

      for (let i = 0; i < lines.length; i++) {
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
            // If it's just a URL line or empty validation in loop...
            // But for processing we mostly care if we have both
            // If single line, assume it's invalid for processing
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

          // Send Message
          await chrome.tabs.sendMessage(tab.id, {
            action: 'ELH_BATCH_RUN_STEP',
            data: jsonData
          });

          processedCount++;

        } catch (err) {
          console.error(`Error processing row ${i + 1}:`, err);
          batchStatus.textContent = `Error at row ${i + 1}: ${err.message}`;
          // Continue to next row? maybe pause? 
          // For now, continue but maybe slow down
        }

        // Artificial delay between tabs to not overwhelm
        await new Promise(r => setTimeout(r, 1000));
      }

      batchStatus.textContent = `Done! Processed ${processedCount} rows.`;
      batchProcessBtn.disabled = false;
    });

  } // end if batchInput
});
