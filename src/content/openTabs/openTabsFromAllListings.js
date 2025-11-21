/**
 * Opens listing rooms in new tabs from the admin listings page
 * URL: https://www.erasmuslifehousing.com/dashboard/admin/listings
 * 
 * Adds "open tab" buttons to each table row, allowing users to open
 * room edit pages in new tabs or the same tab group
 */

let __elh_observer = null;
let __elh_styles_loaded = false;
let __elh_bulk_btn = null;

/**
 * Load shared CSS styles for buttons once
 */
function loadSharedStylesOnce() {
  if (__elh_styles_loaded) return;
  __elh_styles_loaded = true;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/shared/buttons.css');
  document.head.appendChild(link);

  console.log('[ELH-helper] openTabsFromAllListings: Shared styles loaded');
}

/**
 * Extract room URL from the listing row's context menu
 * Returns the Edit URL which contains the room ID
 * 
 * Strategy: Click the menu button and wait for popup to appear in DOM
 */
async function getRoomUrlFromMenu(menuButton) {
  return new Promise((resolve) => {
      console.log('[ELH-helper] Starting getRoomUrlFromMenu');
      console.log('[ELH-helper] Menu button element:', menuButton);
      console.log('[ELH-helper] Menu button aria-expanded before:', menuButton.getAttribute('aria-expanded'));

    // Setup MutationObserver to catch popup added to body
    let popupObserver = null;
    let resolved = false;

    // Compute bounding rect and base event options early so both open/close
    // synthetic sequences use the same coordinates/arguments.
    let rect = { left: 0, top: 0, width: 0, height: 0 };
    try { rect = menuButton.getBoundingClientRect(); } catch (e) { /* ignore */ }

    const baseEvOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + (rect.width || 0) / 2,
      clientY: rect.top + (rect.height || 0) / 2
    };

    const createEv = (type, opts = {}) => new MouseEvent(type, Object.assign({}, baseEvOpts, opts));

    const handleFoundMenu = (menuContent) => {
      try {
        console.log('[ELH-helper] Menu element captured:', menuContent);
        const links = menuContent.querySelectorAll('a[role="menuitem"]');
        console.log('[ELH-helper] Found', links.length, 'menu links');
        links.forEach((link, idx) => {
          console.log(`[ELH-helper] Link ${idx}:`, link.textContent, '->', link.getAttribute('href'));
        });
        if (links.length >= 2) {
          const roomUrl = links[1].getAttribute('href');
          console.log('[ELH-helper] Extracted Edit URL:', roomUrl);
          // cleanup
          if (popupObserver) { popupObserver.disconnect(); popupObserver = null; }
          // close menu: perform the SECOND synthetic click sequence using the
          // same baseEvOpts/coordinates as the OPEN sequence. We dispatch
          // pointerup/mouseup/click on the menuButton so that the close
          // behaves like a user click at the same spot.
          try {
            console.log('[ELH-helper] Closing menu with Escape key');
            
            const escapeEvent = new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true,
              view: window
            });
            
            // Dispatch on the menu button first, then body if needed
            menuButton.dispatchEvent(escapeEvent);
            document.body.dispatchEvent(escapeEvent);
            
          } catch (e) {
            console.warn('[ELH-helper] Error while closing menu with Escape key', e);
          }
          resolved = true;
          setTimeout(() => resolve(roomUrl), 120);
          return true;
        }
      } catch (e) {
        console.error('[ELH-helper] error processing menu content', e);
      }
      return false;
    };

    popupObserver = new MutationObserver((mutations) => {
      // Check for any menu element in the document
      for (const m of document.querySelectorAll('[role="menu"]')) {
        const state = m.getAttribute('data-state');
        const aria = m.getAttribute('aria-expanded');
        if (state === 'open' || aria === 'true' || m.parentElement?.hasAttribute('data-radix-popper-content-wrapper')) {
          if (handleFoundMenu(m)) return;
        }
      }
      // also check for popper wrapper added
      for (const wrapper of document.querySelectorAll('[data-radix-popper-content-wrapper], [data-radix-menu-content]')) {
        const menu = wrapper.querySelector('[role="menu"]');
        if (menu) {
          if (handleFoundMenu(menu)) return;
        }
      }
    });

    popupObserver.observe(document.body, { childList: true, subtree: true });
    console.log('[ELH-helper] Popup watcher setup complete');

    // Try synthetic pointer/mouse events sequence (some libs listen to pointerdown/mousedown)
    try {
      console.log('[ELH-helper] menuButton rect', rect);

      // dispatch sequence (this is the FIRST synthetic click sequence — used to OPEN the menu)
      menuButton.dispatchEvent(createEv('pointerover'));
      menuButton.dispatchEvent(createEv('pointerenter'));
      menuButton.dispatchEvent(createEv('mouseover'));
      menuButton.dispatchEvent(createEv('mousemove'));
      menuButton.dispatchEvent(createEv('pointerdown'));
      menuButton.dispatchEvent(createEv('mousedown'));

      // Log the exact options we will use for the final click/up events (these are the "args")
      console.log('[ELH-helper] Synthetic event args (baseEvOpts):', baseEvOpts);

      // small delay then up+click (finalize the synthetic click that opens the popup)
      setTimeout(() => {
        menuButton.dispatchEvent(createEv('pointerup'));
        menuButton.dispatchEvent(createEv('mouseup'));
        menuButton.dispatchEvent(createEv('click'));
        console.log('[ELH-helper] Dispatched synthetic mouse events to menuButton (open sequence)');
      }, 20);
    } catch (e) {
      console.error('[ELH-helper] Error dispatching synthetic events', e);
    }

    // Final timeout: stop waiting after 2s
    setTimeout(() => {
      if (!resolved) {
          console.warn('[ELH-helper] Timeout waiting for popup menu');
          if (popupObserver) { popupObserver.disconnect(); popupObserver = null; }
          resolve(null);
        }
    }, 2000);
  });
}

