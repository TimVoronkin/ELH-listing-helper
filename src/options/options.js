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
  });
});
