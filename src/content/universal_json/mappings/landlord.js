// src/content/universal_json/mappings/landlord.js

const LANDLORD_CONFIG = {
    // There is only one main step/form for Landlord
    StepMain: [
        { key: 'full_name', label: 'Full Name', type: 'input' },
        { key: 'taxpayer_number', label: 'Taxpayer Number', type: 'input' },
        { key: 'phone_number', label: 'Phone number', type: 'input' },
        { key: 'email', label: 'Email', type: 'input' },
        {
            key: 'email_is_preferred',
            label: 'Preferred contact method',
            type: 'radio',
            valueMap: {
                true: 'Email',
                false: 'Phone number'
            }
        },
        { key: 'observations', label: 'observations', type: 'input' }, // textarea is usually found by findInputAfterLabel too
        { key: 'bank_details.name_designation', label: 'Name / designation', type: 'input' },
        { key: 'bank_details.iban_payments', label: 'IBAN', type: 'input' }
    ]
};

// Helper: Safely access nested object property
function getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export const LandlordMapper = {
    async handle(step, jsonData, container) {
        console.log(`[ELH-Universal] LandlordMapper handling step: ${step}`);

        const landlordData = jsonData.landlord_data;
        if (!landlordData) {
            console.warn('[ELH-Universal] No landlord_data found in JSON.');
            return;
        }

        // The user said "only one page", but the JSON wraps it in "StepMain"
        // If the button injector sends a step name, we use it, otherwise generic processing
        const stepKey = (step && LANDLORD_CONFIG[step]) ? step : 'StepMain';
        const stepData = landlordData[stepKey] || landlordData;

        await this.processConfiguredStep(stepKey, stepData, container);
    },

    async processConfiguredStep(stepName, data, container) {
        const { setInputValue, setRadio, setSelect, setCheckbox, findInputAfterLabel } = await import('../field_setters.js');
        const config = LANDLORD_CONFIG[stepName];

        if (!config) {
            console.warn(`[ELH-Universal] No config found for step: ${stepName}`);
            return;
        }

        console.log(`[ELH-Universal] Processing config for ${stepName}`);

        for (const field of config) {
            const rawValue = getNestedValue(data, field.key);
            if (rawValue === undefined || rawValue === null) continue;

            let valueToSet = rawValue;
            if (field.valueMap && field.valueMap.hasOwnProperty(rawValue)) {
                valueToSet = field.valueMap[rawValue];
            }

            try {
                if (field.type === 'input') {
                    // Logic to distinguish Phone Input vs Phone Radio if labels duplicate?
                    // findInputAfterLabel prioritizes INPUT/TEXTAREA/SELECT
                    let el = findInputAfterLabel(container, field.label);

                    // Special case for "Phone number" which might coincide with the Radio group label
                    // If findInputAfterLabel returns null or wrong element, we might need custom logic.
                    // But standard logic usually ignores non-inputs.

                    if (el) {
                        setInputValue(el, valueToSet.toString());
                    } else {
                        console.log(`[ELH-Universal] Input for label '${field.label}' not found.`);
                    }

                } else if (field.type === 'radio') {
                    // Radio button logic
                    let val = valueToSet;
                    if (typeof valueToSet === 'boolean') {
                        val = valueToSet ? 'Yes' : 'No';
                    }
                    // Force string if not boolean logic above
                    if (field.valueMap && field.valueMap[rawValue]) {
                        val = field.valueMap[rawValue];
                    }

                    setRadio(field.label, val, container);
                }
                // Add other types if needed (select, checkbox)
            } catch (err) {
                console.error(`[ELH-Universal] Error setting ${field.label}`, err);
            }
        }
    },

    // Expose finding method if needed by others or self
    findInputAfterLabel(container, textPart) {
        // This is actually imported from field_setters, but if we need a local override:
        // For now, rely on imported one.
        return null;
    }
};
