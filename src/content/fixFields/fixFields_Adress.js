// src/content/fixFields/fixFields_Adress.js

(function () {
    console.log('[ELH-Tim] fixFields_Adress script loaded');

    const PROMPT_FILE_PATH = 'data/defaultPromptForAdress.json';
    const BUTTON_CLASS = 'elh-btn elh-fix-address-btn';

    // Ensure shared styles are loaded
    function loadSharedStyles() {
        const ID = "elh-shared-styles";
        if (document.getElementById(ID)) return;
        try {
            const link = document.createElement("link");
            link.id = ID;
            link.rel = "stylesheet";
            link.href = chrome.runtime.getURL("src/shared/buttons.css");
            document.head && document.head.appendChild(link);
        } catch (e) {
            console.warn('[ELH-Tim] Failed to inject shared styles', e);
        }
    }

    loadSharedStyles();

    function findTargetContainer() {
        const stepLocation = document.querySelector('div[data-sentry-component="StepLocation"]');
        if (!stepLocation) return null;

        const labels = Array.from(stepLocation.querySelectorAll('label'));
        const targetLabel = labels.find(l => l.textContent.trim().includes('Street address'));

        if (targetLabel) {
            return targetLabel.closest('.space-y-2.flex.flex-col') || targetLabel.parentElement;
        }
        return null;
    }

    function createFixButton() {
        const container = findTargetContainer();
        if (!container) return;

        if (container.querySelector('.elh-fix-address-btn')) return;

        const button = document.createElement('button');
        button.textContent = '✦ fix adress';
        button.className = BUTTON_CLASS;
        button.style.marginTop = '10px';
        button.type = 'button';

        button.addEventListener('click', handleFixAddress);

        container.appendChild(button);
        console.log('[ELH-Tim] fixFields_Adress button injected');
    }

    const observer = new MutationObserver((mutations) => {
        createFixButton();
    });

    observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFixButton);
    } else {
        createFixButton();
    }

    // Helper to highlight elements using shared script if available
    function highlight(el, color = 'green') {
        if (window.ELH && typeof window.ELH.highlightElement === 'function') {
            window.ELH.highlightElement(el, color);
        } else {
            // Fallback if shared script not loaded
            el.style.transition = 'all 0.5s ease';
            if (color === 'orange') {
                el.style.backgroundColor = '#fff7ed';
                el.style.borderColor = '#f97316';
            } else {
                el.style.backgroundColor = '#dcfce7';
                el.style.borderColor = '#22c55e';
            }
        }
    }

    async function handleFixAddress(e) {
        const btn = e.target;
        const container = btn.closest('.space-y-2.flex.flex-col') || btn.parentElement;

        const input = container.querySelector('input');

        if (!input) {
            console.error('[ELH-Tim] fixFields_Adress Input not found in container');
            return;
        }

        const inputAddress = input.value;
        console.log('[ELH-Tim] Input address:', inputAddress);

        if (!inputAddress) {
            alert('Please enter an address first');
            return;
        }

        // Highlight source input in orange
        highlight(input, 'orange');

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'waiting for AI response...';

        try {
            // Try to get prompt from storage first
            let promptTemplate;
            const storage = await chrome.storage.local.get(['PROMPT_ADDRESS_OBJ']);

            if (storage && storage.PROMPT_ADDRESS_OBJ) {
                console.log('[ELH-Tim] Using address prompt from storage');
                promptTemplate = storage.PROMPT_ADDRESS_OBJ;
            } else {
                console.log('[ELH-Tim] Using default address prompt file');
                const promptUrl = chrome.runtime.getURL(PROMPT_FILE_PATH);
                const promptResponse = await fetch(promptUrl);
                promptTemplate = await promptResponse.json();
            }

            const filledPrompt = JSON.parse(JSON.stringify(promptTemplate));
            filledPrompt.input = filledPrompt.input.replace('{{INPUT_ADRESS}}', inputAddress);

            console.log('[ELH-Tim] Sending Gemini request...');
            const response = await chrome.runtime.sendMessage({
                action: 'gemini_request',
                prompt: filledPrompt
            });
            console.log('[ELH-Tim] Gemini response:', response);

            if (response && response.candidates && response.candidates[0].content) {
                const text = response.candidates[0].content.parts[0].text;
                const json = extractJson(text);
                if (json) {
                    fillFields(json);
                    // Highlight source input in green to show success
                    highlight(input, 'green');
                } else {
                    console.error('[ELH-Tim] fixFields_Adress Failed to parse JSON from response', text);
                    alert('Failed to parse AI response. Check console for details.');
                }
            } else {
                console.error('[ELH-Tim] fixFields_Adress Invalid response from Gemini', response);
                alert('Error getting response from AI');
            }

        } catch (err) {
            console.error('[ELH-Tim] fixFields_Adress Error in handleFixAddress', err);
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    function extractJson(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            const match = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) {
                try {
                    return JSON.parse(match[1]);
                } catch (e2) {
                }
            }
            const first = text.indexOf('{');
            const last = text.lastIndexOf('}');
            if (first !== -1 && last !== -1) {
                try {
                    return JSON.parse(text.substring(first, last + 1));
                } catch (e3) {
                }
            }
            return null;
        }
    }

    function fillFields(data) {
        console.log('[ELH-Tim] Filling fields with:', data);
        const fields = [
            { key: 'StreetAddress', name: 'address' },
            { key: 'Floor', name: 'floor' },
            { key: 'BuildingNumber', name: 'doorNumber' },
            { key: 'Fraction', name: 'fraction' },
            { key: 'PostalCode', name: 'postalCode' },
            { key: 'Neighborhood', name: 'freguesia' },
            { key: 'Zone', name: 'zone' }
        ];

        fields.forEach(field => {
            if (data[field.key]) {
                const input = document.querySelector(`input[name="${field.name}"]`);
                if (input) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(input, data[field.key]);

                    const event = new Event('input', { bubbles: true });
                    input.dispatchEvent(event);

                    // Use shared highlight function
                    highlight(input, 'green');
                } else {
                    console.warn(`[ELH-Tim] Input for ${field.name} not found`);
                }
            }
        });
    }

})();
