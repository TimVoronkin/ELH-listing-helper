// pasteJsonFields.js
(function () {
  // Debug: script loaded
  console.log('[ELH-pasteJson] script loaded, location.href=', location.href);

  // Insert button when possible; handle SPA/dynamic DOM by observing body
  // Ensure shared styles are present
  function loadSharedStylesOnce() {
    try {
      const ID = 'elh-shared-styles';
      if (document.getElementById(ID)) return;
      const link = document.createElement('link');
      link.id = ID;
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/shared/buttons.css');
      document.head && document.head.appendChild(link);
    } catch (e) { console.warn('Failed to inject shared styles', e); }
  }
  loadSharedStylesOnce();
  function isAllowedPage() {
    const url = location.href;
    try {
      const u = new URL(url);
      if (u.hostname !== 'www.erasmuslifehousing.com') return false;
      const p = u.pathname.replace(/\/+/g, '/');
      // exact: /dashboard/admin/houses/form
      if (p === '/dashboard/admin/houses/form') return true;
      // /dashboard/admin/listings/{something}/rooms/form
      if (/^\/dashboard\/admin\/listings\/[^\/]+\/rooms\/form\/?$/.test(p)) return true;
      // /dashboard/admin/listings/{something}/rooms/form/{something}
      if (/^\/dashboard\/admin\/listings\/[^\/]+\/rooms\/form\/[^\/]+\/?$/.test(p)) return true;
      // /dashboard/admin/houses/form/{something}
      if (/^\/dashboard\/admin\/houses\/form\/[^\/]+\/?$/.test(p)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function createPasteButton() {
    if (!isAllowedPage()) return; // only show on allowed pages
    if (!document.body) return;
    if (document.getElementById('elh-paste-json-btn')) return; // already inserted

    const btn = document.createElement('button');
    btn.id = 'elh-paste-json-btn';
    btn.type = 'button';
    btn.textContent = 'paste json data into fields';
    // use shared classes for consistent styling
    btn.className = 'elh-btn fixed';
    btn.addEventListener('click', handlePasteClick);
    document.body.appendChild(btn);
    console.log('[ELH-pasteJson] paste button inserted');
  }

  // Try to create immediately
  try { createPasteButton(); } catch (e) { console.warn('[ELH-pasteJson] createPasteButton immediate failed', e); }

  // Observe DOM for dynamic changes (SPA) and insert button when body becomes available or when form renders
  const insObserver = new MutationObserver((mutations) => {
    createPasteButton();
  });
  insObserver.observe(document.documentElement || document, { childList: true, subtree: true });

  async function handlePasteClick() {
    console.log('[ELH-pasteJson] paste button clicked');
    const stepDiv = document.querySelector('div[data-sentry-component="StepComodation"]');
    if (!stepDiv) {
      console.warn('[ELH-pasteJson] StepComodation element not found on page');
      // continue — maybe form exists without that wrapper
    } else {
      console.log('[ELH-pasteJson] found stepDiv', stepDiv);
    }

    try {
      const text = await navigator.clipboard.readText();
      console.log('[ELH-pasteJson] clipboard text length:', text ? text.length : 0);
      if (!text) {
        console.warn('[ELH-pasteJson] clipboard empty');
        return;
      }
      let data;
      try {
        data = JSON.parse(text);
        console.log('[ELH-pasteJson] parsed clipboard JSON keys:', data && Object.keys(data));
      } catch (e) {
        console.error('[ELH-pasteJson] Clipboard does not contain valid JSON.', e);
        return;
      }
      // Support new structured address format: { raw, street, neighborhood, city }
      const addrObj = data && (data.address || data.address_0 || data.address0 || data.street);
      let streetVal = '';
      let neighborhoodVal = '';
      let cityVal = '';
      if (addrObj) {
        if (typeof addrObj === 'string') {
          streetVal = addrObj;
        } else if (typeof addrObj === 'object') {
          streetVal = addrObj.street || addrObj.raw || '';
          neighborhoodVal = addrObj.neighborhood || '';
          cityVal = addrObj.city || '';
        }
      }

      console.log('[ELH-pasteJson] parsed address parts', { streetVal, neighborhoodVal, cityVal });

      // 1) Street input
      if (streetVal) {
        const streetField = findStreetAddressField();
        if (streetField) {
          setInputValue(streetField, streetVal);
          highlightElement(streetField);
          console.log('[ELH-pasteJson] street set to', streetVal);
        } else {
          console.warn('[ELH-pasteJson] street input not found');
        }
      }

      // 2) Neighborhood
      if (neighborhoodVal) {
        const neighField = findNeighborhoodField();
        if (neighField) {
          setInputValue(neighField, neighborhoodVal);
          highlightElement(neighField);
          console.log('[ELH-pasteJson] neighborhood set to', neighborhoodVal);
        } else {
          console.warn('[ELH-pasteJson] neighborhood input not found');
        }
      }

      // 3) City selection
      if (cityVal) {
        const cityControl = findCityControl();
        if (cityControl && cityControl.select) {
          const matchedOption = Array.from(cityControl.select.options).find(opt => (opt.text || opt.label || '').trim().toLowerCase() === cityVal.trim().toLowerCase());
          if (matchedOption) {
            try {
              // use native setter for select value
              const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
              if (nativeSetter) nativeSetter.call(cityControl.select, matchedOption.value);
              else cityControl.select.value = matchedOption.value;
              cityControl.select.dispatchEvent(new Event('input', { bubbles: true }));
              cityControl.select.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('[ELH-pasteJson] city selected (select updated)', matchedOption.value, matchedOption.text);
              // highlight select + visible combobox button (do not mutate inner text)
              try { highlightElement(cityControl.select); } catch (e) {}
              if (cityControl.button) { try { highlightElement(cityControl.button); } catch (e) {} }
            } catch (e) {
              console.warn('[ELH-pasteJson] failed to set select value safely', e);
            }
            // Do NOT mutate the visible combobox DOM directly (changing inner text) — React controls this and manual changes may break the app
          } else {
            console.warn('[ELH-pasteJson] city option not found for', cityVal);
          }
        } else {
          console.warn('[ELH-pasteJson] city select control not found');
        }
      }

      // 4) Other fees: handle Cleaning fee and other fees
      if (data && Array.isArray(data.other_fees) && data.other_fees.length > 0 && document.querySelector('div[data-sentry-component="StepComodation"]')) {
        console.log('[ELH-pasteJson] processing other_fees', data.other_fees);
        const otherLines = [];
        for (const fee of data.other_fees) {
          const label = (fee.label || '').trim();
          const raw = (fee.raw || '').trim();
          const desc = (fee.description || '').trim();
          if (!label) continue;
          if (label.toLowerCase() === 'cleaning fee') {
            // If raw == 'Included' then check Cleaning checkbox and fill cleaningDescription
            if (raw.toLowerCase() === 'included') {
              const ok = setCheckboxByLabel('Cleaning', true);
              console.log('[ELH-pasteJson] set Cleaning checkbox:', ok);
              // fill cleaning description textarea
              const cleaningTa = findTextareaByName('cleaningDescription') || document.getElementById('«r2p»-form-item') || document.querySelector('textarea[name="cleaningDescription"]');
              if (cleaningTa) {
                setInputValue(cleaningTa, desc);
                highlightElement(cleaningTa);
                console.log('[ELH-pasteJson] cleaning description set');
              } else {
                console.warn('[ELH-pasteJson] cleaning description textarea not found');
              }
            } else {
              // If not included, still add to Other Amenities list
              otherLines.push(`${label}: ${raw}${desc ? ' — ' + desc : ''}`);
            }
          } else {
            // any other fee -> append to Other Amenities
            otherLines.push(`${label}: ${raw}${desc ? ' — ' + desc : ''}`);
          }
        }
        if (otherLines.length > 0) {
          const otherTa = findTextareaByName('otherAmenities') || document.getElementById('«r2q»-form-item') || document.querySelector('textarea[name="otherAmenities"]');
          if (otherTa) {
            // append to existing content if any
            const existing = (otherTa.value || otherTa.textContent || '').toString().trim();
            const newVal = existing ? existing + '\n' + otherLines.join('\n') : otherLines.join('\n');
            setInputValue(otherTa, newVal);
            highlightElement(otherTa);
            console.log('[ELH-pasteJson] other amenities set');
          } else {
            console.warn('[ELH-pasteJson] other amenities textarea not found');
          }
        }
      }
      // 5) StepImages: set Description textarea from apartment_description if present
      try {
        const stepImagesDiv = document.querySelector('div[data-sentry-component="StepImages"]');
        if (stepImagesDiv && data && typeof data.apartment_description === 'string' && data.apartment_description.trim()) {
          const descVal = data.apartment_description.trim();
          // prefer textarea[name="specialObservations"] (from page snippet)
          const descTa = stepImagesDiv.querySelector('textarea[name="specialObservations"]') || document.querySelector('textarea[name="specialObservations"]') || document.getElementById('«r14p»-form-item');
          if (descTa) {
            // first show loading + original text so user sees progress
            const loadingText = `loading translation of this...\n${descVal}`;
            setInputValue(descTa, loadingText);
            highlightElement(descTa, 'orange');
            console.log('[ELH-pasteJson] apartment_description (loading) inserted into Description textarea');

            // build Gemini prompt: ask to return only English translation
            const promptObj = {
              instruction: `Answer me only with a translation of this text into English and nothing else: ${descVal}`
            };

            // send request via background script (reuse existing gemini_request flow)
            try {
              chrome.runtime.sendMessage({ action: 'gemini_request', prompt: JSON.stringify(promptObj) }, (response) => {
                try {
                  if (!response) {
                    console.warn('[ELH-pasteJson] Gemini response empty');
                    return;
                  }
                  // response may contain candidates[].content.parts[0].text or a top-level text
                  let translated = null;
                  if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].text) {
                    translated = response.candidates[0].content.parts[0].text;
                  } else if (response.output && typeof response.output === 'string') {
                    translated = response.output;
                  } else if (typeof response === 'string') {
                    translated = response;
                  } else if (response.result && response.result.output_text) {
                    translated = response.result.output_text;
                  }

                  if (translated && typeof translated === 'string') {
                    // trim whitespace and replace the textarea with the translation
                    const finalText = translated.trim();
                    setInputValue(descTa, finalText);
                    highlightElement(descTa, 'green');
                    console.log('[ELH-pasteJson] Gemini translation inserted into Description textarea');
                  } else {
                    console.warn('[ELH-pasteJson] Gemini response did not contain a translated text', response);
                  }
                } catch (e) {
                  console.warn('[ELH-pasteJson] Error processing Gemini response', e, response);
                }
              });
            } catch (e) {
              console.warn('[ELH-pasteJson] Failed to call background Gemini request', e);
            }

          } else {
            console.warn('[ELH-pasteJson] Description textarea for StepImages not found');
          }
        }
      } catch (err) {
        console.warn('[ELH-pasteJson] StepImages handling failed', err);
      }

    } catch (err) {
      console.error('[ELH-pasteJson] Failed to read clipboard or insert address:', err);
    }
  }

  function findStreetAddressField() {
    const targetLabel = 'street address';
    console.log('[ELH-pasteJson] findStreetAddressField: searching labels for', targetLabel);
    // 1) Try to find label whose text content contains targetLabel (case-insensitive)
    const labels = Array.from(document.querySelectorAll('label, span'));
    for (const label of labels) {
      const txt = (label.textContent || '').trim().toLowerCase();
      if (!txt) continue;
      if (txt.includes(targetLabel) || txt.includes('street and number') || txt.includes('street and')) {
        console.log('[ELH-pasteJson] matching label found:', txt, label);
        // prefer associated input by htmlFor
        if (label.htmlFor) {
          const el = document.getElementById(label.htmlFor);
          if (el) { console.log('[ELH-pasteJson] found input by htmlFor', el); return el; }
        }
        // input inside label
        const inside = label.querySelector('input, textarea');
        if (inside) { console.log('[ELH-pasteJson] found input inside label', inside); return inside; }
        // sibling (common structure: label + wrapper)
        let sibling = label.nextElementSibling;
        if (sibling) {
          if (sibling.matches && (sibling.matches('input, textarea') || sibling.querySelector('input, textarea'))) {
            const res = sibling.matches('input, textarea') ? sibling : sibling.querySelector('input, textarea');
            console.log('[ELH-pasteJson] found input near label sibling', res);
            return res;
          }
        }
      }
    }

    // 2) Fallback: search inputs/textarea by placeholder, aria-label, name, id
    console.log('[ELH-pasteJson] findStreetAddressField: fallback searching inputs');
    const candidates = Array.from(document.querySelectorAll('input, textarea'));
    for (const el of candidates) {
      const combined = [
        el.getAttribute('placeholder'),
        el.getAttribute('aria-label'),
        el.name,
        el.id,
      ].filter(Boolean).join(' ').toLowerCase();
      if (combined.includes('street address') || combined.includes('street_address') || combined.includes('street') || combined.includes('street and number')) {
        console.log('[ELH-pasteJson] found candidate by attributes:', combined, el);
        return el;
      }
    }

    console.log('[ELH-pasteJson] findStreetAddressField: nothing matched');
    return null;
  }

  // Helper: set value safely for controlled inputs
  function setInputValue(el, value) {
    try {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const nativeSetter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, value);
        else el.value = value;
      } else if ('value' in el) {
        el.value = value;
      } else {
        el.textContent = value;
      }
    } catch (e) {
      try { el.value = value; } catch (err) { el.textContent = value; }
    }
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  // highlightElement: default green; pass color='orange' to show loading state
  function highlightElement(el, color = 'green') {
    try {
      if (!el || !el.style) return;
      if (color === 'orange') {
        el.style.border = '2px solid #ff8c00';
        el.style.boxShadow = '0 0 0 4px rgba(255,140,0,0.12)';
      } else {
        // default green
        el.style.border = '2px solid #28a745';
        el.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)';
      }
      el.style.outline = 'none';
    } catch (e) {}
  }

  function findNeighborhoodField() {
    // Look for label 'Neighborhood' or name 'freguesia'
    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      const txt = (label.textContent || '').trim().toLowerCase();
      if (txt.includes('neighborhood') || txt.includes('neighbourhood') || txt.includes('freguesia')) {
        if (label.htmlFor) {
          const el = document.getElementById(label.htmlFor);
          if (el) return el;
        }
        const inside = label.querySelector('input, textarea');
        if (inside) return inside;
        const sibling = label.nextElementSibling;
        if (sibling) {
          if (sibling.matches && (sibling.matches('input, textarea') || sibling.querySelector('input, textarea'))) {
            return sibling.matches('input, textarea') ? sibling : sibling.querySelector('input, textarea');
          }
        }
      }
    }
    // fallback by name/id
    const candidates = Array.from(document.querySelectorAll('input, textarea'));
    for (const el of candidates) {
      const combined = [el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.name, el.id].filter(Boolean).join(' ').toLowerCase();
      if (combined.includes('neighborhood') || combined.includes('neighbourhood') || combined.includes('freguesia')) return el;
    }
    return null;
  }

  function findCityControl() {
    // The page has a visible combobox button and a hidden select. Find the label 'Choose the city where you live' to get nearby elements
    const label = Array.from(document.querySelectorAll('label')).find(el => (el.textContent || '').toLowerCase().includes('choose the city where you live'));
    let btn = null;
    let sel = null;
    if (label) {
      // possible structure: label + button + select
      let next = label.nextElementSibling;
      // sometimes label and button are siblings inside a wrapper
      if (next && next.matches && next.matches('button[role="combobox"], button[role="combobox"], [role="combobox"]')) btn = next;
      // find nearby select
      const wrapper = label.parentElement || document;
      sel = wrapper.querySelector('select');
    }
    // general fallback: find select with city options (contains 'porto' etc.)
    if (!sel) {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const s of selects) {
        const optsText = Array.from(s.options).map(o => (o.text || o.label || '').toLowerCase()).join(' ');
        if (optsText.includes('porto') || optsText.includes('lisboa') || optsText.includes('porto')) { sel = s; break; }
      }
    }
    // fallback: try to find any button that looks like the visible combobox
    if (!btn) btn = document.querySelector('button[role="combobox"]') || document.querySelector('button[aria-haspopup]');
    return { button: btn, select: sel };
  }

  function findTextareaByName(name) {
    if (!name) return null;
    let ta = document.querySelector(`textarea[name="${name}"]`);
    if (ta) return ta;
    // try id lookup
    const byId = Array.from(document.querySelectorAll('textarea')).find(t => t.id && t.id.includes(name));
    if (byId) return byId;
    return null;
  }

  function setCheckboxByLabel(labelText, checked) {
    // The page uses a button role="checkbox" and a hidden input; find the label and toggle the associated button
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      if (txt === labelText.toLowerCase()) {
        // try to find associated button (previous sibling in structure)
        // structure in markup: <button role="checkbox" ...></button><input hidden ...><label for="id">Cleaning</label>
        const forId = lbl.htmlFor;
        if (forId) {
          // find button with matching id nearby
          const btn = document.getElementById(forId) || document.querySelector(`button#${CSS.escape(forId)}`);
          if (btn && btn.getAttribute('role') === 'checkbox') {
            return toggleRadixCheckbox(btn, checked);
          }
        }
        // fallback: find previous button sibling
        let prev = lbl.previousElementSibling;
        if (prev && prev.getAttribute && prev.getAttribute('role') === 'checkbox') {
          return toggleRadixCheckbox(prev, checked);
        }
        // fallback: search parent for a button with role=checkbox
        const parent = lbl.parentElement;
        if (parent) {
          const btn2 = parent.querySelector('button[role="checkbox"]');
          if (btn2) return toggleRadixCheckbox(btn2, checked);
        }
      }
    }
    return false;
  }

  function toggleRadixCheckbox(btn, checked) {
    try {
      const isChecked = btn.getAttribute('data-state') === 'checked' || btn.getAttribute('aria-checked') === 'true';
      if ((isChecked && checked) || (!isChecked && !checked)) return true; // already in desired state
      // try to click the button to toggle
      btn.click();
      // highlight it
      highlightElement(btn);
      return true;
    } catch (e) {
      console.warn('[ELH-pasteJson] toggleRadixCheckbox failed', e);
      return false;
    }
  }

})();
