(function () {
  "use strict";
  try {
    function findRoomData() {
      const result = { source_url: window.location.href };

      const h1 = document.querySelector('h1.sc-1yx4bkn-1.fExLZX');
      result.room_name = (h1 && h1.textContent) ? h1.textContent.trim() : '';

      const addressDiv = document.querySelector('div.sc-1yx4bkn-4.cArfBY');
      const addrRaw = (addressDiv && addressDiv.textContent) ? addressDiv.textContent.trim() : '';
      let street = '';
      let neighborhood = '';
      let city = '';
      if (addrRaw) {
        const parts = addrRaw.split(',').map(p => p.trim());
        street = parts[0] || '';
        neighborhood = parts[1] || '';
        city = parts[2] || '';
      }
      result.address = { raw: addrRaw, street, neighborhood, city };

      const rentDiv = document.querySelector('div.sc-bci2fn-4.kamSUo');
      result.rent_price = (rentDiv && rentDiv.textContent) ? rentDiv.textContent.trim() : '';

      const genderSpan = document.querySelector('div.sc-1xy9fw7-3.eeUNEg span');
      result.gender = (genderSpan && genderSpan.textContent) ? genderSpan.textContent.trim() : '';

      const descDiv = document.querySelector('div.sc-1fjnomd-0.gGflJS');
      if (descDiv) {
        const p = descDiv.querySelector('p');
        result.apartment_description = (p && p.textContent) ? p.textContent.trim() : '';
      } else {
        result.apartment_description = '';
      }

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

      result.security_deposit = null;
      result.included_monthly_bills = {};
      result.other_fees = [];

      const servicesSection = document.getElementById('Services and expenses') || Array.from(document.querySelectorAll('section')).find(s => {
        const h = s.querySelector('h2');
        return h && h.textContent && h.textContent.trim().toLowerCase() === 'services and expenses';
      });

      if (servicesSection) {
        try {
          const oneTimeHeader = Array.from(servicesSection.querySelectorAll('h3')).find(h => h.textContent && /one-time payments/i.test(h.textContent));
          if (oneTimeHeader) {
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

          const fixedHeader = Array.from(servicesSection.querySelectorAll('h3')).find(h => h.textContent && /fixed monthly bills/i.test(h.textContent));
          if (fixedHeader) {
            const fixedContainer = fixedHeader.parentElement.querySelector('.sc-1pyjdju-6.gfoyyD') || fixedHeader.parentElement;
            if (fixedContainer) {
              const rows = fixedContainer.querySelectorAll('.sc-1x0yjfx-0.pcwpP');
              rows.forEach((row) => {
                const spans = row.querySelectorAll('span');
                if (spans && spans.length >= 2) {
                  const label = spans[0].textContent ? spans[0].textContent.trim() : '';
                  let status = spans[1].textContent ? spans[1].textContent.trim() : '';
                  if (!status && spans[1].querySelector) {
                    status = spans[1].querySelector('span') ? spans[1].querySelector('span').textContent.trim() : '';
                  }
                  const included = /included/i.test(status) && !/not included/i.test(status);
                  if (label) result.included_monthly_bills[label] = included;
                }
              });
            }
          }

          const otherHeader = Array.from(servicesSection.querySelectorAll('h3')).find(h => h.textContent && /other fees/i.test(h.textContent));
          if (otherHeader) {
            const otherContainer = otherHeader.parentElement;
            const feeCards = otherContainer.querySelectorAll('.sc-1pyjdju-1.fQIAbo');
            feeCards.forEach((card) => {
              const h4 = card.querySelector('h4');
              const label = h4 && h4.textContent ? h4.textContent.trim() : '';
              const rawValNode = card.querySelector('.sc-1pyjdju-5.cYYEDG');
              const raw = rawValNode && rawValNode.textContent ? rawValNode.textContent.trim() : '';
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

      const rentalMap = {};
      const condNodes = document.querySelectorAll('#rental-conditions .sc-7pe2f2-0.hfOJyV');
      if (condNodes && condNodes.length) {
        condNodes.forEach((node) => {
          const raw = (node.textContent || '').trim();
          if (!raw) return;
          const allowed = !node.classList.contains('text-strike-through');
          if (/minimum stay/i.test(raw)) {
            rentalMap['Minimum stay'] = allowed;
            const m = raw.match(/minimum stay\s*(.*)/i);
            rentalMap['Minimum stay value'] = m && m[1] ? m[1].trim() : '';
            return;
          }
          if (/extra per tenant/i.test(raw)) {
            rentalMap['Extra per tenant'] = allowed;
            const m = raw.match(/€\s*([0-9]+(?:[.,][0-9]+)?)/);
            if (m && m[1]) {
              const num = parseFloat(m[1].replace(',', '.'));
              rentalMap['Extra per tenant value'] = isFinite(num) ? num : m[1];
            } else {
              rentalMap['Extra per tenant value'] = '';
            }
            return;
          }
          rentalMap[raw] = allowed;
        });
      }
      result.rental_conditions = rentalMap;
      return result;
    }

    // expose copy action
    window.elh_copyAction = async function () {
      const data = findRoomData();
      const txt = JSON.stringify(data, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(txt);
      else {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    };
  } catch (err) {
    console.error('parser_uniplaces.data error', err);
  }
})();