/**
 * Core logic to process a single row and open its tab
 * Returns promise that resolves when done
 */
async function processRowForOpenTab(row, btnToUpdate = null) {
  const rowTitle = row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'unknown';
  console.log('[ELH-helper] openTabsFromAllListings: Processing row:', rowTitle);

  // Find the menu button in the same row
  const menuButton = row.querySelector('button[aria-haspopup="menu"]');
  if (!menuButton) {
    console.error('[ELH-helper] openTabsFromAllListings: Menu button not found in row:', rowTitle);
    return;
  }

  console.log('[ELH-helper] openTabsFromAllListings: Found menu button:', menuButton.id);

  // Get the room URL from the menu
  const roomUrl = await getRoomUrlFromMenu(menuButton);
  if (!roomUrl) {
    console.error('[ELH-helper] openTabsFromAllListings: Could not extract room URL from menu');
    return;
  }

  console.log('[ELH-helper] openTabsFromAllListings: Got room URL:', roomUrl);

  // Normalize roomUrl to absolute URL (background context needs full origin)
  let normalizedUrl = roomUrl;
  try {
    if (typeof roomUrl === 'string') {
      if (!/^https?:\/\//i.test(roomUrl)) {
        // relative path -> resolve against page origin
        if (roomUrl.startsWith('/')) {
          normalizedUrl = location.origin + roomUrl;
        } else {
          normalizedUrl = location.origin + '/' + roomUrl;
        }
      }
    }
  } catch (e) {
    console.warn('[ELH-helper] openTabsFromAllListings: Failed to normalize URL, using original', e);
    normalizedUrl = roomUrl;
  }
  console.log('[ELH-helper] openTabsFromAllListings: Normalized room URL:', normalizedUrl);

  // Get settings and open the tab
  return new Promise((resolve) => {
    chrome.storage.local.get(['openListingRoomsInBG', 'openInSameTabGroup'], (items) => {
      const useBackground = items?.openListingRoomsInBG === true;
      const useGroup = items?.openInSameTabGroup === true;

      console.log('[ELH-helper] openTabsFromAllListings: Settings - useBackground:', useBackground, 'useGroup:', useGroup);

      const urls = [normalizedUrl];

      if (useBackground) {
        console.log('[ELH-helper] openTabsFromAllListings: Opening in background via message');
        // Send message to background script to open in background
        chrome.runtime.sendMessage(
          { action: 'openTabsInBackground', urls: urls, useGroup: useGroup },
          (response) => {
            console.log('[ELH-helper] openTabsFromAllListings: Background response:', response);
            if (response?.success && btnToUpdate) {
              updateButtonState(btnToUpdate, 'opened');
            }
            resolve();
          }
        );
      } else {
        console.log('[ELH-helper] openTabsFromAllListings: Opening directly');
        // Open directly using fallback method
        openTabsDirectly(urls);
        if (btnToUpdate) {
          updateButtonState(btnToUpdate, 'opened');
        }
        resolve();
      }
    });
  });
}

