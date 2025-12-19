
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


// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Selects a date in the Radix UI DayPicker calendar.
 * Assumes the calendar popover is already open.
 * @param {string} dateString - Format "YYYY-MM-DD" or "now"
 */
export async function selectDateInCalendar(dateString) {
    if (!dateString) return false;

    // Clean inputs
    const cleanDate = dateString.toString().trim().toLowerCase();

    // Parse Date Interaction
    // We determine if we should use "Specific Date" logic or "First Available" logic.
    // "First Available" ('now') applies if:
    // 1. input is 'now'
    // 2. input date is in the past (before today)

    let useFirstAvailable = (cleanDate === 'now');
    let targetYear, targetMonth, targetDay;

    if (!useFirstAvailable) {
        const parts = cleanDate.split('-').map(Number);
        if (parts.length === 3) {
            [targetYear, targetMonth, targetDay] = parts;
            // Native Date: Month is 0-indexed
            const targetDateObj = new Date(targetYear, targetMonth - 1, targetDay);

            // Check against today (at 00:00:00) to allow selecting "Today" if it's not disabled, 
            // but if "Today" falls into the logic of "less than first available" (implied past),
            // the FirstAvailable logic handles "Today" correctly too (it picks it if enabled).
            // User requirement: "if date in json is less than first available" -> do 'now'
            // Safest Check: If date is strictly BEFORE today's date (ignoring time), definitely use FirstAvailable.
            // Actually, if date IS Today, standard logic navigates to today. FirstAvailable scans today. Both work.
            // But if date is PAST, standard logic breaks (navigates back). FirstAvailable fixes it.

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (targetDateObj < today) {
                console.log(`[ELH-Universal] Target date ${cleanDate} is in the past. Switching to 'First Available' logic.`);
                useFirstAvailable = true;
            }
        }
    }

    // 1. Find the open calendar popover
    let calendarContainer = document.querySelector('[data-radix-popper-content-wrapper] [data-slot="calendar"]');

    if (!calendarContainer) {
        await wait(200);
        calendarContainer = document.querySelector('[data-radix-popper-content-wrapper] [data-slot="calendar"]');
    }

    if (!calendarContainer) {
        console.warn(`[ELH-Universal] Calendar container not found.`);
        return false;
    }

    // --- LOGIC FOR "NOW" / "FIRST AVAILABLE" ---
    if (useFirstAvailable) {
        console.log(`[ELH-Universal] selectDateInCalendar: Using 'First Available' Logic`);

        // Find all day buttons
        // Logic: find buttons that do NOT have disabled attributes/classes
        const allDayButtons = Array.from(calendarContainer.querySelectorAll('.rdp-day_button'));

        const availableBtn = allDayButtons.find(btn => {
            // Check button attributes
            if (btn.hasAttribute('disabled')) return false;
            if (btn.getAttribute('aria-disabled') === 'true') return false;
            if (btn.classList.contains('rdp-day_disabled')) return false;

            // Check parent TD for disabled state
            const parentTd = btn.closest('td');
            if (parentTd) {
                if (parentTd.hasAttribute('data-disabled') && parentTd.getAttribute('data-disabled') === 'true') return false;
                if (parentTd.classList.contains('rdp-disabled')) return false;
            }

            return true;
        });

        if (availableBtn) {
            console.log(`[ELH-Universal] Found first available date: ${availableBtn.textContent.trim()} (aria-label: ${availableBtn.ariaLabel})`);
            availableBtn.click();
            highlightElement(availableBtn, 'green');
            await wait(300);
            return true;
        } else {
            console.warn(`[ELH-Universal] No available dates found in current calendar view for logic 'First Available'.`);
            return false;
        }
    }

    // --- STANDARD SPECIFIC DATE LOGIC ---
    // (targetYear, targetMonth, targetDay exist from earlier parse)
    // targetMonth is 1-based (January=1), Date object is 0-based.
    const targetDateObj = new Date(targetYear, targetMonth - 1, targetDay);

    console.log(`[ELH-Universal] selectDateInCalendar: Target Specific ${cleanDate}`);

    // 2. Navigation Loop (Limit iterations to avoid infinite loops)
    let attempts = 0;
    const MAX_ATTEMPTS = 24; // Allow navigating 2 years

    while (attempts < MAX_ATTEMPTS) {
        // Get current view month/year
        // Look for element with class 'rdp-caption_label' or similar
        const captionEl = calendarContainer.querySelector('.rdp-caption_label');
        if (!captionEl) {
            console.warn(`[ELH-Universal] Calendar caption not found.`);
            return false;
        }


        const currentCaption = captionEl.textContent.trim(); // e.g., "December 2025"
        const currentDate = new Date(Date.parse(`1 ${currentCaption}`)); // "1 December 2025"

        if (isNaN(currentDate.getTime())) {
            console.warn(`[ELH-Universal] Could not parse calendar caption: '${currentCaption}'`);
            return false;
        }

        // Compare Year and Month
        // We only care about Year and Month (0-11)
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        // Target
        const tYear = targetDateObj.getFullYear();
        const tMonth = targetDateObj.getMonth();

        console.log(`[ELH-Debug] Calendar Status: Current=${currentCaption} (${currentYear}-${currentMonth + 1}), Target=${targetYear}-${tMonth + 1}`);

        if (currentYear === tYear && currentMonth === tMonth) {
            // Match! Break loop to select day.
            console.log(`[ELH-Debug] Month matched.`);
            break;
        }

        // Decide direction
        // Compare values: (Year * 12 + Month)
        const currentVal = currentYear * 12 + currentMonth;
        const targetVal = tYear * 12 + tMonth;

        if (targetVal > currentVal) {
            // Click Next
            const nextBtn = calendarContainer.querySelector('.rdp-button_next');
            if (nextBtn) {
                console.log(`[ELH-Debug] Clicking Next Month`);
                nextBtn.click();
            } else {
                console.warn(`[ELH-Universal] Next Month button not found.`);
                return false;
            }
        } else {
            // Click Previous
            const prevBtn = calendarContainer.querySelector('.rdp-button_previous');
            if (prevBtn) {
                console.log(`[ELH-Debug] Clicking Prev Month`);
                prevBtn.click();
            } else {
                console.warn(`[ELH-Universal] Prev Month button not found.`);
                return false;
            }
        }

        // Wait for animation/render
        await wait(250);
        attempts++;
    }

    if (attempts >= MAX_ATTEMPTS) {
        console.warn(`[ELH-Universal] Failed to navigate to target month after ${MAX_ATTEMPTS} attempts.`);
        return false;
    }

    // 3. Select Day
    // Format required by DayPicker usually matches the input data-day.
    // However, the DOM shows format: data-day="2025-11-30" (YYYY-MM-DD) OR "11/30/2025" (M/D/YYYY)
    // The user provided DOM shows: data-day="2025-12-01" AND data-day="12/1/2025" on the same element?
    // <button data-day="12/1/2025" ... >
    // Wait, the TD has data-day="2025-12-01", the BUTTON inside has data-day="12/1/2025".
    // Let's try matching the more standard ISO format on the TD or loose match.

    // Try finding the button directly first.
    // Construct possible selectors.
    // Standard ISO: YYYY-MM-DD
    const isoDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    // US Format: M/D/YYYY (no leading zeros usually for M/D in some libs, but let's check user DOM)
    // User DOM: data-day="12/1/2025" (Month 12, Day 1). So no leading zero for Day?
    // User DOM: data-day="12/10/2025"
    const usDate = `${targetMonth}/${targetDay}/${targetYear}`;

    // Selector strategy:
    // 1. Button with exact data-day (US format or ISO)
    // 2. Gridcell (TD) with data-day (ISO), then find button inside.

    let dayBtn = calendarContainer.querySelector(`button[data-day="${usDate}"]`) ||
        calendarContainer.querySelector(`button[data-day="${isoDate}"]`);

    if (!dayBtn) {
        // Try finding via parent TD
        const dayCell = calendarContainer.querySelector(`td[data-day="${isoDate}"]`);
        if (dayCell) {
            dayBtn = dayCell.querySelector('button');
        }
    }

    if (dayBtn) {
        // Check if disabled
        if (dayBtn.hasAttribute('disabled')) {
            console.warn(`[ELH-Universal] Target date ${dateString} is disabled.`);
            return false;
        }

        console.log(`[ELH-Universal] Clicking day ${dateString}`);
        dayBtn.click();
        highlightElement(dayBtn, 'green'); // Visual feedback
        await wait(300); // Wait for modal to potentially close or update
        return true;
    } else {
        console.warn(`[ELH-Universal] Day button for ${dateString} not found.`);
        return false;
    }
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
                if (linkedEl) {
                    const r = linkedEl.getAttribute('role');
                    if (r === 'radiogroup' || r === 'group') {
                        groupContainer = linkedEl;
                        console.log(`[ELH-Debug] Found radiogroup via htmlFor for '${groupLabel}'`);
                        break;
                    }
                }
            }
            // Check siblings/parent
            if (el.nextElementSibling) {
                const r = el.nextElementSibling.getAttribute('role');
                if (r === 'radiogroup' || r === 'group') {
                    groupContainer = el.nextElementSibling;
                    console.log(`[ELH-Debug] Found radiogroup via nextSibling for '${groupLabel}'`);
                    break;
                }
            }
            if (el.parentElement && el.parentElement.nextElementSibling) {
                const r = el.parentElement.nextElementSibling.getAttribute('role');
                if (r === 'radiogroup' || r === 'group') {
                    groupContainer = el.parentElement.nextElementSibling;
                    console.log(`[ELH-Debug] Found radiogroup via parentNextSibling for '${groupLabel}'`);
                    break;
                }
            }
            if (el.parentElement) {
                const inner = el.parentElement.querySelector('div[role="radiogroup"], div[role="group"]');
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

/**
 * Sets a value in a custom Radix UI / ShadCN Combobox.
 * Workflow: Click trigger -> Check for Search Input -> Type Value -> Wait -> Click Option.
 */
export async function setCombobox(labelText, value, contextScope = document) {
    if (!value) return false;

    // 1. Find the trigger button (role="combobox") associated with the label
    const labels = Array.from(contextScope.querySelectorAll("label"));
    const targetLabel = labels.find(l => l.innerText.trim().toLowerCase().includes(labelText.toLowerCase()));

    if (!targetLabel) {
        console.warn(`[ELH-Universal] Label '${labelText}' for Combobox not found.`);
        return false;
    }

    let triggerBtn = null;

    // Check htmlFor
    if (targetLabel.htmlFor) {
        triggerBtn = contextScope.querySelector(`button[id="${CSS.escape(targetLabel.htmlFor)}"][role="combobox"]`);
    }

    // Check siblings
    if (!triggerBtn) {
        let next = targetLabel.nextElementSibling;
        while (next) {
            if (next.tagName === 'BUTTON' && next.getAttribute('role') === 'combobox') {
                triggerBtn = next;
                break;
            }
            if (next.querySelector) {
                const nested = next.querySelector('button[role="combobox"]');
                if (nested) {
                    triggerBtn = nested;
                    break;
                }
            }
            next = next.nextElementSibling;
            if (!next) break; // Limit search
        }
    }

    // Check parent
    if (!triggerBtn && targetLabel.parentElement) {
        triggerBtn = targetLabel.parentElement.querySelector('button[role="combobox"]');
    }


    if (!triggerBtn) {
        console.warn(`[ELH-Universal] Combobox trigger for '${labelText}' not found.`);
        return false;
    }

    // 2. Click to open
    console.log(`[ELH-Universal] Opening Combobox '${labelText}'...`);
    triggerBtn.click();
    await new Promise(r => setTimeout(r, 400)); // Wait for animation/popover

    // Search for the popover content (usually at root document level)
    const searchScopes = [document.body, contextScope];
    let searchInput = null;

    // 3. Look for a search input (cmdk-input is specific to ShadCN/CMDK)
    for (const scope of searchScopes) {
        // Try precise cmdk selector first
        searchInput = scope.querySelector('input[cmdk-input]');
        if (searchInput) break;
    }

    if (searchInput) {
        console.log(`[ELH-Universal] Found search input in Combobox. Typing '${value}'...`);
        // Type into the search input
        const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (nativeValueSetter) {
            nativeValueSetter.call(searchInput, value);
        } else {
            searchInput.value = value;
        }
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 600)); // Wait for filtering
    }

    // 4. Find the option
    let targetOption = null;

    for (const scope of searchScopes) {
        const options = Array.from(scope.querySelectorAll('[role="option"]'));

        // Exact match
        targetOption = options.find(opt => opt.innerText.trim().toLowerCase() === value.toLowerCase());

        // If not found and we filtered, maybe take the first one?
        // But safer to look for inclusion if exact match fails
        if (!targetOption && searchInput) {
            targetOption = options.find(opt => opt.innerText.trim().toLowerCase().includes(value.toLowerCase()));
        }

        // As a last resort, if we searched, verified there are options, just pick the first visible one
        if (!targetOption && searchInput && options.length > 0) {
            targetOption = options[0];
        }

        if (targetOption) break;
    }

    if (!targetOption) {
        console.warn(`[ELH-Universal] Option '${value}' not found for Combobox '${labelText}'.`);
        // Try closing it to reset state?
        triggerBtn.click();
        return false;
    }

    // 5. Click to select
    console.log(`[ELH-Universal] Select Option '${value}'`);
    targetOption.click();

    // Visual feedback
    if (triggerBtn) {
        triggerBtn.style.outline = '2px solid green';
        triggerBtn.style.boxShadow = '0 0 5px green';
    }

    return true;
}

export function findInputAfterLabel(container, textPart) {
    // Also include spans as they are often used as labels in this app
    const labels = Array.from(container.querySelectorAll('label, span'));
    const lbl = labels.find(l => l.innerText && l.innerText.toLowerCase().includes(textPart.toLowerCase()));

    if (!lbl) return null;

    if (lbl.htmlFor) {
        try {
            const linked = container.querySelector(`#${CSS.escape(lbl.htmlFor)}`);
            if (linked) return linked;
        } catch (e) { }
    }

    let next = lbl.nextElementSibling;
    let limit = 4;
    while (next && limit-- > 0) {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(next.tagName)) return next;

        // Specific case for PhoneInput wrapper
        if (next.classList.contains('PhoneInput')) {
            const nestedPhone = next.querySelector('input');
            if (nestedPhone) return nestedPhone;
        }

        const nested = next.querySelector('input:not([type="hidden"]), select, textarea');
        if (nested) return nested;
        next = next.nextElementSibling;
    }

    const childInput = lbl.querySelector('input, select, textarea');
    if (childInput) return childInput;

    return null;
}
