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
  const jsonDescStatus = document.getElementById('jsonDescStatus');

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

  function showStatus(el, text, ok = true) {
    el.textContent = text;
    el.style.color = ok ? '#0b6623' : '#b30000';
  }

  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const openListingRoomsInBG = openListingRoomsInBGCheckbox ? openListingRoomsInBGCheckbox.checked : false;
    const openInSameTabGroup = openInSameTabGroupCheckbox ? openInSameTabGroupCheckbox.checked : false;
    let parsed = null;
    try {
      parsed = JSON.parse(promptObjEl.value);
    } catch (err) {
      showStatus(jsonStatus, 'promptObj is not valid JSON: ' + err.message, false);
      return;
    }
    let parsedDesc = null;
    try {
      parsedDesc = JSON.parse(promptDescEl.value);
    } catch (err) {
      showStatus(jsonDescStatus, 'promptDesc is not valid JSON: ' + err.message, false);
      return;
    }
  chrome.storage.local.set({ GEMINI_API_KEY: key, PROMPT_OBJ: parsed, openListingRoomsInBG: openListingRoomsInBG, openInSameTabGroup: openInSameTabGroup }, () => {
      // save description prompt as well
      chrome.storage.local.set({ PROMPT_DESC_OBJ: parsedDesc }, () => {
        showStatus(status, 'Saved.');
        showStatus(jsonStatus, 'promptObj saved.');
        showStatus(jsonDescStatus, 'promptDesc saved.');
      });
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['GEMINI_API_KEY', 'PROMPT_OBJ', 'PROMPT_DESC_OBJ', 'openListingRoomsInBG', 'openInSameTabGroup'], () => {
      apiKeyInput.value = '';
      if (openListingRoomsInBGCheckbox) openListingRoomsInBGCheckbox.checked = false;
      if (openInSameTabGroupCheckbox) openInSameTabGroupCheckbox.checked = false;
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
      showStatus(status, 'Cleared.');
      showStatus(jsonStatus, 'promptObj cleared.');
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

  // Load checkbox state for openListingRoomsInBG and openInSameTabGroup
  const openListingRoomsInBGCheckbox = document.getElementById('openListingRoomsInBG');
  const openInSameTabGroupCheckbox = document.getElementById('openInSameTabGroup');
  if (openListingRoomsInBGCheckbox || openInSameTabGroupCheckbox) {
    chrome.storage.local.get(['openListingRoomsInBG', 'openInSameTabGroup'], (items) => {
      if (openListingRoomsInBGCheckbox && items && items.openListingRoomsInBG !== undefined) {
        openListingRoomsInBGCheckbox.checked = items.openListingRoomsInBG;
      }
      if (openInSameTabGroupCheckbox && items && items.openInSameTabGroup !== undefined) {
        openInSameTabGroupCheckbox.checked = items.openInSameTabGroup;
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
        if (chrome.runtime.lastError) { console.error('Runtime message error:', chrome.runtime.lastError); showStatus(testResult, 'Runtime error: ' + chrome.runtime.lastError.message, false); return; }
        try { testResult.textContent = JSON.stringify(resp, null, 2); } catch (e) { testResult.textContent = String(resp); }
      });
    } catch (err) { console.error('Test send error:', err); showStatus(testResult, 'Error sending test: ' + err.message, false); }
  });
});
