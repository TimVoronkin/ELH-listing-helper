// openTabs_ListingsPage.js


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

  console.log('[ELH-helper] [openTabs_ListingsPage] Shared styles loaded');
}

/**
 * Extract room URL from the listing row's context menu
 * Returns the Edit URL which contains the room ID
 * 
 * Strategy: Click the menu button and wait for popup to appear in DOM
 */
async function getRoomUrlFromMenu(menuButton) {
  return new Promise((resolve) => {
      console.log('[ELH-helper] [openTabs_ListingsPage] Starting getRoomUrlFromMenu');
      console.log('[ELH-helper] [openTabs_ListingsPage] Menu button element:', menuButton);
      console.log('[ELH-helper] [openTabs_ListingsPage] Menu button aria-expanded before:', menuButton.getAttribute('aria-expanded'));

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
        console.log('[ELH-helper] [openTabs_ListingsPage] Menu element captured:', menuContent);
        const links = menuContent.querySelectorAll('a[role="menuitem"]');
        console.log('[ELH-helper] [openTabs_ListingsPage] Found', links.length, 'menu links');
        links.forEach((link, idx) => {
          console.log(`[ELH-helper] [openTabs_ListingsPage] Link ${idx}:`, link.textContent, '->', link.getAttribute('href'));
        });
        if (links.length >= 2) {
          const roomUrl = links[1].getAttribute('href');
          console.log('[ELH-helper] [openTabs_ListingsPage] Extracted Edit URL:', roomUrl);
          // cleanup
          if (popupObserver) { popupObserver.disconnect(); popupObserver = null; }
          // close menu: perform the SECOND synthetic click sequence using the
          // same baseEvOpts/coordinates as the OPEN sequence. We dispatch
          // pointerup/mouseup/click on the menuButton so that the close
          // behaves like a user click at the same spot.
          try {
            console.log('[ELH-helper] [openTabs_ListingsPage] Closing menu with Escape key');
            
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
            console.warn('[ELH-helper] [openTabs_ListingsPage] Error while closing menu with Escape key', e);
          }
          resolved = true;
          setTimeout(() => resolve(roomUrl), 120);
          return true;
        }
      } catch (e) {
        console.error('[ELH-helper] [openTabs_ListingsPage] error processing menu content', e);
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
    console.log('[ELH-helper] [openTabs_ListingsPage] Popup watcher setup complete');

    // Try synthetic pointer/mouse events sequence (some libs listen to pointerdown/mousedown)
    try {
      console.log('[ELH-helper] [openTabs_ListingsPage] menuButton rect', rect);

      // dispatch sequence (this is the FIRST synthetic click sequence — used to OPEN the menu)
      menuButton.dispatchEvent(createEv('pointerover'));
      menuButton.dispatchEvent(createEv('pointerenter'));
      menuButton.dispatchEvent(createEv('mouseover'));
      menuButton.dispatchEvent(createEv('mousemove'));
      menuButton.dispatchEvent(createEv('pointerdown'));
      menuButton.dispatchEvent(createEv('mousedown'));

      // Log the exact options we will use for the final click/up events (these are the "args")
      console.log('[ELH-helper] [openTabs_ListingsPage] Synthetic event args (baseEvOpts):', baseEvOpts);

      // small delay then up+click (finalize the synthetic click that opens the popup)
      setTimeout(() => {
        menuButton.dispatchEvent(createEv('pointerup'));
        menuButton.dispatchEvent(createEv('mouseup'));
        menuButton.dispatchEvent(createEv('click'));
        console.log('[ELH-helper] [openTabs_ListingsPage] Dispatched synthetic mouse events to menuButton (open sequence)');
      }, 20);
    } catch (e) {
      console.error('[ELH-helper] [openTabs_ListingsPage] Error dispatching synthetic events', e);
    }

    // Final timeout: stop waiting after 2s
    setTimeout(() => {
      if (!resolved) {
          console.warn('[ELH-helper] [openTabs_ListingsPage] Timeout waiting for popup menu');
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
  console.log('[ELH-helper] [openTabs_ListingsPage] Processing row:', rowTitle);

  // Find the menu button in the same row
  const menuButton = row.querySelector('button[aria-haspopup="menu"]');
  if (!menuButton) {
    console.error('[ELH-helper] [openTabs_ListingsPage] Menu button not found in row:', rowTitle);
    return;
  }

  console.log('[ELH-helper] [openTabs_ListingsPage] Found menu button:', menuButton.id);

  // Get the room URL from the menu
  const roomUrl = await getRoomUrlFromMenu(menuButton);
  if (!roomUrl) {
    console.error('[ELH-helper] [openTabs_ListingsPage] Could not extract room URL from menu');
    return;
  }

  console.log('[ELH-helper] [openTabs_ListingsPage] Got room URL:', roomUrl);

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
    console.warn('[ELH-helper] [openTabs_ListingsPage] Failed to normalize URL, using original', e);
    normalizedUrl = roomUrl;
  }
  console.log('[ELH-helper] [openTabs_ListingsPage] Normalized room URL:', normalizedUrl);

  // Get settings and open the tab
  return new Promise((resolve) => {
    chrome.storage.local.get(['openListingRoomsInBG', 'openInSameTabGroup'], (items) => {
      const useBackground = items?.openListingRoomsInBG === true;
      const useGroup = items?.openInSameTabGroup === true;

      console.log('[ELH-helper] [openTabs_ListingsPage] Settings - useBackground:', useBackground, 'useGroup:', useGroup);

      const urls = [normalizedUrl];

      if (useBackground) {
        console.log('[ELH-helper] [openTabs_ListingsPage] Opening in background via message');
        // Send message to background script to open in background
        chrome.runtime.sendMessage(
          { action: 'openTabsInBackground', urls: urls, useGroup: useGroup },
          (response) => {
            console.log('[ELH-helper] [openTabs_ListingsPage] Background response:', response);
            if (response?.success && btnToUpdate) {
              updateButtonState(btnToUpdate, 'opened');
            }
            resolve();
          }
        );
      } else {
        console.log('[ELH-helper] [openTabs_ListingsPage] Opening directly');
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
    console.log('[ELH-helper] [openTabs_ListingsPage] Row has no cells, skipping');
    return;
  }

  const actionCell = cells[cells.length - 1];
  
  // Check if button already exists
  if (actionCell.querySelector('.elh-open-tabs-btn')) {
    console.log('[ELH-helper] [openTabs_ListingsPage] Button already exists in this row, skipping');
    return;
  }

  const rowTitle = row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'unknown';
  console.log('[ELH-helper] [openTabs_ListingsPage] Inserting button for row:', rowTitle);

  // Create the button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'elh-btn elh-uniplaces-btn inline elh-open-tabs-btn';
  btn.title = 'Open listing room in new tab';
  btn.innerHTML = '<span>open tab</span>';

  // Add click handler with proper event handling to prevent row selection
  btn.addEventListener('click', async (e) => {
    console.log('[ELH-helper] [openTabs_ListingsPage] Button clicked for row:', rowTitle);
    
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
    console.log('[ELH-helper] [openTabs_ListingsPage] Button inserted AFTER menu button');
  } else {
    actionCell.appendChild(btn);
    console.log('[ELH-helper] [openTabs_ListingsPage] Button appended to action cell');
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
  console.log('[ELH-helper] [openTabs_ListingsPage] openTabsDirectly called with', urls.length, 'urls');
  urls.forEach((url, idx) => {
    console.log(`[ELH-helper] [openTabs_ListingsPage] Opening URL ${idx}:`, url);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  console.log('[ELH-helper] [openTabs_ListingsPage] openTabsDirectly completed');
}

/**
 * Process all visible table rows
 */
function insertOpenTabsButtons() {
  const rows = document.querySelectorAll('tbody tr');
  rows.forEach(row => {
    insertOpenTabsButton(row);
  });
  console.log(`[ELH-helper] [openTabs_ListingsPage] Processed ${rows.length} rows`);
}

/**
 * Handle Bulk Open Button Logic
 */
function updateBulkButtonState() {
  if (!__elh_bulk_btn) return;
  
  const selectedCheckboxes = document.querySelectorAll('tbody tr td:first-child button[role="checkbox"][data-state="checked"]');
  const count = selectedCheckboxes.length;
  
  console.log('[ELH-helper] [openTabs_ListingsPage] Selected count:', count);
  
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
  console.log('[ELH-helper] [openTabs_ListingsPage] Bulk open clicked for', selectedCheckboxes.length, 'items');
  
  for (const checkbox of selectedCheckboxes) {
    // Find the row
    const row = checkbox.closest('tr');
    if (row) {
      // Find our button in this row to update its state visually
      const rowBtn = row.querySelector('.elh-open-tabs-btn');
      await processRowForOpenTab(row, rowBtn);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function handleSelectAll() {
  const allCheckboxes = document.querySelectorAll('tbody tr td:first-child button[role="checkbox"]');
  console.log('[ELH-helper] [openTabs_ListingsPage] Select All clicked, found', allCheckboxes.length, 'checkboxes');
  
  let clickedCount = 0;
  for (const cb of allCheckboxes) {
    if (cb.getAttribute('data-state') !== 'checked') {
      cb.click();
      clickedCount++;
      // Small delay to prevent race conditions in app state updates
      await new Promise(r => setTimeout(r, 20));
    }
  }
  console.log('[ELH-helper] [openTabs_ListingsPage] Clicked', clickedCount, 'checkboxes to select them');
}

function insertBulkOpenButton() {
  if (__elh_bulk_btn && document.contains(__elh_bulk_btn)) return;

  // Find the container with Reject/Approve buttons
  // Use the specific class provided by the user
  const container = document.querySelector('div.flex.justify-end.items-center.mb-4.gap-4');
  
  if (container) {
      console.log('[ELH-helper] [openTabs_ListingsPage] Found container for bulk button');
      
      __elh_bulk_btn = document.createElement('button');
      __elh_bulk_btn.type = 'button';
      __elh_bulk_btn.className = 'elh-btn elh-uniplaces-btn inline';
      __elh_bulk_btn.style.marginRight = '0px'; 
      __elh_bulk_btn.style.marginLeft = '0px';
      __elh_bulk_btn.innerHTML = '<span>no rooms selected</span>';
      __elh_bulk_btn.addEventListener('click', handleBulkOpen);
      
      // Create Select All Button
      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'elh-btn elh-uniplaces-btn inline';
      selectAllBtn.style.marginRight = 'auto'; // Push subsequent buttons to the right
      selectAllBtn.style.marginLeft = '10px';
      selectAllBtn.style.backgroundColor = '#e2e8f0';
      selectAllBtn.style.color = '#1e293b';
      selectAllBtn.innerHTML = '<span>select all</span>';
      selectAllBtn.addEventListener('click', handleSelectAll);

      // Insert Bulk Open first
      container.insertBefore(__elh_bulk_btn, container.firstChild);
      
      // Insert Select All after Bulk Open
      container.insertBefore(selectAllBtn, __elh_bulk_btn.nextSibling);
      
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
      
      console.log('[ELH-helper] [openTabs_ListingsPage] Bulk buttons inserted');
    } else {
    console.warn('[ELH-helper] [openTabs_ListingsPage] Could not find container to place bulk button');
  }
}

function setupObserver() {
  if (__elh_observer) {
    __elh_observer.disconnect();
  }

  const tbody = document.querySelector('tbody');
  if (!tbody) {
    console.error('[ELH-helper] [openTabs_ListingsPage] tbody not found for observer');
    return;
  }

  __elh_observer = new MutationObserver((mutations) => {
    let hasNewRows = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        console.log('[ELH-helper] [openTabs_ListingsPage] MutationObserver detected new nodes');
        hasNewRows = true;
      }
    });

    if (hasNewRows) {
      console.log('[ELH-helper] [openTabs_ListingsPage] Processing new rows detected by observer');
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

  console.log('[ELH-helper] [openTabs_ListingsPage] Observer setup complete');
}

/**
 * Initialize the script
 */
function init() {
  console.log('[ELH-helper] [openTabs_ListingsPage] Script initialized');
  
  loadSharedStylesOnce();
  
  // Wait for table to be rendered
  const checkTable = setInterval(() => {
    const tbody = document.querySelector('tbody');
    if (tbody) {
      clearInterval(checkTable);
      console.log('[ELH-helper] [openTabs_ListingsPage] Table found, starting to process rows');
      insertOpenTabsButtons();
      insertBulkOpenButton();
      setupObserver();
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => {
    clearInterval(checkTable);
    console.warn('[ELH-helper] [openTabs_ListingsPage] Timeout waiting for table');
  }, 5000);
}

// Start the script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
