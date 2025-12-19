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

    // 3. Find the option in the document (Radix often appends to body in a portal)
    // We search locally first, then globally (document.body) because it's usually in a portal.
    const searchScopes = [contextScope, document.body];
    let targetOption = null;

    for (const scope of searchScopes) {
        // Options usually have role="option" and are inside role="listbox"
        // Sometimes just divs with text.
        // ShadCn/Radix options usually have role="option".
        const options = Array.from(scope.querySelectorAll('[role="option"]'));
        targetOption = options.find(opt => opt.innerText.trim().toLowerCase() === value.toLowerCase());
        if (targetOption) break;
    }

    if (!targetOption) {
        console.warn(`[ELH-Universal] Option '${value}' not found for Combobox '${labelText}'.`);
        // Try closing it to reset state?
        triggerBtn.click();
        return false;
    }

    // 4. Click the option
    console.log(`[ELH-Universal] Select Option '${value}'`);
    targetOption.click();

    // Visual feedback on the trigger
    if (triggerBtn) {
        // rudimentary highlight
        triggerBtn.style.outline = '2px solid green';
        triggerBtn.style.boxShadow = '0 0 5px green';
    }

    return true;
}
