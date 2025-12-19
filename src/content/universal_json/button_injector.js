// src/content/universal_json/button_injector.js
import { readClipboardJson } from './clipboard_utils.js';
import { detectContext } from './page_detector.js';

export class ButtonInjector {
    constructor() {
        this.containerId = 'UniversalJsonPasteContainer';
        this.buttonId = 'universal-paste-json-btn';
        this.observer = null;
    }

    init() {
        console.log('[ELH-helper] [universal_json/button_injector.js] Initializing ButtonInjector...');
        this.injectSharedStyles();
        this.cleanUpOldElements(); // Cleanup just in case
        this.monitorNavigation();
        this.monitorDOM();
        // Initial check immediately
        this.tryInject();
    }

    injectSharedStyles() {
        // We reuse the existing shared styles or inject new specific ones if needed.
        // For now, we rely on the extension's existing styles or assume generic button classes.
    }

    isAllowedPage() {
        const url = window.location.href;
        try {
            const u = new URL(url);
            if (u.hostname !== "www.erasmuslifehousing.com") return false;
            const p = u.pathname.replace(/\/+/g, "/");

            // Landlord creation/editing
            // https://www.erasmuslifehousing.com/dashboard/admin/landlords/create
            // https://www.erasmuslifehousing.com/dashboard/admin/landlords/l0w9Oe2J/edit
            if (p.includes('/dashboard/admin/landlords/') && (p.endsWith('/create') || p.endsWith('/edit'))) {
                console.log('[ELH-helper] [universal_json/button_injector.js] allowed page: Landlord');
                return true;
            }

            // Listing creation/editing
            // https://www.erasmuslifehousing.com/dashboard/admin/houses/form
            // https://www.erasmuslifehousing.com/dashboard/admin/houses/form/qR39D5
            if (p.includes('/dashboard/admin/houses/form')) {
                console.log('[ELH-helper] [universal_json/button_injector.js] allowed page: Listing/House');
                return true;
            }

            // Room creation/editing (inside listing)
            // https://www.erasmuslifehousing.com/dashboard/admin/listings/qR39D5/rooms/form
            // https://www.erasmuslifehousing.com/dashboard/admin/listings/qR39D5/rooms/form/YlwDNq68
            if (p.includes('/dashboard/admin/listings/') && p.includes('/rooms/form')) {
                console.log('[ELH-helper] [universal_json/button_injector.js] allowed page: Room');
                return true;
            }

            return false;
        } catch (e) {
            console.error('[ELH-helper] [universal_json/button_injector.js] URL parsing error:', e);
            return false;
        }
    }

    cleanUpOldElements() {
        const existingBtn = document.getElementById(this.buttonId);
        if (existingBtn) {
            console.log('[ELH-helper] [universal_json/button_injector.js] Removing existing button.');
            existingBtn.remove();
        }
        const container = document.getElementById(this.containerId);
        if (container) container.remove();
    }

    createButton() {
        const btn = document.createElement('button');
        btn.id = this.buttonId;
        btn.type = 'button';
        btn.textContent = 'Paste Universal JSON';
        // Reuse similar classes to existing buttons for consistency, or add new ones
        btn.className = 'elh-btn elh-paste-btn universal-paste-btn';
        btn.style.cssText = `
            position: fixed;
bottom: 15px;
    right: 210px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            font-weight: bold;
        `;

        btn.addEventListener('click', () => this.handlePasteClick());
        return btn;
    }

    async handlePasteClick() {
        console.log('[ELH-helper] [universal_json/button_injector.js] Button clicked.');
        const btn = document.getElementById(this.buttonId);
        if (btn) btn.disabled = true;

        try {
            const jsonData = await readClipboardJson();
            if (!jsonData) {
                console.warn('[ELH-helper] [universal_json/button_injector.js] No valid Universal JSON in clipboard.');
                alert('No valid Universal ELH JSON found in clipboard.');
                return;
            }

            const context = detectContext();
            console.log('[ELH-helper] [universal_json/button_injector.js] Context detected:', context);

            if (context.pageType === 'unknown') {
                console.warn('[ELH-helper] [universal_json/button_injector.js] Unknown page context.');
                alert('Could not detect a supported page context.');
                return;
            }

            await this.dispatchToMapper(context, jsonData);

        } catch (error) {
            console.error('[ELH-helper] [universal_json/button_injector.js] Paste error:', error);
            alert('Error during paste operation: ' + error.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async dispatchToMapper(context, jsonData) {
        console.log(`[ELH-helper] [universal_json/button_injector.js] Dispatching to mapper for: ${context.pageType}, Step: ${context.step}`);

        let mapperModule;
        try {
            if (context.pageType === 'room') {
                const module = await import('./mappings/room.js');
                mapperModule = module.RoomMapper;
            } else if (context.pageType === 'listing') {
                const module = await import('./mappings/listing.js');
                mapperModule = module.ListingMapper;
            } else if (context.pageType === 'landlord') {
                const module = await import('./mappings/landlord.js');
                mapperModule = module.LandlordMapper;
            }

            if (mapperModule) {
                await mapperModule.handle(context.step, jsonData, context.element);
            } else {
                console.warn(`[ELH-helper] [universal_json/button_injector.js] No mapper found for pageType: ${context.pageType}`);
            }
        } catch (e) {
            console.error('[ELH-helper] [universal_json/button_injector.js] Failed to load or execute mapper:', e);
        }
    }

    tryInject() {
        // console.log('[ELH-helper] [universal_json/button_injector.js] tryInject checking...');
        if (!this.isAllowedPage()) {
            // If we are mostly just removing, we might not want to spam logs unless we actually removed something
            if (document.getElementById(this.buttonId)) {
                this.cleanUpOldElements();
            }
            return;
        }

        if (document.getElementById(this.buttonId)) return; // Already there

        const container = document.createElement('div');
        container.id = this.containerId;
        document.body.appendChild(container);

        const btn = this.createButton();
        container.appendChild(btn);
        console.log('[ELH-helper] [universal_json/button_injector.js] Button injected successfully.');
    }

    monitorNavigation() {
        // SPA handling involves patching history and listening to popstate
        const originalPush = history.pushState;
        const originalReplace = history.replaceState;

        history.pushState = function () {
            originalPush.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
        };

        history.replaceState = function () {
            originalReplace.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
        };

        window.addEventListener('popstate', () => {
            console.log('[ELH-helper] [universal_json/button_injector.js] popstate event');
            this.tryInject();
        });
        window.addEventListener('locationchange', () => {
            console.log('[ELH-helper] [universal_json/button_injector.js] locationchange event');
            this.tryInject();
        });
    }

    monitorDOM() {
        // Sometimes body is replaced or significantly changed
        this.observer = new MutationObserver(() => {
            if (this.isAllowedPage() && !document.getElementById(this.buttonId)) {
                this.tryInject();
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}