/**
 * Create and insert "open tab" button into table row
 */
function insertOpenTabsButton(row) {
  // Get the Actions cell (last td)
  const cells = row.querySelectorAll('td');
  if (cells.length === 0) {
    console.log('[ELH-helper] openTabsFromAllListings: Row has no cells, skipping');
    return;
  }

  const actionCell = cells[cells.length - 1];
  
  // Check if button already exists
  if (actionCell.querySelector('.elh-open-tabs-btn')) {
    console.log('[ELH-helper] openTabsFromAllListings: Button already exists in this row, skipping');
    return;
  }

  const rowTitle = row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'unknown';
  console.log('[ELH-helper] openTabsFromAllListings: Inserting button for row:', rowTitle);

  // Create the button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'elh-btn elh-uniplaces-btn inline elh-open-tabs-btn';
  btn.title = 'Open listing room in new tab';
  btn.innerHTML = '<span>open tab</span>';

  // Add click handler with proper event handling to prevent row selection
  btn.addEventListener('click', async (e) => {
    console.log('[ELH-helper] openTabsFromAllListings: Button clicked for row:', rowTitle);
    
    // Prevent all event propagation to stop row/checkbox interaction
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    await processRowForOpenTab(row, btn);
  }, true);

  // Insert button AFTER the menu button in the cell, not before
  // This prevents the new button from blocking clicks on the menu button
  const menuButton = actionCell.querySelector('button[aria-haspopup="menu"]');
  if (menuButton) {
    // Insert the button right AFTER the menu button
    if (menuButton.nextSibling) {
      menuButton.parentNode.insertBefore(btn, menuButton.nextSibling);
    } else {
      menuButton.parentNode.appendChild(btn);
    }
    console.log('[ELH-helper] openTabsFromAllListings: Button inserted AFTER menu button');
  } else {
    actionCell.appendChild(btn);
    console.log('[ELH-helper] openTabsFromAllListings: Button appended to action cell');
  }
}

/**
 * Update button state/text
 */
function updateButtonState(btn, state) {
  if (state === 'opened') {
    btn.textContent = '✓ opened';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'open tab';
      btn.disabled = false;
    }, 2000);
  }
}

/**
 * Fallback method to open tab directly
 */
