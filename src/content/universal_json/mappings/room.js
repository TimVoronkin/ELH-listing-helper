
// Configuration for simple 1-to-1 mappings
const ROOM_CONFIG = {
    PaymentSteps: [
        {
            key: 'minimum_reserve_months',
            label: 'Minimum reserve',
            type: 'input'
        },
        {
            key: 'payment_on_booking',
            label: 'Payment on booking',
            type: 'select',
            valueMap: { '1st Rent': 'rent', 'Rent': 'rent' }
        },
        {
            key: 'amount_to_pay_on_checkin',
            label: 'Amount to pay upon Check-In',
            type: 'select',
            valueMap: { 'Rent + Deposit': 'rentPlusDeposit', 'Last Month + Deposit': 'rentPlusDeposit', 'Deposit': 'deposit' }
        },
        {
            key: 'deposit_eur',
            label: 'Deposit',
            type: 'input'
        },
        {
            key: 'administrative_tax_eur',
            label: 'Administrative tax',
            type: 'input'
        },
        {
            key: 'extra_person.allowed',
            label: 'Extra Person',
            type: 'radio'
        },
        {
            key: 'extra_person.value_eur',
            label: 'Extra person value',
            type: 'input'
        }
    ],
    FeaturesSteps: [
        { key: 'type_of_bed', label: 'Type of bed', type: 'select' }, // First bed
        { key: 'room_area_m2', label: 'Total area', type: 'input' },
        // 'second_bed' is handled manually due to conditional logic
        { key: 'private_bathroom', label: 'Private bathroom', type: 'radio' },
        { key: 'balcony', label: 'Balcony', type: 'radio' },
        { key: 'desk', label: 'Desk', type: 'radio' },
        { key: 'closet', label: 'Closet', type: 'radio' },
        { key: 'heating', label: 'Heating', type: 'radio' },
        { key: 'window', label: 'Window', type: 'radio' },
        { key: 'bed_linen', label: 'Bed linen', type: 'radio' },
        { key: 'pillows', label: 'Pillows', type: 'radio' },
        { key: 'air_conditioning', label: 'Air Conditioning', type: 'radio' }
    ]
};

