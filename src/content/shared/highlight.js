// Centralized highlight helper for content scripts
(function () {
  try {
    window.ELH = window.ELH || {};
    // idempotent: don't overwrite if already present
    if (typeof window.ELH.highlightElement === 'function') return;

    window.ELH.highlightElement = function (el, color = 'green') {
      try {
        if (!el || !el.style) return;
        // Save original inline styles so we can restore later if needed
        try {
          if (!el.dataset.elhPrevBorder) el.dataset.elhPrevBorder = el.style.border || '';
          if (!el.dataset.elhPrevBoxShadow) el.dataset.elhPrevBoxShadow = el.style.boxShadow || '';
          if (!el.dataset.elhPrevOutline) el.dataset.elhPrevOutline = el.style.outline || '';
        } catch (e) {}

        if (color === 'orange') {
          el.style.border = '2px solid #ff8c00';
          el.style.boxShadow = '0 0 0 4px rgba(255,140,0,0.12)';
        } else {
          el.style.border = '2px solid #28a745';
          el.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)';
        }
        el.style.outline = 'none';
      } catch (e) {
        // swallow errors to avoid breaking page
      }
    };

    // Optional: restore previously saved styles
    window.ELH.clearHighlight = function (el) {
      try {
        if (!el || !el.style) return;
        if (el.dataset.elhPrevBorder !== undefined) el.style.border = el.dataset.elhPrevBorder;
        if (el.dataset.elhPrevBoxShadow !== undefined) el.style.boxShadow = el.dataset.elhPrevBoxShadow;
        if (el.dataset.elhPrevOutline !== undefined) el.style.outline = el.dataset.elhPrevOutline;
        // cleanup dataset keys
        try { delete el.dataset.elhPrevBorder; delete el.dataset.elhPrevBoxShadow; delete el.dataset.elhPrevOutline; } catch (e) {}
      } catch (e) {}
    };
  } catch (e) {}
})();
