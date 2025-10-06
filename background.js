chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

// Gemini API запрос
async function fetchGemini(prompt) {
  // Получаем ключ из chrome.storage
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['GEMINI_API_KEY'], (items) => resolve(items));
  });
  const apiKey = stored && stored.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in extension options.');
    return { error: 'GEMINI_API_KEY not set in extension options.' };
  }
  // load prompt template (PROMPT_OBJ) from storage
  const storedPrompt = await new Promise((resolve) => {
    chrome.storage.local.get(['PROMPT_OBJ'], (items) => resolve(items));
  });
  let promptObj = (storedPrompt && storedPrompt.PROMPT_OBJ) ? storedPrompt.PROMPT_OBJ : null;
  if (!promptObj) {
    // default
    promptObj = { contents: [{ parts: [{ text: prompt }] }] };
  } else {
    // deep copy and replace {{PROMPT}} placeholder in any string fields
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
      // if stored promptObj is invalid, fallback to simple body
      promptObj = { contents: [{ parts: [{ text: prompt }] }] };
    }
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  try {
    // If promptObj looks like a spec (instruction/examples/input/constraints), assemble a plain text prompt
    let finalBody;
    const isSpec = (p) => p && (p.instruction || p.examples || p.constraints || p.input || p.output_format);
    if (isSpec(promptObj)) {
      // Build a human-readable prompt text
      let assembled = '';
      if (promptObj.instruction) assembled += promptObj.instruction.trim() + '\n\n';
      // include constraints
      if (promptObj.constraints) {
        try { assembled += 'Constraints: ' + JSON.stringify(promptObj.constraints) + '\n\n'; } catch(e){}
      }
      // examples
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
      // input mapping: replace any placeholder values like 'roomDesc' or '{{PROMPT}}' with prompt
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
      // ask for output format briefly
      if (promptObj.output_format) {
        try { assembled += '\nOutput format: ' + JSON.stringify(promptObj.output_format) + '\n'; } catch(e){}
      }
  // send as contents/parts which the API expects in this project
  finalBody = { contents: [{ parts: [{ text: assembled }] }] };
    } else {
      // assume promptObj is already in API shape (or a content array); send it directly
      finalBody = promptObj;
    }
    console.log('Sending Gemini request to', endpoint);
    console.log('Final request body:', finalBody);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalBody)
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Gemini API returned error', response.status, text);
      return { error: `HTTP ${response.status}: ${text}` };
    }
    const data = await response.json();
    console.log('Gemini response:', data);
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
    return { error: err.toString() };
  }
}
