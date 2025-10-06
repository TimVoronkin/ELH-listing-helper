// Save and load GEMINI_API_KEY to chrome.storage.local
document.addEventListener('DOMContentLoaded', () => {
  // UI elements
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

  // helper: fetch defaultPrompt.json from extension resources
  async function fetchDefaultPromptFile() {
    try {
      const resp = await fetch(chrome.runtime.getURL('defaultPrompt.json'));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      return json;
    } catch (err) {
      // fallback simple template if file not available
      return { contents: [{ parts: [{ text: '{{PROMPT}}' }] }] };
    }
  }

  // load existing key and promptObj
  chrome.storage.local.get(['GEMINI_API_KEY', 'PROMPT_OBJ'], (items) => {
    if (items && items.GEMINI_API_KEY) apiKeyInput.value = items.GEMINI_API_KEY;
    if (items && items.PROMPT_OBJ) {
      try {
        promptObjEl.value = JSON.stringify(items.PROMPT_OBJ, null, 2);
      } catch (e) {
        promptObjEl.value = String(items.PROMPT_OBJ);
      }
    } else {
      // load default from file
      fetchDefaultPromptFile().then((json) => {
        try {
          promptObjEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptObjEl.value = String(json);
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
    // validate JSON
    let parsed = null;
    try {
      parsed = JSON.parse(promptObjEl.value);
    } catch (err) {
      showStatus(jsonStatus, 'promptObj is not valid JSON: ' + err.message, false);
      return;
    }
    chrome.storage.local.set({ GEMINI_API_KEY: key, PROMPT_OBJ: parsed }, () => {
      showStatus(status, 'Saved.');
      showStatus(jsonStatus, 'promptObj saved.');
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['GEMINI_API_KEY', 'PROMPT_OBJ'], () => {
      apiKeyInput.value = '';
      // reset to default file
      fetchDefaultPromptFile().then((json) => {
        try {
          promptObjEl.value = JSON.stringify(json, null, 2);
        } catch (e) {
          promptObjEl.value = String(json);
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
    try {
      JSON.parse(promptObjEl.value);
      showStatus(jsonStatus, 'Valid JSON.');
    } catch (err) {
      showStatus(jsonStatus, 'Invalid JSON: ' + err.message, false);
    }
  });

  prettyBtn.addEventListener('click', () => {
    try {
      const p = JSON.parse(promptObjEl.value);
      promptObjEl.value = JSON.stringify(p, null, 2);
      showStatus(jsonStatus, 'Pretty printed.');
    } catch (err) {
      showStatus(jsonStatus, 'Invalid JSON: ' + err.message, false);
    }
  });

  defaultsBtn.addEventListener('click', async () => {
    const json = await fetchDefaultPromptFile();
    try {
      promptObjEl.value = JSON.stringify(json, null, 2);
      showStatus(jsonStatus, 'Default loaded.');
    } catch (e) {
      promptObjEl.value = String(json);
      showStatus(jsonStatus, 'Default loaded (non-JSON fallback).');
    }
  });

  // Test button: send a test prompt to background and show result
  const testBtn = document.getElementById('test');
  const testResult = document.getElementById('testResult');
  testBtn.addEventListener('click', async () => {
    showStatus(testResult, 'Running test...', true);
    let parsed;
    try {
      parsed = JSON.parse(promptObjEl.value);
    } catch (err) {
      showStatus(testResult, 'promptObj JSON invalid: ' + err.message, false);
      return;
    }
    // send sample prompt to background
    try {
      chrome.runtime.sendMessage({ action: 'gemini_request', prompt: 'Test prompt for preview' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime message error:', chrome.runtime.lastError);
          showStatus(testResult, 'Runtime error: ' + chrome.runtime.lastError.message, false);
          return;
        }
        console.log('Test result from background:', resp);
        try {
          testResult.textContent = JSON.stringify(resp, null, 2);
        } catch (e) {
          testResult.textContent = String(resp);
        }
      });
    } catch (err) {
      console.error('Test send error:', err);
      showStatus(testResult, 'Error sending test: ' + err.message, false);
    }
  });
});