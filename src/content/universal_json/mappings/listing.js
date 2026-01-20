
// Configuration for simple 1-to-1 mappings
const LISTING_CONFIG = {
    StepLocation: [
        { key: 'street_address', label: 'Street address', type: 'input' },
        { key: 'floor', label: 'Floor', type: 'input' },
        { key: 'building_number', label: 'Building number', type: 'input' },
        { key: 'fraction', label: 'Fraction', type: 'input' },
        { key: 'postal_code', label: 'Postal Code', type: 'input' },
        { key: 'neighborhood', label: 'Neighborhood', type: 'input' },
        { key: 'zone', label: 'Zone', type: 'input' },
        { key: 'city', label: 'City', type: 'select' }
    ],
    StepType: [
        { key: 'number_of_rooms', label: 'Number of rooms', type: 'input' },
        { key: 'number_of_bathrooms', label: 'Number of bathrooms', type: 'input' },
        { key: 'listing_area_m2', label: 'Total area', type: 'input' },
        { key: 'furnished', label: 'Furnished', type: 'radio' },
        { key: 'shared_space', label: 'Shared Space', type: 'radio' },
        { key: 'living_room', label: 'Living Room', type: 'radio' },
        { key: 'balcony', label: 'Balcony', type: 'radio' },
        { key: 'view.city', label: 'City', type: 'checkbox' },
        { key: 'view.field', label: 'Field', type: 'checkbox' },
        { key: 'view.sea', label: 'Sea', type: 'checkbox' }
    ],
    StepComodation: [
        // Expenses & Cleaning (Checkboxes & Inputs)
        { key: 'Expenses.value', label: 'Expenses', type: 'checkbox' },
        { key: 'Expenses.details', label: 'Specify Included Expenses', type: 'input' },
        { key: 'Expenses.max_assured_value_eur', label: 'Specify Maximum Assured Value', type: 'input' },
        { key: 'Cleaning.value', label: 'Cleaning', type: 'checkbox' },
        { key: 'Cleaning.details', label: 'Specify Cleaning Details', type: 'input' },
        { key: 'other_amenities.details', label: 'Other Amenities', type: 'input' },

        // Safety & Accessibility (Radios)
        { key: 'safety_and_accessibility.cctv', label: 'CCTV', type: 'radio' },
        { key: 'safety_and_accessibility.code_entry', label: 'Code Entry', type: 'radio' },
        { key: 'safety_and_accessibility.24h_security', label: '24h Security', type: 'radio' },
        { key: 'safety_and_accessibility.smoke_detectors', label: 'Smoke Detectors', type: 'radio' },
        { key: 'safety_and_accessibility.armored_door', label: 'Armored Door', type: 'radio' },
        { key: 'safety_and_accessibility.elevator', label: 'Elevator', type: 'radio' },
        { key: 'safety_and_accessibility.reduced_mobility_access', label: 'Reduced Mobility Access', type: 'radio' },
        { key: 'safety_and_accessibility.parking', label: 'Parking', type: 'radio' },
        { key: 'safety_and_accessibility.distance_to_public_transport_m', label: 'Distance to Public Transport (m)', type: 'input' },

        // Comfort (Radios)
        { key: 'comfort.central_heating', label: 'Central Heating', type: 'radio' },
        { key: 'comfort.air_conditioning', label: 'Air Conditioning', type: 'radio' },
        { key: 'comfort.thermal_insulation', label: 'Thermal Insulation', type: 'radio' },
        { key: 'comfort.double_glazed_windows', label: 'Double Glazed Windows', type: 'radio' },
        { key: 'comfort.kitchen_equipment', label: 'Kitchen Equipment', type: 'radio' },
        { key: 'comfort.fridge', label: 'Fridge', type: 'radio' },
        { key: 'comfort.microwave_oven', label: 'Microwave Oven', type: 'radio' },
        { key: 'comfort.gas_electric_stove', label: 'Gas/Electric Stove', type: 'radio' },
        { key: 'comfort.dishwasher', label: 'Dishwasher', type: 'radio' },
        { key: 'comfort.washer_dryer', label: 'Washer/Dryer', type: 'radio' },

        // Technology (Radios)
        { key: 'technology.internet', label: 'Internet', type: 'radio' },
        { key: 'technology.internet_speed_mbps', label: 'Internet Speed (mb/s)', type: 'input' },
        { key: 'technology.cable_tv', label: 'Cable TV', type: 'radio' },
        { key: 'technology.smart_tv', label: 'Smart TV', type: 'radio' }
    ],
    StepRules: [
        { key: 'allow_night_guests', label: 'Allow Night Guests', type: 'checkbox' },
        { key: 'allow_pets', label: 'Allow Pets', type: 'checkbox' },
        { key: 'allow_smoking', label: 'Smoking allowed', type: 'checkbox' },
        { key: 'gender', label: 'Preferred Gender', type: 'select' },
        { key: 'max_number_of_tenants', label: 'Maximum Number of Tenants', type: 'input' }
    ],
    StepImages: [
        { key: 'listing_name', label: 'Flat Name', type: 'input' },
        { key: 'listing_description', label: 'Description', type: 'input' },
        { key: 'listing_landlord', label: 'Select Manager', type: 'combobox' }
    ]
};