function openTabsDirectly(urls) {
  console.log('[ELH-helper] openTabsFromAllListings: openTabsDirectly called with', urls.length, 'urls');
  urls.forEach((url, idx) => {
    console.log(`[ELH-helper] openTabsFromAllListings: Opening URL ${idx}:`, url);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  console.log('[ELH-helper] openTabsFromAllListings: openTabsDirectly completed');
}

/**
 * Process all visible table rows
 */
function insertOpenTabsButtons() {
  const rows = document.querySelectorAll('tbody tr');
  rows.forEach(row => {
    insertOpenTabsButton(row);
  });
  console.log(`[ELH-helper] openTabsFromAllListings: Processed ${rows.length} rows`);
}

/**
 * Handle Bulk Open Button Logic
 */
function updateBulkButtonState() {
  if (!__elh_bulk_btn) return;
  
  const selectedCheckboxes = document.querySelectorAll('tbody tr td:first-child button[role="checkbox"][data-state="checked"]');
  const count = selectedCheckboxes.length;
  
  console.log('[ELH-helper] openTabsFromAllListings: Selected count:', count);
  
  if (count > 0) {
    __elh_bulk_btn.innerHTML = `<span>open ${count} selected in new tabs</span>`;
    __elh_bulk_btn.disabled = false;
    __elh_bulk_btn.style.opacity = '1';
    __elh_bulk_btn.style.cursor = 'pointer';
  } else {
    __elh_bulk_btn.innerHTML = `<span>no selected rooms</span>`;
    __elh_bulk_btn.disabled = true;
    __elh_bulk_btn.style.opacity = '0.5';
    __elh_bulk_btn.style.cursor = 'not-allowed';
  }
}

async function handleBulkOpen() {
  const selectedCheckboxes = document.querySelectorAll('tbody tr td:first-child button[role="checkbox"][data-state="checked"]');
  console.log('[ELH-helper] openTabsFromAllListings: Bulk open clicked for', selectedCheckboxes.length, 'items');
  
  for (const checkbox of selectedCheckboxes) {
    // Find the row
    const row = checkbox.closest('tr');
    if (row) {
      // Find our button in this row to update its state visually
      const rowBtn = row.querySelector('.elh-open-tabs-btn');
      await processRowForOpenTab(row, rowBtn);
      // Small delay between actions to be safe
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

function insertBulkOpenButton() {
  if (__elh_bulk_btn && document.contains(__elh_bulk_btn)) return;

  // Find the container with Reject/Approve buttons
  // Use the specific class provided by the user
  const container = document.querySelector('div.flex.justify-end.items-center.mb-4.gap-4');
  
  if (container) {
      console.log('[ELH-helper] openTabsFromAllListings: Found container for bulk button');
      
      __elh_bulk_btn = document.createElement('button');
      __elh_bulk_btn.type = 'button';
      __elh_bulk_btn.className = 'elh-btn elh-uniplaces-btn inline';
      __elh_bulk_btn.style.marginRight = 'auto'; // Push to the left if flex container allows, or just spacing
      __elh_bulk_btn.style.marginLeft = '0px'; // Reset margin
      __elh_bulk_btn.innerHTML = '<span>no rooms selected</span>';
      __elh_bulk_btn.addEventListener('click', handleBulkOpen);
      
      // Insert as FIRST child to be on the left
      container.insertBefore(__elh_bulk_btn, container.firstChild);
      
      // Initial state update
      updateBulkButtonState();
      
      // Add listener for checkbox changes (using delegation on body or table)
      document.addEventListener('click', (e) => {
        // Check if clicked element is a checkbox or inside one
        if (e.target.closest('button[role="checkbox"]')) {
          // Wait a tiny bit for the state to update in DOM
          setTimeout(updateBulkButtonState, 50);
        }
      });
      
      console.log('[ELH-helper] openTabsFromAllListings: Bulk button inserted at start of container');
    } else {
    console.warn('[ELH-helper] openTabsFromAllListings: Could not find container to place bulk button');
  }
}

/**
 * Setup MutationObserver to watch for new rows
 */
function setupObserver() {
  if (__elh_observer) {
    __elh_observer.disconnect();
  }

  const tbody = document.querySelector('tbody');
  if (!tbody) {
    console.error('[ELH-helper] openTabsFromAllListings: tbody not found for observer');
    return;
  }

  __elh_observer = new MutationObserver((mutations) => {
    let hasNewRows = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        console.log('[ELH-helper] openTabsFromAllListings: MutationObserver detected new nodes');
        hasNewRows = true;
      }
    });

    if (hasNewRows) {
      console.log('[ELH-helper] openTabsFromAllListings: Processing new rows detected by observer');
      insertOpenTabsButtons();
      // Also re-check bulk button placement if needed (though usually static)
      insertBulkOpenButton();
      updateBulkButtonState();
    }
  });

  __elh_observer.observe(tbody, {
    childList: true,
    subtree: true
  });

  console.log('[ELH-helper] openTabsFromAllListings: Observer setup complete');
}

/**
 * Initialize the script
 */
function init() {
  console.log('[ELH-helper] openTabsFromAllListings: Script initialized');
  
  loadSharedStylesOnce();
  
  // Wait for table to be rendered
  const checkTable = setInterval(() => {
    const tbody = document.querySelector('tbody');
    if (tbody) {
      clearInterval(checkTable);
      console.log('[ELH-helper] openTabsFromAllListings: Table found, starting to process rows');
      insertOpenTabsButtons();
      insertBulkOpenButton();
      setupObserver();
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => {
    clearInterval(checkTable);
    console.warn('[ELH-helper] openTabsFromAllListings: Timeout waiting for table');
  }, 5000);
}

// Start the script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
