
/**
 * Sets the value of a standard input or textarea and dispatches events.
 * Highlight: Green if changed, Gray if already correct.
 */
export function setInputValue(element, targetValue) {
    if (!element) return;
    const cleanValue = targetValue.toString();

    // Check if value actually changes
    if (element.value === cleanValue) {
        highlightElement(element, 'gray');
        // console.log(`[ELH-Debug] Field '${element.name||element.id}' already correct: ${cleanValue}`);
        return;
    }

    console.log(`[ELH-Universal] Setting input '${element.name || element.id}' -> '${cleanValue}'`);

    // Attempt to use native value setter to bypass React 15/16 overrides
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

    if (element.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(element, cleanValue);
    } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, cleanValue);
    } else {
        element.value = cleanValue;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));

    highlightElement(element, 'green');
}

/**
 * Highlights an element using the shared visual utility.
 * @param {HTMLElement} element 
 * @param {string} color - 'green' (updated) or 'gray' (unchanged)
 */
export function highlightElement(element, color = 'green') {
    if (!element) return;
    if (window.ELH && typeof window.ELH.highlightElement === 'function') {
        window.ELH.highlightElement(element, color);
    } else {
        // Simple fallback
        const originalTransition = element.style.transition;
        const originalBorder = element.style.border;
        element.style.transition = 'border-color 0.3s ease';
        element.style.border = `2px solid ${color === 'gray' ? 'gray' : '#28a745'}`;
        setTimeout(() => {
            element.style.border = originalBorder;
            element.style.transition = originalTransition;
        }, 2000);
    }
}

/**
 * Sets a checkbox state.
 */
export function setCheckbox(labelText, targetValue, contextScope = document) {
    const btn = findButtonByLabel(labelText, "checkbox", contextScope);
    if (!btn) {
        console.warn(`[ELH-Universal] Checkbox for '${labelText}' not found.`);
        return false;
    }

    const isChecked = btn.getAttribute("data-state") === "checked" || btn.getAttribute("aria-checked") === "true";

    if (isChecked !== targetValue) {
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        btn.click();
        highlightElement(btn, 'green');
        console.log(`[ELH-Universal] Set checkbox '${labelText}' to ${targetValue}`);
    } else {
        highlightElement(btn, 'gray');
    }
    return true;
}

/**
 * Sets a radio button.
 */
export function setRadio(groupLabelText, optionLabelText, contextScope = document) {
    const btn = findRadioButtonByLabel(groupLabelText, optionLabelText, contextScope);

    if (btn) {
        const isChecked = btn.getAttribute("data-state") === "checked" || btn.getAttribute("aria-checked") === "true";
        console.log(`[ELH-Debug] setRadio('${groupLabelText}', '${optionLabelText}') -> Found BTN ID: ${btn.id}, isChecked: ${isChecked}`);

        if (!isChecked) {
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            btn.click();
            highlightElement(btn, 'green');
            console.log(`[ELH-Universal] Set radio '${groupLabelText}' -> '${optionLabelText}'`);
        } else {
            console.log(`[ELH-Debug] Radio '${groupLabelText}' -> '${optionLabelText}' already checked.`);
            highlightElement(btn, 'gray');
        }
        return true;
    }
    console.warn(`[ELH-Universal] Radio button not found: Group='${groupLabelText}', Option='${optionLabelText}'`);
    return false;
}

/**
 * Sets a select dropdown value.
 */
export function setSelect(labelText, value, contextScope = document) {
    const select = findSelectByLabel(labelText, contextScope);
    if (!select) {
        console.warn(`[ELH-Universal] Select '${labelText}' not found.`);
        return false;
    }

    const options = Array.from(select.options);
    const matchedOption = options.find(opt =>
        (opt.value || '').toLowerCase() === (value || '').toLowerCase() ||
        (opt.text || '').toLowerCase() === (value || '').toLowerCase()
    );

    if (matchedOption) {
        if (select.value !== matchedOption.value) {
            const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
            if (nativeSelectValueSetter) {
                nativeSelectValueSetter.call(select, matchedOption.value);
            } else {
                select.value = matchedOption.value;
            }

            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            highlightElement(getVisualElement(select), 'green');
            console.log(`[ELH-Universal] Set select '${labelText}' -> '${matchedOption.value}'`);
        } else {
            highlightElement(getVisualElement(select), 'gray');
        }
        return true;
    } else {
        console.warn(`[ELH-Universal] Option '${value}' not found in select '${labelText}'.`);
        return false;
    }
}

// Helper to find the visible element if actual input is hidden (e.g. Radix UI / ShadCN)
function getVisualElement(el) {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const isHidden = el.classList.contains('sr-only') || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';

    if (isHidden) {
        // Try previous sibling (Label -> Trigger -> Select pattern, or Trigger + Select siblings)
        if (el.previousElementSibling) return el.previousElementSibling;
        // Try parent (Select inside wrapper)
        return el.parentElement || el;
    }
    return el;
}

// --- Helpers ---

