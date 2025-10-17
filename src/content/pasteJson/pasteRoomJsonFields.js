// pasteRoomJsonFields.js
(function () {
  console.log("[ELH-pasteRoomJson] script loaded, location=", location.href);

  function loadSharedStylesOnce() {
    try {
      const ID = "elh-shared-styles";
      if (document.getElementById(ID)) return;
      const link = document.createElement("link");
      link.id = ID;
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("src/shared/buttons.css");
      document.head && document.head.appendChild(link);
    } catch (e) {
      console.warn("[ELH-pasteRoomJson] Failed to inject shared styles", e);
    }
  }
  loadSharedStylesOnce();

  function isRoomEditPage() {
    try {
      const u = new URL(location.href);
      if (u.hostname !== "www.erasmuslifehousing.com") return false;
      const p = u.pathname.replace(/\/+/g, "/");
      // match /dashboard/admin/listings/{something}/rooms/form or with trailing /{something}
      return /^\/dashboard\/admin\/listings\/[^\/]+\/rooms\/form(\/.*)?$/.test(p);
    } catch (e) {
      return false;
    }
  }

  function createButton() {
    if (!isRoomEditPage()) return;
    if (!document.body) return;
    if (document.getElementById("elh-paste-room-json-btn")) return;

    const btn = document.createElement("button");
    btn.id = "elh-paste-room-json-btn";
    btn.type = "button";
    btn.textContent = "paste room rent from json";
    btn.className = "elh-btn fixed";
    btn.style.right = "12px";
    btn.style.bottom = "72px";
    btn.addEventListener("click", handleClick);
    document.body.appendChild(btn);
    console.log("[ELH-pasteRoomJson] button inserted");
  }

  try {
    createButton();
  } catch (e) {
    console.warn("[ELH-pasteRoomJson] createButton immediate failed", e);
  }

  const obs = new MutationObserver(() => createButton());
  obs.observe(document.documentElement || document, { childList: true, subtree: true });

  async function readClipboardJson() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn("[ELH-pasteRoomJson] clipboard JSON parse failed", e);
        return null;
      }
    } catch (err) {
      console.error("[ELH-pasteRoomJson] Failed to read clipboard", err);
      return null;
    }
  }

  // Find Monthly rent input by its label text 'Monthly rent (€)'
  function findMonthlyRentInput() {
    // find label nodes
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lbl of labels) {
      const t = (lbl.textContent || "").trim().toLowerCase();
      if (t.includes('monthly rent')) {
        // try htmlFor
        if (lbl.htmlFor) {
          const el = document.getElementById(lbl.htmlFor);
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return el;
          // sometimes the input is inside the same wrapper
        }
        // input inside label
        const inside = lbl.querySelector('input, textarea');
        if (inside) return inside;
        // next element sibling search
        let sib = lbl.nextElementSibling;
        if (sib) {
          const candidate = sib.matches && sib.matches('input, textarea') ? sib : sib.querySelector && (sib.querySelector('input, textarea'));
          if (candidate) return candidate;
        }
      }
    }

    // fallback: search inputs by placeholder, aria-label, id or name containing 'monthly' or 'rent'
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    for (const inp of inputs) {
      const attrs = [inp.getAttribute('placeholder'), inp.getAttribute('aria-label'), inp.name, inp.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (attrs.includes('monthly') || attrs.includes('monthly rent') || attrs.includes('rent')) return inp;
    }
    return null;
  }

  function setInputValue(el, value) {
    try {
      if (!el) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(el, value);
      else el.value = value;
    } catch (e) {
      try { el.value = value; } catch (_) { el.textContent = value; }
    }
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  // Find a radio button inside a radiogroup that belongs to a group label (loose match)
  function findRadioByGroupLabelOption(groupLabelText, optionText) {
    if (!groupLabelText || !optionText) return null;
    const labels = Array.from(document.querySelectorAll('label'));
    const target = groupLabelText.trim().toLowerCase();
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      if (!txt) continue;
      if (txt.includes(target)) {
        // try to find radiogroup nearby
        let rg = null;
        // next sibling may be the radiogroup wrapper
        if (lbl.nextElementSibling && lbl.nextElementSibling.getAttribute && lbl.nextElementSibling.getAttribute('role') === 'radiogroup') {
          rg = lbl.nextElementSibling;
        }
        // or parent wrapper may contain it
        if (!rg && lbl.parentElement) rg = lbl.parentElement.querySelector('[role="radiogroup"]');
        if (!rg) rg = document.querySelector('[role="radiogroup"]');
        if (!rg) continue;
        // find option label elements inside radiogroup
        const optionLabels = Array.from(rg.querySelectorAll('label'));
        for (const ol of optionLabels) {
          const ot = (ol.textContent || '').trim().toLowerCase();
          if (!ot) continue;
          if (ot === optionText.trim().toLowerCase() || ot.includes(optionText.trim().toLowerCase())) {
            // find associated button: try previous sibling, or htmlFor
            if (ol.htmlFor) {
              const btn = document.getElementById(ol.htmlFor) || document.querySelector(`button#${CSS.escape(ol.htmlFor)}`);
              if (btn && btn.getAttribute && btn.getAttribute('role') === 'radio') return btn;
            }
            let prev = ol.previousElementSibling;
            if (prev && prev.getAttribute && prev.getAttribute('role') === 'radio') return prev;
            // parent search
            const p = ol.parentElement;
            if (p) {
              const btn2 = p.querySelector('button[role="radio"]');
              if (btn2) return btn2;
            }
          }
        }
      }
    }
    return null;
  }

  // More robust: search inside the FeaturesSteps container for a label matching groupLabelText,
  // then find the radiogroup near that label and return the button for optionText ('Yes' or 'No').
  function findRadioInFeatures(groupLabelText, optionText) {
    const container = document.querySelector('div[data-sentry-component="FeaturesSteps"]') || document;
    if (!groupLabelText || !optionText) return null;
    const target = groupLabelText.trim().toLowerCase();
    const labels = Array.from(container.querySelectorAll('label'));
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      if (!txt) continue;
      if (txt.includes(target)) {
        // try find nearby radiogroup: nextElementSibling, parent query, closest ancestor
        let rg = null;
        if (lbl.nextElementSibling && lbl.nextElementSibling.querySelector && lbl.nextElementSibling.querySelector('[role="radiogroup"]')) {
          rg = lbl.nextElementSibling.querySelector('[role="radiogroup"]');
        }
        if (!rg && lbl.nextElementSibling && lbl.nextElementSibling.getAttribute && lbl.nextElementSibling.getAttribute('role') === 'radiogroup') rg = lbl.nextElementSibling;
        if (!rg && lbl.parentElement) rg = lbl.parentElement.querySelector('[role="radiogroup"]');
        if (!rg) rg = container.querySelector('[role="radiogroup"]');
        if (!rg) continue;
        // find Yes/No buttons inside rg (buttons with role=radio)
        const buttons = Array.from(rg.querySelectorAll('button[role="radio"]'));
        // find corresponding label for optionText inside radiogroup
        const optionLabels = Array.from(rg.querySelectorAll('label'));
        for (const ol of optionLabels) {
          const ot = (ol.textContent || '').trim().toLowerCase();
          if (!ot) continue;
          if (ot === optionText.trim().toLowerCase() || ot.includes(optionText.trim().toLowerCase())) {
            // try to find associated radio button
            if (ol.htmlFor) {
              const btn = rg.querySelector(`#${CSS.escape(ol.htmlFor)}`) || document.getElementById(ol.htmlFor);
              if (btn && btn.getAttribute && btn.getAttribute('role') === 'radio') return btn;
            }
            // otherwise try to find a button near this label
            let prev = ol.previousElementSibling;
            if (prev && prev.getAttribute && prev.getAttribute('role') === 'radio') return prev;
            // try matching by index: label index -> button index
            const li = optionLabels.indexOf(ol);
            if (li >= 0 && buttons[li]) return buttons[li];
            // fallback: return first button
            if (buttons[0]) return buttons[0];
          }
        }
      }
    }
    return null;
  }

  // Find the Total area (m²) numeric input inside FeaturesSteps
  function findTotalAreaInput() {
    const container = document.querySelector('div[data-sentry-component="FeaturesSteps"]') || document;
    // find label that contains 'Total area' or 'Total area (m²)'
    const label = Array.from(container.querySelectorAll('label')).find(l => (l.textContent||'').toLowerCase().includes('total area'));
    if (label) {
      if (label.htmlFor) {
        const el = document.getElementById(label.htmlFor);
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return el;
      }
      const sibling = label.nextElementSibling;
      if (sibling) {
        const found = sibling.matches && sibling.matches('input, textarea') ? sibling : sibling.querySelector && (sibling.querySelector('input, textarea'));
        if (found) return found;
      }
      // fallback: search inputs by placeholder/name/id
    }
    const inputs = Array.from(container.querySelectorAll('input, textarea'));
    for (const inp of inputs) {
      const attrs = [inp.getAttribute('placeholder'), inp.getAttribute('aria-label'), inp.name, inp.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (attrs.includes('total area') || attrs.includes('m²') || attrs.includes('m2') || attrs.includes('area')) return inp;
    }
    return null;
  }

  // Generic helper: find an input (input or textarea) by nearby label text (loose match)
  function findInputByLabelText(labelText, container = document) {
    if (!labelText) return null;
    const target = labelText.trim().toLowerCase();
    // search labels first
    const labels = Array.from(container.querySelectorAll('label'));
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      if (!txt) continue;
      if (txt.includes(target)) {
        // try htmlFor -> id
        if (lbl.htmlFor) {
          const el = document.getElementById(lbl.htmlFor);
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return el;
        }
        // input inside label
        const inside = lbl.querySelector('input, textarea');
        if (inside) return inside;
        // next sibling or descendant
        let sib = lbl.nextElementSibling;
        if (sib) {
          const candidate = (sib.matches && sib.matches('input, textarea')) ? sib : (sib.querySelector && sib.querySelector('input, textarea'));
          if (candidate) return candidate;
        }
      }
    }
    // fallback: search inputs by placeholder, aria-label, id or name containing labelText
    const inputs = Array.from(container.querySelectorAll('input, textarea'));
    for (const inp of inputs) {
      const attrs = [inp.getAttribute('placeholder'), inp.getAttribute('aria-label'), inp.name, inp.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (attrs.includes(target)) return inp;
    }
    return null;
  }

  // Handle FeaturesSteps: set Second Bed to Yes if >=2 beds in room_furniture, else No
  async function handleFeatures(jsonData) {
    try {
      if (!jsonData || !Array.isArray(jsonData.room_furniture)) return;
      const items = jsonData.room_furniture
        .filter((i) => i && typeof i === 'string')
        .map((i) => i.trim().toLowerCase())
        .filter(Boolean);

      // Second Bed logic
      const bedCount = items.filter((s) => s.includes('bed')).length;
      const desiredBed = bedCount >= 2 ? 'Yes' : 'No';
      let btn = findRadioInFeatures('Second Bed', desiredBed) || findRadioByGroupLabelOption('Second Bed', desiredBed);
      if (!btn) {
        console.warn('[ELH-pasteRoomJson] Second Bed radio button not found');
      } else {
        const isChecked = btn.getAttribute('data-state') === 'checked' || btn.getAttribute('aria-checked') === 'true';
        if (!isChecked) {
          try { btn.click(); } catch (e) { console.warn('[ELH-pasteRoomJson] failed to click Second Bed', e); }
        }
        try { btn.style.border = '2px solid #28a745'; btn.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)'; setTimeout(()=>{ btn.style.border=''; btn.style.boxShadow=''; },1500);}catch(e){}
        console.log('[ELH-pasteRoomJson] Second Bed set ->', desiredBed, '(bedCount=', bedCount, ')');
      }

      // Additional mappings: room_furniture -> site label
      const mapping = {
        'desk': 'Desk',
        'wardrobe': 'Closet',
        'window': 'Window'
      };

      for (const [key, siteLabel] of Object.entries(mapping)) {
        try {
          const present = items.some((s) => s.includes(key));
          const want = present ? 'Yes' : 'No';
          const rb = findRadioInFeatures(siteLabel, want) || findRadioByGroupLabelOption(siteLabel, want);
          if (!rb) {
            console.warn('[ELH-pasteRoomJson] radio for', siteLabel, 'not found');
            continue;
          }
          const checked = rb.getAttribute('data-state') === 'checked' || rb.getAttribute('aria-checked') === 'true';
          if (!checked) {
            try { rb.click(); } catch (e) { console.warn('[ELH-pasteRoomJson] failed to click', siteLabel, e); }
          }
          try { rb.style.border = '2px solid #28a745'; rb.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)'; setTimeout(()=>{ rb.style.border=''; rb.style.boxShadow=''; },1200);}catch(e){}
          console.log('[ELH-pasteRoomJson] set', siteLabel, '->', want, '(found=', present, ')');
        } catch (e) {
          console.warn('[ELH-pasteRoomJson] mapping handling failed for', siteLabel, e);
        }
      }

      // Total area handling: look for an item ending with ' m²'
      try {
        const areaItem = items.find((s) => /\d+\s*m²$/.test(s) || /\d+\s*m2$/.test(s));
        if (areaItem) {
          // extract numeric portion
          const m = areaItem.match(/(\d+(?:[\.,]\d+)?)/);
          if (m && m[1]) {
            const areaVal = m[1].replace(',', '.');
            const areaInput = findTotalAreaInput();
            if (areaInput) {
              setInputValue(areaInput, areaVal);
              try { areaInput.style.border = '2px solid #28a745'; areaInput.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)'; setTimeout(()=>{ areaInput.style.border=''; areaInput.style.boxShadow=''; },1500);}catch(e){}
              console.log('[ELH-pasteRoomJson] Total area set to', areaVal);
            } else {
              console.warn('[ELH-pasteRoomJson] Total area input not found');
            }
          }
        }
      } catch (e) {
        console.warn('[ELH-pasteRoomJson] Total area handling failed', e);
      }

    } catch (e) {
      console.warn('[ELH-pasteRoomJson] handleFeatures failed', e);
    }
  }

  // detect if PaymentSteps section is present
  function isPaymentStepActive() {
    // the page uses data-sentry-component="PaymentSteps" around the payment area
    const el = document.querySelector('div[data-sentry-component="PaymentSteps"]');
    return !!el;
  }

  async function handleClick() {
    console.log('[ELH-pasteRoomJson] button clicked');
    const jsonData = await readClipboardJson();
    if (!jsonData) {
      alert('Clipboard does not contain valid JSON');
      return;
    }

    // If FeaturesSteps present, handle that first
    const featuresEl = document.querySelector('div[data-sentry-component="FeaturesSteps"]');
    if (featuresEl) {
      console.log('[ELH-pasteRoomJson] Detected FeaturesSteps - applying features handler');
      await handleFeatures(jsonData);
      return;
    }

    // Otherwise, if PaymentSteps present, handle rent insertion
    if (!isPaymentStepActive()) {
      alert('Neither Features nor Payment step detected on the page. Navigate to the appropriate step before pasting.');
      return;
    }
    // rent_price may be nested under rent_price or price or monthly_rent
    const rent = jsonData.rent_price ?? jsonData.price ?? jsonData.monthly_rent ?? null;
    if (rent == null) {
      alert('rent_price key not found in JSON');
      return;
    }
    const input = findMonthlyRentInput();
    if (!input) {
      alert('Monthly rent input not found on the page');
      return;
    }
    // Ensure numeric value (strip non-digits except dot and comma)
    let rentStr = String(rent).trim();
    // replace comma with dot and remove currency symbols/letters
    rentStr = rentStr.replace(',', '.').replace(/[^0-9.\-]/g, '');
    setInputValue(input, rentStr);
    // highlight briefly
    try {
      input.style.border = '2px solid #28a745';
      input.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)';
      setTimeout(() => {
        input.style.border = '';
        input.style.boxShadow = '';
      }, 2500);
    } catch (e) {}
    console.log('[ELH-pasteRoomJson] Monthly rent set to', rentStr);
    // --- Extra Person handling ---
    try {
      // JSON keys: 'Extra per tenant' (boolean) and 'Extra per tenant value' (number)
      const extraPerTenant = jsonData.rental_conditions && (jsonData.rental_conditions['Extra per tenant'] ?? jsonData['Extra per tenant']);
      const extraPerTenantValue = jsonData.rental_conditions && (jsonData.rental_conditions['Extra per tenant value'] ?? jsonData['Extra per tenant value'] ?? jsonData['Extra per tenant value (€)'] ?? jsonData['extra_per_tenant_value']) ;
      // find Extra Person radiogroup and set yes/no
      if (typeof extraPerTenant !== 'undefined') {
        const want = extraPerTenant ? 'Yes' : 'No';
        // try to find radio by group label 'Extra Person'
        const rb = findRadioInFeatures('Extra Person', want) || findRadioByGroupLabelOption('Extra Person', want);
        if (rb) {
          const checked = rb.getAttribute('data-state') === 'checked' || rb.getAttribute('aria-checked') === 'true';
          if (!checked) {
            try { rb.click(); } catch (e) { console.warn('[ELH-pasteRoomJson] failed to click Extra Person', e); }
          }
          try { rb.style.border = '2px solid #28a745'; rb.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)'; setTimeout(()=>{ rb.style.border=''; rb.style.boxShadow=''; },1200);}catch(e){}
          console.log('[ELH-pasteRoomJson] Extra Person set ->', want);
        } else {
          // sometimes PaymentSteps uses the same radiogroup structure but outside FeaturesSteps
          const rb2 = findRadioByGroupLabelOption('Extra Person', want) || findRadioInFeatures('Extra Person', want);
          if (rb2) {
            try { rb2.click(); } catch (e) { console.warn('[ELH-pasteRoomJson] failed to click Extra Person fallback', e); }
          } else {
            console.warn('[ELH-pasteRoomJson] Extra Person radio not found');
          }
        }
      }

      // Extra person value input
      if (typeof extraPerTenantValue !== 'undefined' && extraPerTenantValue !== null) {
        const val = String(extraPerTenantValue).trim();
        const extraInput = findInputByLabelText('Extra person value', document) || findInputByLabelText('Extra person value (€)', document) || findInputByLabelText('Extra person value (€)', document.querySelector('div[data-sentry-component="PaymentSteps"]') || document);
        if (extraInput) {
          // ensure numeric only
          const cleaned = val.replace(',', '.').replace(/[^0-9.\-]/g, '');
          setInputValue(extraInput, cleaned);
          try { extraInput.style.border = '2px solid #28a745'; extraInput.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)'; setTimeout(()=>{ extraInput.style.border=''; extraInput.style.boxShadow=''; },1500);}catch(e){}
          console.log('[ELH-pasteRoomJson] Extra person value set to', cleaned);
        } else {
          console.warn('[ELH-pasteRoomJson] Extra person value input not found');
        }
      }
    } catch (e) {
      console.warn('[ELH-pasteRoomJson] Extra Person handling failed', e);
    }
  }

})();
