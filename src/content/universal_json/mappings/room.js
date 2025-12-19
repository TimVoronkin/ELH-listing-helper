
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
        if (step === 'BlockedDatesStep') await this.handleBlockedDatesLogic(stepData, container);
    },

    async handleBlockedDatesLogic(data, container) {
        if (!data.blocked_dates || !Array.isArray(data.blocked_dates) || data.blocked_dates.length === 0) {
            console.log('[ELH-Universal] No blocked dates to add.');
            return;
        }

        const { selectDateInCalendar, highlightElement } = await import('../field_setters.js');

        // Find "Add Blocked Date" button.
        // Use a loose text match to be robust.
        const addBtn = Array.from(container.querySelectorAll('button'))
            .find(b => b.textContent.includes('Add Blocked Date'));

        if (!addBtn) {
            console.warn('[ELH-Universal] "Add Blocked Date" button not found.');
            return;
        }

        // --- NEW LOGIC: Delete existing blocked dates if option enabled ---
        const storageData = await new Promise(resolve => chrome.storage.local.get(['deleteBlockedDatesBeforePasting'], resolve));
        console.log('[ELH-Universal] Storage Check - deleteBlockedDatesBeforePasting:', storageData.deleteBlockedDatesBeforePasting); // DEBUG CHECK

        if (storageData.deleteBlockedDatesBeforePasting) {
            console.log('[ELH-Universal] Deleting existing blocked dates before pasting...');

            // Strategy: Find all trash buttons within the container and click them.
            // Based on user snippet, trash button contains specific SVG or class structure.
            // Selector: button:has(svg.lucide-trash2) OR button svg.lucide-trash2 -> closest button

            // We'll iterate until no trash buttons are found to ensure full cleanup.
            // Limit iterations to avoid infinite loops.
            let attempt = 0;
            while (attempt < 20) {
                const trashSvgs = Array.from(container.querySelectorAll('svg.lucide-trash2'));
                // Filter only those inside buttons
                const deleteBtns = trashSvgs
                    .map(svg => svg.closest('button'))
                    .filter(btn => btn && !btn.disabled);

                if (deleteBtns.length === 0) {
                    console.log('[ELH-Universal] No more blocked dates to delete.');
                    break;
                }

                console.log(`[ELH-Universal] Found ${deleteBtns.length} blocked dates to delete.`);

                for (const btn of deleteBtns) {
                    btn.click();
                    highlightElement(btn, 'green'); // Visual feedback
                    await wait(200); // Wait for deletion animation/update
                }

                // Wait a bit for DOM to refresh after batch deletion
                await wait(500);
                attempt++;
            }
        }
        // -----------------------------------------------------------------

        for (const dateRange of data.blocked_dates) {
            // Helper: Expand YYYY-MM to full date
            const expandDate = (val, isStart) => {
                if (!val || val === 'now') return val;
                // Check for YYYY-MM format (e.g. 2025-12)
                const monthMatch = val.toString().match(/^(\d{4})-(\d{2})$/);
                if (monthMatch) {
                    const [_, y, m] = monthMatch;
                    if (isStart) {
                        return `${val}-01`;
                    } else {
                        // Get last day: day 0 of next month returns last day of current month
                        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
                        return `${val}-${lastDay}`;
                    }
                }
                return val;
            };

            // Updated Logic: If start is missing, default to 'now'. Stop only if End is missing.
            const startVal = expandDate(dateRange.start, true) || 'now';
            const endVal = expandDate(dateRange.end, false);

            if (!endVal) {
                console.warn('[ELH-Universal] Blocked date range missing end date. Skipping.');
                continue;
            }

            console.log(`[ELH-Universal] Adding Blocked Date: ${startVal} to ${endVal}`);

            // Click Add
            addBtn.click();
            await wait(400); // Wait for row to appear

            // Find the NEWEST inputs.
            // We select the LAST "Start Date" and "End Date" labels to target the newly added row.
            const startLabels = Array.from(container.querySelectorAll('label')).filter(l => l.textContent.trim() === 'Start Date');
            const endLabels = Array.from(container.querySelectorAll('label')).filter(l => l.textContent.trim() === 'End Date');

            if (startLabels.length === 0 || endLabels.length === 0) {
                console.warn('[ELH-Universal] Blocked date labels not found.');
                continue;
            }

            const lastStartLabel = startLabels[startLabels.length - 1];
            const lastEndLabel = endLabels[endLabels.length - 1];

            // Helper to find button from label
            const findTriggerBtn = (lbl) => {
                let next = lbl.nextElementSibling;
                if (next && next.tagName === 'BUTTON') return next;
                if (next && next.querySelector('button')) return next.querySelector('button');
                return null;
            };

            const startBtn = findTriggerBtn(lastStartLabel);
            const endBtn = findTriggerBtn(lastEndLabel);

            if (startBtn) {
                console.log('[ELH-Universal] Opening Start Date Picker');
                startBtn.click();
                await wait(300); // Wait for popover
                if (await selectDateInCalendar(startVal)) {
                    highlightElement(startBtn, 'green');
                }
            }

            if (endBtn) {
                console.log('[ELH-Universal] Opening End Date Picker');
                endBtn.click();
                await wait(300); // Wait for popover
                if (await selectDateInCalendar(endVal)) {
                    highlightElement(endBtn, 'green');
                }
            }

            await wait(200); // Small pause between rows
        }
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