function findButtonByLabel(labelText, role, scope) {
    const labels = Array.from(scope.querySelectorAll("label"));
    const target = labelText.trim().toLowerCase();

    for (const lbl of labels) {
        if (lbl.textContent.toLowerCase().includes(target)) {
            if (lbl.htmlFor) {
                const b = scope.querySelector(`button[id="${CSS.escape(lbl.htmlFor)}"]`);
                if (b && b.getAttribute('role') === role) return b;
            }
            const prev = lbl.previousElementSibling;
            if (prev && prev.tagName === 'BUTTON' && prev.getAttribute('role') === role) return prev;

            if (lbl.parentElement) {
                const b = lbl.parentElement.querySelector(`button[role="${role}"]`);
                if (b) return b;
            }
        }
    }
    return null;
}

function findRadioButtonByLabel(groupLabel, optionLabel, scope) {
    const labels = Array.from(scope.querySelectorAll('label, span'));
    let groupContainer = null;
    const cleanGroupLabel = groupLabel.trim().toLowerCase();

    for (const el of labels) {
        if (el.textContent.trim().toLowerCase().includes(cleanGroupLabel)) {
            // Log match attempt
            // console.log(`[ELH-Debug] Checking label for group '${groupLabel}':`, el.textContent.trim());

            // Check htmlFor
            if (el.htmlFor) {
                const linkedEl = scope.querySelector(`#${CSS.escape(el.htmlFor)}`);
                if (linkedEl && linkedEl.getAttribute('role') === 'radiogroup') {
                    groupContainer = linkedEl;
                    console.log(`[ELH-Debug] Found radiogroup via htmlFor for '${groupLabel}'`);
                    break;
                }
            }
            // Check siblings/parent
            if (el.nextElementSibling && el.nextElementSibling.getAttribute('role') === 'radiogroup') {
                groupContainer = el.nextElementSibling;
                console.log(`[ELH-Debug] Found radiogroup via nextSibling for '${groupLabel}'`);
                break;
            }
            if (el.parentElement && el.parentElement.nextElementSibling && el.parentElement.nextElementSibling.getAttribute('role') === 'radiogroup') {
                groupContainer = el.parentElement.nextElementSibling;
                console.log(`[ELH-Debug] Found radiogroup via parentNextSibling for '${groupLabel}'`);
                break;
            }
            if (el.parentElement) {
                const inner = el.parentElement.querySelector('div[role="radiogroup"]');
                if (inner) {
                    groupContainer = inner;
                    console.log(`[ELH-Debug] Found radiogroup via parentInner for '${groupLabel}'`);
                    break;
                }
            }
        }
    }

    if (!groupContainer) {
        console.warn(`[ELH-Debug] Radio Group '${groupLabel}' NOT FOUND.`);
        return null;
    }

    const optionLabels = Array.from(groupContainer.querySelectorAll('label, span, div'));
    const targetOpt = optionLabel.toLowerCase();

    for (const ol of optionLabels) {
        if (ol.textContent.trim().toLowerCase() === targetOpt) {
            // console.log(`[ELH-Debug] Checking option label: '${ol.textContent}'`);

            // 1. Check if label IS linked via htmlFor (Best case)
            if (ol.htmlFor) {
                const b = document.getElementById(ol.htmlFor);
                if (b && b.getAttribute('role') === 'radio') {
                    // Value mismatch check
                    if (b.value && b.value.toLowerCase() !== targetOpt && b.value !== 'on') {
                        if (b.value.toLowerCase() === 'yes' && targetOpt === 'no') continue;
                    }
                    // console.log(`[ELH-Debug] Resolved Option '${optionLabel}' via htmlFor -> Button ID: ${b.id}`);
                    return b;
                }
            }

            // 2. Check if the element ITSELF contains the button (if it matched a wrapper div)
            if (ol.querySelector) {
                const innerBtn = ol.querySelector('button[role="radio"]');
                if (innerBtn) return innerBtn;
            }

            // 3. Check siblings (Label next to button)
            let sib = ol.previousElementSibling;
            while (sib) {
                if (sib.getAttribute && sib.getAttribute('role') === 'radio') return sib;
                sib = sib.previousElementSibling;
            }

            // 4. Check Parent (Button and Label inside common wrapper)
            // CRITICAL: assert parent is NOT the group container itself to avoid finding the first sibling
            if (ol.parentElement && ol.parentElement !== groupContainer) {
                const b = ol.parentElement.querySelector(`button[role="radio"]`);
                if (b) return b;
            }
        }
    }
    console.warn(`[ELH-Debug] Option '${optionLabel}' not found in group '${groupLabel}'.`);
    return null;
}

function findSelectByLabel(labelText, scope) {
    const labels = Array.from(scope.querySelectorAll('label'));
    const target = labelText.trim().toLowerCase();

    for (const lbl of labels) {
        if (lbl.textContent.toLowerCase().includes(target)) {
            if (lbl.htmlFor) {
                const s = scope.querySelector(`select[id="${CSS.escape(lbl.htmlFor)}"]`);
                if (s) return s;
            }
            const s = lbl.querySelector('select');
            if (s) return s;

            let sib = lbl.nextElementSibling;
            if (sib) {
                if (sib.tagName === 'SELECT') return sib;
                const innerSelect = sib.querySelector('select');
                if (innerSelect) return innerSelect;
            }
        }
    }
    return null;
}
