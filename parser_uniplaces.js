// Uniplaces helper: inject a "copy this room data to json" button
// Button style matches existing buttons in content.js (green background, white text, rounded)

(function() {
  try {
    const STYLE_ID = 'elh-uniplaces-style';
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        .elh-uniplaces-btn {
          background: rgb(57 146 62) !important;
          color: rgb(255, 255, 255) !important;
          border: none !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          position: fixed !important;
          top: 12px !important;
          left: 12px !important;
          z-index: 2147483647 !important; /* very top */
        }
        .elh-uniplaces-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }
      `;
      document.head && document.head.appendChild(s);
    }

    function findRoomData() {
      // Keep insertion order: source_url first
      const result = { source_url: window.location.href };

      // room name: h1.sc-1yx4bkn-1.fExLZX
      const h1 = document.querySelector('h1.sc-1yx4bkn-1.fExLZX');
      result.room_name = (h1 && h1.textContent) ? h1.textContent.trim() : '';

      // address: div.sc-1yx4bkn-4.cArfBY -> text
      const addressDiv = document.querySelector('div.sc-1yx4bkn-4.cArfBY');
      result.address_0 = (addressDiv && addressDiv.textContent) ? addressDiv.textContent.trim() : '';

      // rent_price: div.sc-bci2fn-4.kamSUo
      const rentDiv = document.querySelector('div.sc-bci2fn-4.kamSUo');
      result.rent_price = (rentDiv && rentDiv.textContent) ? rentDiv.textContent.trim() : '';

      // gender: div.sc-1xy9fw7-3.eeUNEg -> span text (e.g. "Mixed gender")
      const genderSpan = document.querySelector('div.sc-1xy9fw7-3.eeUNEg span');
      result.gender = (genderSpan && genderSpan.textContent) ? genderSpan.textContent.trim() : '';

      // apartment_description: inside div.sc-1fjnomd-0.gGflJS find p
      const descDiv = document.querySelector('div.sc-1fjnomd-0.gGflJS');
      if (descDiv) {
        const p = descDiv.querySelector('p');
        result.apartment_description = (p && p.textContent) ? p.textContent.trim() : '';
      } else {
        result.apartment_description = '';
      }

      // room_furniture: collect items from div.sc-jd78bw-2.gZBRDy -> span.sc-jd78bw-3.ehGlOH > div
      const furnitureContainer = document.querySelector('div.sc-jd78bw-2.gZBRDy');
      const furniture = [];
      if (furnitureContainer) {
        const items = furnitureContainer.querySelectorAll('span.sc-jd78bw-3.ehGlOH');
        items.forEach((sp) => {
          const d = sp.querySelector('div');
          if (d && d.textContent) {
            const txt = d.textContent.trim();
            if (txt) furniture.push(txt);
          }
        });
      }
      result.room_furniture = furniture;

      // Services and expenses parsing
      // Default outputs
      result.security_deposit = null;
      result.included_monthly_bills = {};
      result.other_fees = [];

      // Try to find the Services and expenses section
      const servicesSection = document.getElementById('Services and expenses') || Array.from(document.querySelectorAll('section')).find(s => {
        const h = s.querySelector('h2');
        return h && h.textContent && h.textContent.trim().toLowerCase() === 'services and expenses';
      });

      if (servicesSection) {
        try {
          // ONE-TIME: Security deposit
          const oneTimeHeader = Array.from(servicesSection.querySelectorAll('h3')).find(h => h.textContent && /one-time payments/i.test(h.textContent));
          if (oneTimeHeader) {
            // search for h4 with 'Security deposit' under the same section
            const secH4 = Array.from(servicesSection.querySelectorAll('h4')).find(h => h.textContent && /security deposit/i.test(h.textContent));
            if (secH4) {
              const container = secH4.closest('.sc-1pyjdju-2.iLNpqR') || secH4.parentElement;
              const valueNode = container && container.querySelector('.sc-1pyjdju-5.cYYEDG');
              const rawVal = valueNode && valueNode.textContent ? valueNode.textContent.trim() : '';
              const m = rawVal.match(/€\s*([0-9]+(?:[.,][0-9]+)?)/);
              if (m && m[1]) {
                const num = parseFloat(m[1].replace(',', '.'));
                result.security_deposit = isFinite(num) ? num : null;
              } else {
                result.security_deposit = null;
              }
            }
          }

          // FIXED MONTHLY BILLS
          const fixedHeader = Array.from(servicesSection.querySelectorAll('h3')).find(h => h.textContent && /fixed monthly bills/i.test(h.textContent));
          if (fixedHeader) {
            // container usually .sc-1pyjdju-6.gfoyyD
            const fixedContainer = fixedHeader.parentElement.querySelector('.sc-1pyjdju-6.gfoyyD') || fixedHeader.parentElement;
            if (fixedContainer) {
              const rows = fixedContainer.querySelectorAll('.sc-1x0yjfx-0.pcwpP');
              rows.forEach((row) => {
                const spans = row.querySelectorAll('span');
                if (spans && spans.length >= 2) {
                  const label = spans[0].textContent ? spans[0].textContent.trim() : '';
                  let status = spans[1].textContent ? spans[1].textContent.trim() : '';
                  // sometimes status contains nested span with text
                  if (!status && spans[1].querySelector) {
                    status = spans[1].querySelector('span') ? spans[1].querySelector('span').textContent.trim() : '';
                  }
                  const included = /included/i.test(status) && !/not included/i.test(status);
                  if (label) result.included_monthly_bills[label] = included;
                }
              });
            }
          }

          // OTHER FEES
          const otherHeader = Array.from(servicesSection.querySelectorAll('h3')).find(h => h.textContent && /other fees/i.test(h.textContent));
          if (otherHeader) {
            const otherContainer = otherHeader.parentElement;
            // find fee cards under this area
            const feeCards = otherContainer.querySelectorAll('.sc-1pyjdju-1.fQIAbo');
            feeCards.forEach((card) => {
              const h4 = card.querySelector('h4');
              const label = h4 && h4.textContent ? h4.textContent.trim() : '';
              const rawValNode = card.querySelector('.sc-1pyjdju-5.cYYEDG');
              const raw = rawValNode && rawValNode.textContent ? rawValNode.textContent.trim() : '';
              // description: first p under card
              const p = card.querySelector('p');
              const description = p && p.textContent ? p.textContent.trim() : '';
              if (label) {
                result.other_fees.push({ label, raw, description });
              }
            });
          }

        } catch (e) {
          console.warn('services parsing error', e);
        }
      }

      // rental_conditions (Variant A): simple map label -> boolean, with exceptions
      // Items live under #rental-conditions .sc-7pe2f2-0.hfOJyV
      const rentalMap = {};
      const condNodes = document.querySelectorAll('#rental-conditions .sc-7pe2f2-0.hfOJyV');
      if (condNodes && condNodes.length) {
        condNodes.forEach((node) => {
          const raw = (node.textContent || '').trim();
          if (!raw) return;
          const allowed = !node.classList.contains('text-strike-through');

          // Special case: Minimum stay
          if (/minimum stay/i.test(raw)) {
            rentalMap['Minimum stay'] = allowed;
            // extract everything after the phrase 'Minimum stay ' (preserve as string)
            const m = raw.match(/minimum stay\s*(.*)/i);
            rentalMap['Minimum stay value'] = m && m[1] ? m[1].trim() : '';
            return;
          }

          // Special case: Extra per tenant
          if (/extra per tenant/i.test(raw)) {
            rentalMap['Extra per tenant'] = allowed;
            // extract digits after euro sign
            const m = raw.match(/€\s*([0-9]+(?:[.,][0-9]+)?)/);
            if (m && m[1]) {
              // normalize to number if possible
              const num = parseFloat(m[1].replace(',', '.'));
              rentalMap['Extra per tenant value'] = isFinite(num) ? num : m[1];
            } else {
              rentalMap['Extra per tenant value'] = '';
            }
            return;
          }

          // Default: store the raw label as key with boolean allowed
          rentalMap[raw] = allowed;
        });
      }
      result.rental_conditions = rentalMap;

      return result;
    }

    function copyJsonToClipboard(obj) {
      const txt = JSON.stringify(obj, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(txt);
      }
      // fallback
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve();
      } catch (e) {
        document.body.removeChild(ta);
        return Promise.reject(e);
      }
    }

    function insertButtonIfNeeded() {
      if (document.querySelector('.elh-uniplaces-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'elh-uniplaces-btn';
      btn.textContent = 'copy this room data to json';
      btn.title = 'Parse this entire page and copy all info about this room and apartment into structured JSON';

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.disabled = true;
        const data = findRoomData();
        try {
          await copyJsonToClipboard(data);
          btn.textContent = 'copied!';
        } catch (err) {
          console.error('copy failed', err);
          btn.textContent = 'copy failed';
        }
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'copy this room data to json';
        }, 1500);
      });

      document.body.appendChild(btn);
    }

    insertButtonIfNeeded();

    // Observe mutations to re-insert button if SPA changes page
    const obs = new MutationObserver(() => {
      insertButtonIfNeeded();
    });
    obs.observe(document.body, { childList: true, subtree: true });

  } catch (e) {
    console.error('parser_uniplaces error', e);
  }
})();
