// background.js (moved to src/background)
// Minimal content: original background logic preserved
// Note: this file is a copy of the root background.js relocated into src for better project structure

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'download') {
    try {
      const opt = { url: request.url, filename: `ELH-helper/${request.filename}`, conflictAction: 'uniquify', saveAs: false };
      chrome.downloads.download(opt, (id) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ id });
        }
      });
      return true; // async
    } catch (e) {
      sendResponse({ error: String(e) });
      return false;
    }
  }
  if (request.action === 'capture_screenshot') {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      sendResponse({screenshot: dataUrl});
    });
    return true; // keep the message channel open for sendResponse
  }
  if (request.action === 'gemini_request') {
    fetchGemini(request.prompt).then(sendResponse);
    return true;
  }
});

// Gemini API request
async function fetchGemini(prompt) {
  let promptParam = prompt;
  try {
    if (typeof prompt === 'string') {
      const maybe = JSON.parse(prompt);
      if (maybe && typeof maybe === 'object') promptParam = maybe;
    }
  } catch (e) {}
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['GEMINI_API_KEY'], (items) => resolve(items));
  });
  const apiKey = stored && stored.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in extension options.');
    return { error: 'GEMINI_API_KEY not set in extension options.' };
  }
  const storedPrompt = await new Promise((resolve) => {
    chrome.storage.local.get(['PROMPT_OBJ'], (items) => resolve(items));
  });
  let promptObj = null;
  const isSpec = (p) => p && (p.instruction || p.examples || p.constraints || p.input || p.output_format);
  if (isSpec(promptParam)) {
    promptObj = promptParam;
  } else {
    promptObj = (storedPrompt && storedPrompt.PROMPT_OBJ) ? storedPrompt.PROMPT_OBJ : null;
    if (!promptObj) {
      promptObj = { contents: [{ parts: [{ text: prompt }] }] };
    } else {
      try {
        const copy = JSON.parse(JSON.stringify(promptObj));
        const replacer = (obj) => {
          if (typeof obj === 'string') return obj.replace(/{{PROMPT}}/g, prompt);
          if (Array.isArray(obj)) return obj.map(replacer);
          if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => { obj[k] = replacer(obj[k]); });
            return obj;
          }
          return obj;
        };
        promptObj = replacer(copy);
      } catch (e) {
        promptObj = { contents: [{ parts: [{ text: prompt }] }] };
      }
    }
  }
  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  try {
    const storedModel = await new Promise((resolve) => {
      chrome.storage.local.get(['GEMINI_MODEL'], (items) => resolve(items));
    });
    if (storedModel && storedModel.GEMINI_MODEL) {
      const model = storedModel.GEMINI_MODEL;
      const safe = String(model).replace(/[^a-zA-Z0-9._:-]/g, '');
      if (safe) {
        const parts = endpoint.split('/models/');
        if (parts.length === 2) endpoint = parts[0] + '/models/' + safe + ':generateContent?key=' + apiKey;
      }
    }
  } catch (e) {}
  try {
    let finalBody;
    if (isSpec(promptObj)) {
      let assembled = '';
      if (promptObj.instruction) assembled += promptObj.instruction.trim() + '\n\n';
      if (promptObj.constraints) {
        try { assembled += 'Constraints: ' + JSON.stringify(promptObj.constraints) + '\n\n'; } catch(e){}
      }
      if (Array.isArray(promptObj.examples)) {
        assembled += 'Examples:\n';
        promptObj.examples.forEach((ex) => {
          try {
            if (ex.input) assembled += 'Input: ' + JSON.stringify(ex.input) + '\n';
            if (ex.output) assembled += 'Output: ' + JSON.stringify(ex.output) + '\n';
            assembled += '\n';
          } catch(e){}
        });
      }
      if (promptObj.input && typeof promptObj.input === 'object') {
        Object.keys(promptObj.input).forEach((k) => {
          let v = promptObj.input[k];
          if (typeof v === 'string' && (v === 'roomDesc' || v.includes('{{PROMPT}}') || v.toLowerCase().includes('prompt'))) {
            assembled += k + ': ' + prompt + '\n';
          } else {
            assembled += k + ': ' + String(v) + '\n';
          }
        });
      }
      if (promptObj.output_format) {
        try { assembled += '\nOutput format: ' + JSON.stringify(promptObj.output_format) + '\n'; } catch(e){}
      }
      try {
        // Build parts array: main text first, then optionally an image part or image URL text
        const parts = [{ text: assembled }];
        const modelName = (storedModel && storedModel.GEMINI_MODEL) ? String(storedModel.GEMINI_MODEL) : '';
        const supportsImage = /vision|image|multimodal|vision-/.test(modelName.toLowerCase());
        if (promptObj.input && typeof promptObj.input.image === 'string' && promptObj.input.image.trim()) {
          const imgVal = promptObj.input.image.trim();
          if (supportsImage) {
            // If the selected model appears to support images, try to attach binary imageBytes
            if (imgVal.startsWith('data:')) {
              try {
                const m = imgVal.match(/^data:([^;]+);base64,(.*)$/s);
                if (m && m[2]) {
                  const base64 = m[2];
                  parts.push({ image: { imageBytes: base64 } });
                } else {
                  // couldn't parse base64, fall back to embedding the full data URL as text
                  parts.push({ text: '\n\nImage data (unable to attach binary): ' + imgVal.slice(0,200) });
                }
              } catch (e) {
                parts.push({ text: '\n\nImage data (error parsing): ' + String(e) });
              }
            } else {
              // non-data URL (assume external URL) - include as imageUri if supported
              parts.push({ image: { imageUri: imgVal } });
            }
          } else {
            // Selected model likely doesn't support images — include a textual hint instead to avoid API errors
            console.warn('GEMINI_MODEL does not appear to support images, sending image as text hint. Model:', modelName);
            if (imgVal.startsWith('data:')) {
              parts.push({ text: '\n\nImage (data omitted) — base64 length: ' + String(imgVal.length) });
            } else {
              parts.push({ text: '\n\nImage URL: ' + imgVal + '\n(If you can access the image, describe what you see. If you cannot access external URLs, say so.)' });
            }
          }
        }
        finalBody = { contents: [{ parts: parts }] };
      } catch (e) {
        finalBody = { contents: [{ parts: [{ text: assembled }] }] };
      }
    } else {
      finalBody = promptObj;
    }
    console.log('Sending Gemini request to', endpoint);
    // Prepare a redacted copy for debugging (don't log full base64 blobs)
    try {
      const redacted = JSON.parse(JSON.stringify(finalBody));
      if (redacted && redacted.contents && Array.isArray(redacted.contents)) {
        redacted.contents.forEach(c => {
          if (c.parts && Array.isArray(c.parts)) {
            c.parts = c.parts.map(p => {
              if (p && p.image && p.image.imageBytes) {
                const b = String(p.image.imageBytes || '');
                // try to guess mime from original promptObj? not available here; show length
                return { image: { imageBytes: `BASE64_LEN:${b.length}` } };
              }
              if (p && p.image && p.image.imageUri) {
                return { image: { imageUri: String(p.image.imageUri).slice(0,200) } };
              }
              if (p && p.text && typeof p.text === 'string' && p.text.length > 1000) {
                return { text: p.text.slice(0,1000) + '... (truncated)' };
              }
              return p;
            });
          }
        });
      }
      console.log('Final request body (redacted):', redacted);
      // store for inspection from extension devtools / console
      try {
        chrome.storage.local.set({ LAST_GEMINI_PAYLOAD: redacted });
      } catch (e) {}
    } catch (e) {
      console.log('Failed to redact finalBody for logging', e);
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalBody)
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Gemini API returned error', response.status, text);
      try {
        const parsed = JSON.parse(text);
        let retry = null;
        if (parsed && parsed.error && parsed.error.details) {
          for (const d of parsed.error.details) {
            if (d['@type'] && d['@type'].includes('RetryInfo') && d.retryDelay) {
              retry = d.retryDelay;
              break;
            }
          }
        }
        return { error: `HTTP ${response.status}: ${parsed.error && parsed.error.message ? parsed.error.message : text}`, retryDelay: retry };
      } catch (e) {
        return { error: `HTTP ${response.status}: ${text}` };
      }
    }
    const data = await response.json();
    console.log('Gemini response:', data);
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
    return { error: err.toString() };
  }
}
