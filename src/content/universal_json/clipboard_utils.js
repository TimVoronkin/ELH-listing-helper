// src/content/universal_json/clipboard_utils.js

/**
 * Reads the clipboard text and attempts to parse it as JSON.
 * Validates against the expected 'Universal_ELH_json_data_by_Tim_v0' type.
 * @returns {Promise<Object|null>} The parsed JSON object or null if invalid/missing.
 */
export async function readClipboardJson() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
            console.warn('[ELH-Universal] Clipboard is empty.');
            return null;
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.warn('[ELH-Universal] Clipboard content is not valid JSON.');
            return null;
        }

        if (data?.json_meta?.json_type !== 'Universal_ELH_json_data_by_Tim_v0') {
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
