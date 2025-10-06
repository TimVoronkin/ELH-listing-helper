chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture_screenshot') {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      sendResponse({screenshot: dataUrl});
    });
    return true; // keep the message channel open for sendResponse
  }
});
