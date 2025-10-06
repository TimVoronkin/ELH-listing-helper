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
    return { error: 'GEMINI_API_KEY not set in extension options.' };
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return data;
  } catch (err) {
    return { error: err.toString() };
  }
}
