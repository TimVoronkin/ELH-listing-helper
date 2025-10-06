// Save and load GEMINI_API_KEY to chrome.storage.local
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('save');
  const clearBtn = document.getElementById('clear');
  const envFile = document.getElementById('envFile');
  const status = document.getElementById('status');

  // load existing
  chrome.storage.local.get(['GEMINI_API_KEY'], (items) => {
    if (items && items.GEMINI_API_KEY) apiKeyInput.value = items.GEMINI_API_KEY;
  });

  saveBtn.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    chrome.storage.local.set({ GEMINI_API_KEY: val }, () => {
      status.textContent = 'Saved.';
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove('GEMINI_API_KEY', () => {
      apiKeyInput.value = '';
      status.textContent = 'Cleared.';
    });
  });

  envFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      // parse simple .env lines
      const m = text.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
      if (m) {
        const found = m[1].trim();
        // remove surrounding quotes
        const key = found.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        chrome.storage.local.set({ GEMINI_API_KEY: key }, () => {
          apiKeyInput.value = key;
          status.textContent = '.env parsed and saved.';
        });
      } else {
        status.textContent = 'No GEMINI_API_KEY found in .env file.';
      }
    };
    reader.readAsText(file);
  });
});