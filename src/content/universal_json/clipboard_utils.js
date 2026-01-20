// src/content/universal_json/clipboard_utils.js

/**
 * Reads the clipboard text and attempts to parse it as JSON.
 * Validates against the expected 'ELH_u-JSON_by_Tim_v1' type.
 * @returns {Promise<Object|null>} The parsed JSON object or null if invalid/missing.
 */
export async function readClipboardJson() {
    try {
        let text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
            console.warn('[ELH-Universal] Clipboard is empty.');
            return null;
        }

        text = text.trim();

        // Handle Google Sheets / Excel escaping (doubled quotes and surrounding quotes)
        // When copying a cell with special chars, Sheets wraps it in quotes and doubles internal quotes.
        // Example: "{""key"": ""value""}" -> {"key": "value"}
        if (text.startsWith('"') && text.endsWith('"')) {
            const unescaped = text.slice(1, -1).replace(/""/g, '"');
            // Ensure we only use the unescaped version if it looks like a JSON object
            if (unescaped.trim().startsWith('{')) {
                text = unescaped;
            }
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.warn('[ELH-Universal] Clipboard content is not valid JSON.');
            return null;
        }

        if (data?.json_meta?.json_type?.toLowerCase() !== 'elh_u-json_by_tim_v1') {
            console.warn('[ELH-Universal] JSON found, but missing correct json_type identifier.');
            // We might want to alert the user or just silently fail depending on strictness.
            // For now, silent fail is safer to avoid annoying users who copy other JSONs.
            return null;
        }

        return data;
    } catch (err) {
        console.error('[ELH-Universal] Failed to read clipboard:', err);
        return null;
    }
}