// Helper: Safely access nested object property
function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Helper: Async pause
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const RoomMapper = {
    async handle(step, jsonData, container) {
        console.log(`[ELH-Universal] RoomMapper handling step: ${step}`);

        const roomData = jsonData.room_data;
        if (!roomData) return;
        const stepData = roomData[step];
        if (!stepData) return;

        // --- Custom Logic Before Configured Steps ---

        if (step === 'PaymentSteps' && stepData.rent) {
            await this.handleRentLogic(stepData.rent, container);
        }

        if (step === 'FeaturesSteps') {
            await this.handleSecondBedLogic(stepData, container);
        }

        // --- Standard Configured Steps ---

        if (ROOM_CONFIG[step]) {
            await this.processConfiguredStep(step, stepData, container);
        }

        if (step === 'PhotosStep') await this.handlePhotos(stepData, container);
        if (step === 'BlockedDatesStep') return await this.handleBlockedDatesLogic(stepData, container);
    },

    async handleBlockedDatesLogic(data, container) {
        // --- 1. Prep & Imports ---
        const { selectDateInCalendar, highlightElement } = await import('../field_setters.js');

        // Find "Add Blocked Date" button first, as we need container context
        const addBtn = Array.from(container.querySelectorAll('button'))
            .find(b => b.textContent.includes('Add Blocked Date'));

        if (!addBtn) {
            console.warn('[ELH-Universal] "Add Blocked Date" button not found.');
            return { added: 0, deleted: 0, matched: 0, ignored: 0, old_dates: [] };
        }

        // --- 2. READ Existing Dates from DOM ---
        // We'll parse the current rows to understand what is already blocked.
        // Structure assumption: Each row has two inputs (Start, End) and a Delete button.
        // We need to find the specific container for these rows.
        // Based on HTML, they are inside a div with id="...-form-item" or similar structure.
        // Let's iterate all "Start Date" labels to find their values.

        const existingBlocks = [];
        const startLabels = Array.from(container.querySelectorAll('label')).filter(l => l.textContent.trim() === 'Start Date');

        for (const sLabel of startLabels) {
            // Find Start Button/Input
            const sBtn = sLabel.nextElementSibling?.querySelector('button') || sLabel.nextElementSibling;
            if (!sBtn || sBtn.tagName !== 'BUTTON') continue;

            // Find sibling "End Date" logic
            // The HTML structure shows Start and End are in a grid. 
            // The "End Date" label is likely in the next div.
            // Let's traverse up to the common row container.
            const rowContainer = sLabel.closest('.flex.items-center.gap-4'); // Based on HTML class
            if (!rowContainer) continue;

            const eLabel = Array.from(rowContainer.querySelectorAll('label')).find(l => l.textContent.trim() === 'End Date');
            const eBtn = eLabel?.nextElementSibling?.querySelector('button') || eLabel?.nextElementSibling;
            const trashBtn = rowContainer.querySelector('button:has(svg.lucide-trash2)') || rowContainer.querySelector('svg.lucide-trash2')?.closest('button');

            if (eBtn && sBtn && trashBtn) {
                existingBlocks.push({
                    startText: sBtn.textContent.trim(), // e.g., "October 29th, 2025"
                    endText: eBtn.textContent.trim(),
                    startVal: this.parseDateText(sBtn.textContent.trim()), // YYYY-MM-DD
                    endVal: this.parseDateText(eBtn.textContent.trim()),   // YYYY-MM-DD
                    rowElement: rowContainer,
                    trashBtn: trashBtn,
                    isMatched: false
                });
            }
        }

        // --- 3. FILTER "The Past" ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        existingBlocks.forEach(block => {
            if (this.isDateInPast(block.endVal)) {
                block.isPast = true;
                highlightElement(block.rowElement, 'gray'); // Mark as ignored/ghost
            }
        });

        // --- 3.1 Collect Old Dates for Stats ---
        const collectedOldDates = existingBlocks
            .filter(b => b.startVal && b.endVal)
            .map(b => `${b.startVal} - ${b.endVal}`);  // Format: "YYYY-MM-DD / YYYY-MM-DD"

        // --- 4. COMPARE matches ---
        let stats = { added: 0, deleted: 0, matched: 0, ignored: 0 };

        // If no new dates provided, check if we should delete existing ones
        if (!data.blocked_dates || !Array.isArray(data.blocked_dates) || data.blocked_dates.length === 0) {
            console.log('[ELH-Universal] No blocked dates to add.');

            // Check if we should delete existing dates when input is empty
            const storageData = await new Promise(resolve => chrome.storage.local.get(['deleteBlockedDatesBeforePasting'], resolve));
            if (storageData.deleteBlockedDatesBeforePasting) {
                console.log('[ELH-Universal] Deleting all existing dates (empty JSON + delete setting ON).');
                const toDelete = existingBlocks.filter(b => !b.isPast);
                for (const item of toDelete) {
                    if (item.trashBtn && !item.trashBtn.disabled) {
                        item.trashBtn.click();
                        stats.deleted++;
                        await wait(200);
                    }
                }
                if (toDelete.length > 0) await wait(500); // Wait for DOM update
            }

            console.log('[ELH-Universal] Returning old dates.');
            return {
                added: 0,
                deleted: stats.deleted,
                matched: 0,
                ignored: 0,
                old_dates: collectedOldDates
            };
        }
        const datesToAdd = [];

        // Helper: Expand JSON dates
        const expandDate = (val, isStart) => {
            if (!val || val === 'now') return val;
            const monthMatch = val.toString().match(/^(\d{4})-(\d{2})$/);
            if (monthMatch) {
                const [_, y, m] = monthMatch;
                if (isStart) return `${val}-01`;
                const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
                return `${val}-${lastDay}`;
            }
            return val;
        };

        for (const range of data.blocked_dates) {
            let s = expandDate(range.start, true);
            let e = expandDate(range.end, false);
            let isNowLogic = false;

            // Handle 'now' for comparison
            if (s === 'now') {
                const now = new Date();
                s = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                isNowLogic = true;
            }

            // Find match in logic
            // Rule:
            // 1. Exact match (Standard)
            // 2. Relaxed match (ONLY if isNowLogic): Existing block ends on same day, but starts EARLIER than 's'.
            //    (Because if it started earlier, it covers 'now' -> future segment too)

            const match = existingBlocks.find(b => {
                if (b.isPast || b.isMatched) return false;

                // Check End Date first (Must match exactly)
                if (b.endVal !== e) return false;

                // Check Start Date
                if (b.startVal === s) return true; // Exact match

                // Relaxed: if we want 'now', but site has 'yesterday' -> It covers 'now'.
                if (isNowLogic && b.startVal < s) {
                    console.log(`[ELH-Universal] Relaxed match found: Site start ${b.startVal} < Now ${s} (End ${e})`);
                    return true;
                }

                return false;
            });

            if (match) {
                match.isMatched = true;
                highlightElement(match.rowElement, 'gray'); // Visual: It's good
                stats.matched++;
            } else {
                datesToAdd.push({ start: range.start, end: e });
            }
        }

        // --- 5. CLEANUP (Delete extras) ---
        const storageData = await new Promise(resolve => chrome.storage.local.get(['deleteBlockedDatesBeforePasting'], resolve));
        if (storageData.deleteBlockedDatesBeforePasting) {
            const toDelete = existingBlocks.filter(b => !b.isPast && !b.isMatched);
            for (const item of toDelete) {
                if (!item.trashBtn.disabled) {
                    item.trashBtn.click();
                    stats.deleted++;
                    await wait(200);
                }
            }
            if (toDelete.length > 0) await wait(500); // Wait for DOM update
        }

        // --- 6. ADD New Dates ---
        for (const item of datesToAdd) {
            // Re-use logic for adding
            addBtn.click();
            await wait(400);

            // Re-scan finding the new row is acceptable or we use the "last label" trick
            // The "last label" trick works because we just added it at the bottom.
            const startLabelsAll = Array.from(container.querySelectorAll('label')).filter(l => l.textContent.trim() === 'Start Date');
            const endLabelsAll = Array.from(container.querySelectorAll('label')).filter(l => l.textContent.trim() === 'End Date');

            if (startLabelsAll.length === 0) continue;

            const lastStart = startLabelsAll[startLabelsAll.length - 1];
            const lastEnd = endLabelsAll[endLabelsAll.length - 1];

            const sTrigger = lastStart.nextElementSibling?.querySelector('button') || lastStart.nextElementSibling;
            const eTrigger = lastEnd.nextElementSibling?.querySelector('button') || lastEnd.nextElementSibling;

            // Start
            if (sTrigger) {
                sTrigger.click();
                await wait(300);
                if (await selectDateInCalendar(item.start)) highlightElement(sTrigger, 'green');
            }
            // End
            if (eTrigger) {
                eTrigger.click();
                await wait(300);
                if (await selectDateInCalendar(item.end)) highlightElement(eTrigger, 'green');
            }

            stats.added++;
            await wait(200);
        }

        return {
            added: stats.added,
            deleted: stats.deleted,
            matched: stats.matched,
            ignored: stats.ignored,
            old_dates: collectedOldDates
        };
    },

    // --- Helpers for Date Parsing ---
    parseDateText(text) {
        // Text format: "October 29th, 2025"
        // We need to parse this to "2025-10-29"
        if (!text) return null;

        // Remove ordinal suffixes (st, nd, rd, th) if present
        const clean = text.replace(/(\d+)(st|nd|rd|th)/, '$1');
        const d = new Date(clean);
        if (isNaN(d.getTime())) return null;

        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    isDateInPast(dateStr) {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return d < now;
    },

    async handleRentLogic(rentData, container) {
        const { setRadio, setInputValue } = await import('../field_setters.js');
        console.log('[ELH-Universal] Handling Rent Logic');

        const isFixed = rentData.is_fixed === true;
        const radioVal = isFixed ? 'Yes' : 'No';

        // 1. Set "Fixed monthly price"
        setRadio('Fixed monthly price', radioVal, container);

        // 2. Wait for UI to update (input appearance/change)
        await wait(300);

        if (isFixed) {
            // Logic: Set "Monthly rent"
            if (rentData.if_true && rentData.if_true.monthly_rent) {
                const input = this.findInputAfterLabel(container, 'Monthly rent');
                if (input) setInputValue(input, rentData.if_true.monthly_rent.toString());
                else console.warn('Input for "Monthly rent" not found');
            }
        } else {
            // Logic: Set inputs for months
            // They appear when "No" is selected
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            if (rentData.if_false) {
                for (const month of months) {
                    if (rentData.if_false[month]) {
                        // These inputs usually have label "January (€)", "February (€)" etc.
                        const input = this.findInputAfterLabel(container, month);
                        if (input) setInputValue(input, rentData.if_false[month].toString());
                    }
                }
            }
        }
    },

    async handleSecondBedLogic(featuresData, container) {
        if (typeof featuresData.second_bed !== 'boolean') return;

        const { setRadio, setSelect } = await import('../field_setters.js');
        const targetVal = featuresData.second_bed ? 'Yes' : 'No';

        console.log(`[ELH-Universal] Handling Second Bed: ${targetVal}`);
        setRadio('Second Bed', targetVal, container);

        if (featuresData.second_bed && featuresData.type_of_second_bed) {
            // Wait for the second dropdown to appear
            await wait(300);

            // Strategy: Find ALL selects with label "Type of bed" and pick the second one
            // Or find "Type of bed" label that appears AFTER "Second Bed" label?
            // Simple approach: get all selects, filter by label text match or context.

            // Let's implement a specific finder for the N-th occurrence or by context
            const secondTypeSelect = this.findSpecificSelect(container, 'Type of bed', 2);

            if (secondTypeSelect) {
                // Call setSelect but pass the specific element ID or handle it manually?
                // setSelect usually finds by label. We can use a trick or export `setSelectElement`.
                // For now, let's assume `setSelect` can take an element reference if we modify it, 
                // OR we just set it manually here closely mimicking setSelect.

                // Better: Modify setSelect to accept an element (I'll assume I can import highlightElement)
                const { highlightElement, getVisualElement } = await import('../field_setters.js'); // Assuming getVisualElement exported or internal
                // Actually setSelect in field_setters finds internally. 
                // We should probably just call setSelect logic manually on the element we found.

                // MANUAL SET for specific element:
                const val = featuresData.type_of_second_bed;
                const options = Array.from(secondTypeSelect.options);
                const matchedOption = options.find(opt =>
                    (opt.value || '').toLowerCase() === val.toLowerCase() ||
                    (opt.text || '').toLowerCase() === val.toLowerCase()
                );

                if (matchedOption) {
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
                    if (nativeSetter) nativeSetter.call(secondTypeSelect, matchedOption.value);
                    else secondTypeSelect.value = matchedOption.value;

                    secondTypeSelect.dispatchEvent(new Event('input', { bubbles: true }));
                    secondTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    secondTypeSelect.dispatchEvent(new MouseEvent('click', { bubbles: true }));

                    // Highlight logic (mimic field_setters)
                    // We need highlightElement from somewhere, let's grab it from field_setters
                    const { highlightElement } = await import('../field_setters.js');
                    // We need to resolve visual element for highlighting
                    const visEl = (secondTypeSelect.classList.contains('sr-only') || secondTypeSelect.style.display == 'none')
                        ? (secondTypeSelect.previousElementSibling || secondTypeSelect.parentElement)
                        : secondTypeSelect;

                    highlightElement(visEl, 'green');
                    console.log(`[ELH-Universal] Set Second Bed Type -> ${matchedOption.value}`);
                }
            } else {
                console.warn('[ELH-Universal] Second "Type of bed" select not found');
            }
        }
    },

    findSpecificSelect(container, labelText, occurrenceIndex = 1) {
        // Find all labels matching text
        const labels = Array.from(container.querySelectorAll('label'))
            .filter(l => l.textContent.trim().toLowerCase().includes(labelText.toLowerCase()));

        if (labels.length < occurrenceIndex) return null;

        const targetLabel = labels[occurrenceIndex - 1]; // 0-based

        // Standard finding logic for this specific label
        if (targetLabel.htmlFor) {
            return container.querySelector(`#${CSS.escape(targetLabel.htmlFor)}`);
        }
        return targetLabel.querySelector('select') ||
            (targetLabel.nextElementSibling && targetLabel.nextElementSibling.querySelector('select')) ||
            (targetLabel.nextElementSibling && targetLabel.nextElementSibling.tagName === 'SELECT' ? targetLabel.nextElementSibling : null);
    },

    async processConfiguredStep(stepName, data, container) {
        const { setInputValue, setRadio, setSelect } = await import('../field_setters.js');
        const config = ROOM_CONFIG[stepName];

        for (const field of config) {
            const rawValue = getNestedValue(data, field.key);
            if (rawValue === undefined || rawValue === null) continue;

            let valueToSet = rawValue;
            if (field.valueMap) {
                const match = Object.keys(field.valueMap).find(k => k.toLowerCase() === String(rawValue).toLowerCase());
                if (match) valueToSet = field.valueMap[match];
            }

            try {
                if (field.type === 'input') {
                    const el = this.findInputAfterLabel(container, field.label);
                    // Check if input is "Monthly rent" but we might have ignored it in favor of custom logic?
                    // Actually ROOM_CONFIG for PaymentSteps does NOT include 'Monthly rent' directly anymore IF we removed it?
                    // Wait, I removed 'rent.monthly_rent' from CONFIG in my mental model but let's check the const above.
                    // 'Monthly rent' IS NOT in ROOM_CONFIG.PaymentSteps above. Correct.
                    if (el) setInputValue(el, valueToSet.toString());
                }
                else if (field.type === 'select') {
                    setSelect(field.label, valueToSet.toString(), container);
                }
                else if (field.type === 'radio') {
                    const val = (typeof valueToSet === 'boolean') ? (valueToSet ? 'Yes' : 'No') : valueToSet.toString();
                    setRadio(field.label, val, container);
                }
            } catch (err) {
                console.error(`Error setting ${field.label}`, err);
            }
        }
    },

    findInputAfterLabel(container, textPart) {
        const labels = Array.from(container.querySelectorAll('label'));
        // Find closest match?
        const lbl = labels.find(l => l.innerText.toLowerCase().includes(textPart.toLowerCase()));
        if (!lbl) return null;

        if (lbl.htmlFor) {
            try { return container.querySelector(`#${CSS.escape(lbl.htmlFor)}`); } catch (e) { }
        }

        let next = lbl.nextElementSibling;
        let limit = 4; // increased lookahead
        while (next && limit-- > 0) {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(next.tagName)) return next;
            const nested = next.querySelector('input, select, textarea');
            if (nested) return nested;
            next = next.nextElementSibling;
        }
        return null;
    },

    async handlePhotos(data, container) {
        const { setInputValue } = await import('../field_setters.js');
        if (data.room_name) {
            const t = container.querySelector('input[name="title"]');
            if (t) setInputValue(t, data.room_name);
        }
        if (data.room_description) {
            const d = container.querySelector('textarea[name="description"]');
            if (d) setInputValue(d, data.room_description);
        }
    }
};