// Helper: Safely access nested object property
function getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Helper: Async pause
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const ListingMapper = {
    async handle(step, jsonData, container) {
        console.log(`[ELH-Universal] ListingMapper handling step: ${step}`);

        const listingData = jsonData.listing_data || jsonData.property_data;
        if (!listingData) {
            console.warn('[ELH-Universal] No listing_data found in JSON.');
            return;
        }

        const stepData = listingData[step] || listingData;

        // --- Standard Configured Steps ---
        if (LISTING_CONFIG[step]) {
            await this.processConfiguredStep(step, stepData, container);
        }

        // --- Custom Logic ---
        // Blocked Dates logic reused from room.js
        if (step === 'BlockedDatesStep' || step === 'StepBlockedDates') {
            await this.handleBlockedDatesLogic(stepData, container);
        }
    },

    async processConfiguredStep(stepName, data, container) {
        const { setInputValue, setRadio, setSelect, setCheckbox, setCombobox } = await import('../field_setters.js');
        const config = LISTING_CONFIG[stepName];

        if (!config) return;

        console.log(`[ELH-Universal] Processing config for ${stepName}`);

        for (const field of config) {
            const rawValue = getNestedValue(data, field.key);
            if (rawValue === undefined || rawValue === null) continue;

            let valueToSet = rawValue;
            if (field.valueMap && field.valueMap[rawValue]) {
                valueToSet = field.valueMap[rawValue];
            }

            try {
                if (field.type === 'input') {
                    const el = this.findInputAfterLabel(container, field.label);
                    if (el) setInputValue(el, valueToSet.toString());
                    else console.log(`[ELH-Universal] Input for label '${field.label}' not found.`);
                } else if (field.type === 'select') {
                    setSelect(field.label, valueToSet.toString(), container);
                } else if (field.type === 'combobox') {
                    await setCombobox(field.label, valueToSet.toString(), container);
                } else if (field.type === 'radio') {
                    let val = valueToSet;
                    if (typeof valueToSet === 'boolean') {
                        val = valueToSet ? 'Yes' : 'No';
                    } else {
                        val = valueToSet.toString();
                    }
                    setRadio(field.label, val, container);
                } else if (field.type === 'checkbox') {
                    setCheckbox(field.label, !!valueToSet, container);
                }
            } catch (err) {
                console.error(`[ELH-Universal] Error setting ${field.label}`, err);
            }
        }

        // --- Post-processing for StepLocation ---
        if (stepName === 'StepLocation') {
            await this.ClickComputeGeoLocation(container);
        }
    },

    findInputAfterLabel(container, textPart) {
        const labels = Array.from(container.querySelectorAll('label'));
        const lbl = labels.find(l => l.innerText.toLowerCase().includes(textPart.toLowerCase()));

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
            const nested = next.querySelector('input, select, textarea');
            if (nested) return nested;
            next = next.nextElementSibling;
        }

        const childInput = lbl.querySelector('input, select, textarea');
        if (childInput) return childInput;

        return null;
    },

    async handleBlockedDatesLogic(data, container) {
        // COPIED LOGIC FROM room.js
        if (!data.blocked_dates || !Array.isArray(data.blocked_dates) || data.blocked_dates.length === 0) {
            console.log('[ELH-Universal] No blocked dates to add.');
            return;
        }

        const { selectDateInCalendar, highlightElement } = await import('../field_setters.js');

        // Find "Add Blocked Date" button.
        const addBtn = Array.from(container.querySelectorAll('button'))
            .find(b => b.textContent.includes('Add Blocked Date'));

        if (!addBtn) {
            console.warn('[ELH-Universal] "Add Blocked Date" button not found.');
            return;
        }

        // --- NEW LOGIC: Delete existing blocked dates if option enabled ---
        const storageData = await new Promise(resolve => chrome.storage.local.get(['deleteBlockedDatesBeforePasting'], resolve));

        if (storageData.deleteBlockedDatesBeforePasting) {
            console.log('[ELH-Universal] Deleting existing blocked dates before pasting...');

            let attempt = 0;
            while (attempt < 20) {
                const trashSvgs = Array.from(container.querySelectorAll('svg.lucide-trash2'));
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
                    highlightElement(btn, 'green');
                    await wait(200);
                }

                await wait(500);
                attempt++;
            }
        }
        // -----------------------------------------------------------------

        for (const dateRange of data.blocked_dates) {
            // Helper: Expand YYYY-MM to full date
            const expandDate = (val, isStart) => {
                if (!val || val === 'now') return val;
                const monthMatch = val.toString().match(/^(\d{4})-(\d{2})$/);
                if (monthMatch) {
                    const [_, y, m] = monthMatch;
                    if (isStart) {
                        return `${val}-01`;
                    } else {
                        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
                        return `${val}-${lastDay}`;
                    }
                }
                return val;
            };

            const startVal = expandDate(dateRange.start, true) || 'now';
            const endVal = expandDate(dateRange.end, false);

            if (!endVal) {
                console.warn('[ELH-Universal] Blocked date range missing end date. Skipping.');
                continue;
            }

            console.log(`[ELH-Universal] Adding Blocked Date: ${startVal} to ${endVal}`);

            addBtn.click();
            await wait(400);

            // Find the NEWEST inputs.
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
                await wait(300);
                if (await selectDateInCalendar(startVal)) {
                    highlightElement(startBtn, 'green');
                }
            }

            if (endBtn) {
                console.log('[ELH-Universal] Opening End Date Picker');
                endBtn.click();
                await wait(300);
                if (await selectDateInCalendar(endVal)) {
                    highlightElement(endBtn, 'green');
                }
            }

            await wait(200);
        }
    },

    async ClickComputeGeoLocation(container) {
        const { highlightElement } = await import('../field_setters.js');

        // Give React time to update DOM after all field changes
        await wait(800);

        // Find and click the "Compute Geo-location" button
        const buttons = Array.from(container.querySelectorAll('button'));
        const geoBtn = buttons.find(b =>
            b.textContent.trim().includes('Compute Geo-location')
        );

        if (geoBtn && !geoBtn.disabled) {
            console.log('[ELH-Universal] [StepLocation] Auto-clicking Compute Geo-location...');
            geoBtn.click();
            highlightElement(geoBtn, 'green');
            await wait(1500); // Allow time for geocoding to complete

            console.log('[ELH-Universal] [StepLocation] Geo-location computed.');
            return true;
        }

        console.warn('[ELH-Universal] [StepLocation] Compute Geo-location button not found or disabled.');
        return false;
    }
};
