// src/content/universal_json/main.js
import { ButtonInjector } from './button_injector.js';

console.log('[ELH-helper] [universal_json/main.js] Universal JSON Paster module loaded.');

// Initialize the button injector to handle button visibility and lifecycle
const injector = new ButtonInjector();
try {
    injector.init();
    console.log('[ELH-helper] [universal_json/main.js] Injector initialized.');
} catch (e) {
    console.error('[ELH-helper] [universal_json/main.js] Failed to initialize injector:', e);
}
