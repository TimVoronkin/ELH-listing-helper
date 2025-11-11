// openTabsOfListing.js
// Adds an "open tabs" button to each HouseListingCard and opens two sites in new tabs when clicked
console.log('[ELH-Tim] openTabs script loaded');

// Diagnostic flags
let __elh_openTabs_debug = true;
let __elh_openTabs_lastObserverLog = 0;

function loadSharedStylesOnce() {
  try {
    const ID = 'elh-shared-styles';
    if (document.getElementById(ID)) return;
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/shared/buttons.css');
    if (document.head) {
      document.head.appendChild(link);
      if (__elh_openTabs_debug) console.log('[ELH-Tim] injected shared styles:', link.href);
    } else {
      // fallback if head not present yet
      document.documentElement && document.documentElement.appendChild(link);
      if (__elh_openTabs_debug) console.log('[ELH-Tim] injected shared styles into documentElement:', link.href);
    }
  } catch (e) {
    console.warn('[ELH-Tim] Failed to inject shared styles', e);
  }
}
loadSharedStylesOnce();

function insertOpenTabsButtons() {
  try {
    const cards = Array.from(document.querySelectorAll('div[data-sentry-component="HouseListingCard"]'));
    if (!cards || cards.length === 0) {
      if (__elh_openTabs_debug) console.log('[ELH-Tim] no HouseListingCard elements found');
      return;
    }
    if (__elh_openTabs_debug) console.log('[ELH-Tim] found HouseListingCard count =', cards.length);

    // helper: determine room URLs for a given card (kept local to avoid global pollution)
    function getRoomUrlsForCard(card) {
      const urlsSet = new Set();
      let discoveredListingId = null;

      try {
        const anchors = Array.from(card.querySelectorAll('a[href*="/rooms/form/"]'));
        anchors.forEach((a) => {
          try {
            const rawHref = a.getAttribute('href') || a.href || '';
            const absolute = rawHref.startsWith('http') ? rawHref : new URL(rawHref, location.origin).href;
            const fullMatch = absolute.match(/\/dashboard\/admin\/listings\/([^\/]+)\/rooms\/form\/([^\/\?#]+)/i);
            if (fullMatch) {
              discoveredListingId = discoveredListingId || fullMatch[1];
              urlsSet.add(absolute.split('?')[0]);
              return;
            }
            const shortMatch = absolute.match(/\/rooms\/form\/([^\/\?#]+)/i);
            if (shortMatch) {
              urlsSet.add(absolute.split('?')[0]);
              return;
            }
          } catch (errA) {
            if (__elh_openTabs_debug) console.warn('[ELH-Tim] error processing anchor href', errA, a);
          }
        });

        // fallback: if anchors not present, try to parse room IDs from text spans
        // but first: if the card explicitly shows "0 rooms" (a badge), bail out
        let roomIds = [];
        if (urlsSet.size === 0) {
          try {
            const zeroRoomsEl = Array.from(card.querySelectorAll('span,div,button'))
              .find(el => {
                const t = (el.textContent || '').trim().toLowerCase();
                return /^0\s+rooms$/.test(t) || t === '0 rooms';
              });
            if (zeroRoomsEl) {
              if (__elh_openTabs_debug) console.log('[ELH-Tim] card shows 0 rooms badge; skipping room URL parsing');
              return [];
            }

            const spans = Array.from(card.querySelectorAll('span'));
            spans.forEach(s => {
              const txt = (s.textContent || '').trim();
              const m = txt.match(/\bID:\s*#([A-Za-z0-9_-]+)/);
              if (m) roomIds.push(m[1]);
            });
            if (__elh_openTabs_debug) console.log('[ELH-Tim] parsed roomIds from text spans', roomIds);
          } catch (errS) {
            if (__elh_openTabs_debug) console.warn('[ELH-Tim] error parsing ID spans', errS);
          }
        }

        if (roomIds.length > 0 && !discoveredListingId) {
          try {
            const listingAnchor = card.querySelector('a[href*="/dashboard/admin/listings/"]');
            if (listingAnchor) {
              const href = listingAnchor.getAttribute('href') || listingAnchor.href || '';
              const m = href.match(/\/dashboard\/admin\/listings\/([^\/\?#]+)/i);
              if (m) discoveredListingId = m[1];
              if (__elh_openTabs_debug) console.log('[ELH-Tim] discovered listingId from listingAnchor', discoveredListingId);
            }
          } catch (errL) {
            if (__elh_openTabs_debug) console.warn('[ELH-Tim] error finding listing anchor', errL);
          }
        }

        if (roomIds.length > 0) {
          const base = 'https://www.erasmuslifehousing.com';
          if (discoveredListingId) {
            roomIds.forEach(rid => urlsSet.add(`${base}/dashboard/admin/listings/${discoveredListingId}/rooms/form/${rid}`));
          } else {
            if (__elh_openTabs_debug) console.warn('[ELH-Tim] no listingId found; cannot construct full room URLs from IDs');
          }
        }
      } catch (e) {
        if (__elh_openTabs_debug) console.error('[ELH-Tim] getRoomUrlsForCard error', e);
      }

      return Array.from(urlsSet);
    }

    // helper: set button label and disabled state based on count
    function updateButtonState(btn, count) {
      if (!btn) return;
      if (count === 0) {
        btn.textContent = 'no rooms here';
        btn.disabled = true;
        btn.classList && btn.classList.add('elh-disabled');
        btn.setAttribute('aria-disabled', 'true');
      } else if (count === 1) {
        btn.textContent = 'open 1 tab';
        btn.disabled = false;
        btn.classList && btn.classList.remove('elh-disabled');
        btn.removeAttribute('aria-disabled');
      } else {
        btn.textContent = `open ${count} tabs`;
        btn.disabled = false;
        btn.classList && btn.classList.remove('elh-disabled');
        btn.removeAttribute('aria-disabled');
      }
    }

    cards.forEach((card) => {
      if (!card) return;
      // avoid duplicate button; if it exists, update its label/state
      const existingBtn = card.querySelector('.elh-open-tabs-btn');
      if (existingBtn) {
        try {
          const urls = getRoomUrlsForCard(card);
          const count = urls.length;
          // determine desired label and disabled state without mutating DOM
          let desiredText;
          let desiredDisabled;
          if (count === 0) {
            desiredText = 'no rooms here';
            desiredDisabled = true;
          } else if (count === 1) {
            desiredText = 'open 1 tab';
            desiredDisabled = false;
          } else {
            desiredText = `open ${count} tabs`;
            desiredDisabled = false;
          }

          // only update DOM if something actually changed to avoid triggering observer again
          const textChanged = existingBtn.textContent !== desiredText;
          const disabledChanged = existingBtn.disabled !== desiredDisabled;
          if (textChanged || disabledChanged) {
            updateButtonState(existingBtn, count);
            if (__elh_openTabs_debug) console.log('[ELH-Tim] updated existing open-tabs button for card, count =', count);
          }
        } catch (e) {
          if (__elh_openTabs_debug) console.warn('[ELH-Tim] failed to update existing button', e);
        }
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'elh-btn elh-uniplaces-btn inline elh-open-tabs-btn';
      // set initial text/state based on current DOM
      try {
        const urls = getRoomUrlsForCard(card);
        updateButtonState(btn, urls.length);
      } catch (e) {
        // fallback label
        btn.textContent = 'open tabs';
        if (__elh_openTabs_debug) console.warn('[ELH-Tim] failed to set initial button label', e);
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (__elh_openTabs_debug) console.log('[ELH-Tim] open-tabs button clicked for card', card);
        try {
          const urls = getRoomUrlsForCard(card);
          if (__elh_openTabs_debug) console.log('[ELH-Tim] room URLs to open:', urls);
          if (!urls || urls.length === 0) {
            if (__elh_openTabs_debug) console.log('[ELH-Tim] no room URLs found for this card');
            // update button state to reflect current situation
            updateButtonState(btn, 0);
            return;
          }
          
          // check if background tab opening is enabled and whether to open in same tab group
          chrome.storage.local.get(['openListingRoomsInBG', 'openInSameTabGroup'], (items) => {
            const useBackground = items && items.openListingRoomsInBG === true;
            const useSameGroup = items && items.openInSameTabGroup === true;

            if (useBackground) {
              // use background tab opening via service worker and optionally keep in same group
              if (__elh_openTabs_debug) console.log('[ELH-Tim] using background tab opening (useSameGroup=' + useSameGroup + ')');
              chrome.runtime.sendMessage(
                { action: 'openTabsInBackground', urls: urls, useGroup: useSameGroup },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.warn('[ELH-Tim] sendMessage error:', chrome.runtime.lastError);
                    // fallback to direct opening on error
                    openTabsDirectly(urls);
                  } else if (response && response.success) {
                    if (__elh_openTabs_debug) console.log('[ELH-Tim] background tabs opened:', response.count);
                  }
                }
              );
            } else {
              // use direct anchor/window.open approach
              if (__elh_openTabs_debug) console.log('[ELH-Tim] using direct tab opening');
              openTabsDirectly(urls);
            }
          });
          
          // after opening, update button (in case links changed)
          updateButtonState(btn, urls.length);
        } catch (err) {
          console.error('[ELH-Tim] open-tabs click handler error', err);
        }
      });
      
      // helper: open tabs directly via anchor or window.open
      function openTabsDirectly(urls) {
        urls.forEach(u => {
          try {
            const a = document.createElement('a');
            a.href = u;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            // keep the anchor out of layout
            a.style.display = 'none';
            document.body.appendChild(a);
            // create a trusted MouseEvent if possible
            const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
            a.dispatchEvent(ev);
            // cleanup
            setTimeout(() => a.remove(), 0);
            if (__elh_openTabs_debug) console.log('[ELH-Tim] opened (anchor click) ', u);
          } catch (errOpen) {
            // fallback to window.open if anchor approach fails
            try {
              window.open(u, '_blank', 'noopener');
              if (__elh_openTabs_debug) console.log('[ELH-Tim] opened (fallback) ', u);
            } catch (err2) {
              console.warn('[ELH-Tim] Failed to open', u, errOpen, err2);
            }
          }
        });
      }

      // Prefer placing button inside an existing controls area. If none found, create
      // an `.elh-open-tabs-controls` container (styled like other control groups) and
      // insert it into a sensible place inside the card.
      try {
        // prefer explicit control containers if present
        const existingControls = card.querySelector('.elh-gemini-controls, .controls, .card-actions, .actions, footer, .footer');
        if (existingControls) {
          // if there's already a generic controls wrapper, append the button there
          existingControls.appendChild(btn);
          if (__elh_openTabs_debug) console.log('[ELH-Tim] appended button into existing controls', existingControls);
        } else {
          // Find a sensible existing element to receive the button directly (no wrapper):
          // 1) the parent element that contains an "ID: #..." span
          // 2) common flex containers used in cards
          // 3) fallback to appending directly to the card
          let target = null;

          try {
            // 1) find a span that includes 'ID:' text
            const spans = Array.from(card.querySelectorAll('span'));
            const idSpan = spans.find(s => s.textContent && /\bID:\s*#/.test(s.textContent.trim()));
            if (idSpan && idSpan.parentElement) {
              // prefer the parent which in the sample contains other controls
              target = idSpan.parentElement;
              if (__elh_openTabs_debug) console.log('[ELH-Tim] chose target by ID span parent', target);
            }
          } catch (e) {
            if (__elh_openTabs_debug) console.warn('[ELH-Tim] error searching for ID span', e);
          }

          // 2) if no ID-based target, try common selectors
          if (!target) {
            const preferredSelectors = [
              '.flex.items-center.gap-2',
              '.flex.flex-row.items-center.gap-2',
              '.flex.items-center.justify-between',
              '.flex.flex-row.items-center',
              '.flex.items-center',
            ];
            for (const sel of preferredSelectors) {
              const found = card.querySelector(sel);
              if (found) {
                target = found;
                if (__elh_openTabs_debug) console.log('[ELH-Tim] chose target by selector', sel, found);
                break;
              }
            }
          }

          // 3) fallback to card itself
          if (!target) {
            target = card;
            if (__elh_openTabs_debug) console.log('[ELH-Tim] no preferred target found, using card as fallback');
          }

          try {
            target.appendChild(btn);
            if (__elh_openTabs_debug) console.log('[ELH-Tim] appended btn directly into target', target);
          } catch (errAppend) {
            // final fallback: append to card root
            try {
              card.appendChild(btn);
              if (__elh_openTabs_debug) console.log('[ELH-Tim] final fallback appended btn to card', card);
            } catch (e) {
              console.warn('[ELH-Tim] failed to append btn to any target', e);
            }
          }
        }
      } catch (err) {
        // fallback: attach directly to the card
        try {
          card.appendChild(btn);
          if (__elh_openTabs_debug) console.log('[ELH-Tim] fallback appended btn directly to card', card);
        } catch (e) {
          console.warn('[ELH-Tim] fallback failed to append btn to card', e);
        }
      }
    });
  } catch (e) {
    console.error('[ELH-Tim] insertOpenTabsButtons error', e);
  }
}

// Initial run + observe DOM changes
insertOpenTabsButtons();
// Guard the observer on the window to avoid redeclaration if the content script
// loads more than once on the same page.
if (!window.__elh_openTabs_observer) {
  window.__elh_openTabs_observer = new MutationObserver(() => {
    // throttle observer logs to reduce spam
    const now = Date.now();
    if (__elh_openTabs_debug && now - __elh_openTabs_lastObserverLog > 2000) {
      console.log('[ELH-Tim] MutationObserver triggered - re-running insertOpenTabsButtons');
      __elh_openTabs_lastObserverLog = now;
    }
    insertOpenTabsButtons();
  });
  try {
    window.__elh_openTabs_observer.observe(document.body, { childList: true, subtree: true });
    if (__elh_openTabs_debug) console.log('[ELH-Tim] started MutationObserver for openTabs');
  } catch (e) {
    console.warn('[ELH-Tim] Failed to start MutationObserver for openTabs', e);
  }
} else {
  if (__elh_openTabs_debug) console.log('[ELH-Tim] reusing existing openTabs observer');
}
