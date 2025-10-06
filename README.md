ELH listing helper — storing Gemini API key securely

This extension reads the Gemini API key from the extension's local storage (not hardcoded in source).

How to set the key:
- Open the extension's Options page (right-click the extension -> Options), or open the `options.html` page.
- Paste your `GEMINI_API_KEY` into the field and click Save.
- Or upload a `.env` file containing a line like `GEMINI_API_KEY=YOUR_KEY`.

Developer notes:
- The key is stored in `chrome.storage.local` under `GEMINI_API_KEY`.
- `background.js` will return an error object if the key is not set.

Security:
- Don't commit your `.env` with keys to version control.
