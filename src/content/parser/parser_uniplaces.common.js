(function () {
  "use strict";
  try {
    // inject shared stylesheet if not present (parser already injects some inline styles as fallback)
    try {
      const ID = 'elh-shared-styles';
      if (!document.getElementById(ID)) {
        const link = document.createElement('link');
        link.id = ID;
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('src/shared/buttons.css');
        document.head && document.head.appendChild(link);
      }
    } catch (e) { console.warn('[ELH-helper] [parser_uniplaces.common] failed to inject shared styles', e); }
    // (inline fallback styles removed; using shared CSS from src/shared/buttons.css)

    // --- shared helpers ---
    function filenameFromUrl(url) {
      try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        let last = parts.pop() || "img.jpg";
        if (!/\.[a-zA-Z0-9]{2,6}$/.test(last)) last = last + ".jpg";
        last = last.replace(/[^a-zA-Z0-9._-]/g, "_");
        return `${Date.now()}-${last}`;
      } catch (e) {
        return `img-${Date.now()}.jpg`;
      }
    }

    function fallbackAnchorDownload(url, filename) {
      fetch(url, { mode: "cors" })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement("a");
          const objUrl = URL.createObjectURL(blob);
          a.href = objUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
        })
        .catch(() => {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
    }

    function requestBackgroundDownload(url, filename, cb) {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "download", url, filename }, (resp) => {
            if (!resp || resp.error)
              cb && cb(new Error(resp && resp.error ? resp.error : "no response from bg"));
            else cb && cb(null, resp.id);
          });
          return true;
        }
      } catch (e) {}
      return false;
    }

    function parseRoomIdFromPath() {
      try {
        const m = window.location.pathname.match(/\/accommodation\/(?:[^\/]+)\/(\d+)(?:$|\/)/i);
        if (m && m[1]) return m[1];
        const parts = window.location.pathname.split("/").filter(Boolean);
        for (let i = parts.length - 1; i >= 0; i--) if (/^\d+$/.test(parts[i])) return parts[i];
      } catch (e) {}
      return "unknown-id";
    }

    function collectImageUrlsFromRoomDiv(roomDiv) {
      const urls = [];
      if (!roomDiv) return urls;
      const imgs = Array.from(roomDiv.querySelectorAll("img"));
      for (const img of imgs) {
        const u = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy") || "";
        if (u) urls.push(u);
        else if (img.srcset) urls.push(img.srcset.split(",").pop().trim().split(" ")[0]);
      }
      const styled = Array.from(roomDiv.querySelectorAll("[style]"));
      for (const el of styled) {
        const s = el.getAttribute("style") || "";
        const m = s.match(/background-image:\s*url\(([^)]+)\)/i);
        if (m && m[1]) urls.push(m[1].replace(/(^['\"]|['\"]$)/g, ""));
      }
      const sources = Array.from(roomDiv.querySelectorAll("source"));
      for (const src of sources) {
        const u = src.srcset || src.src || src.getAttribute("data-src") || "";
        if (u) urls.push(u);
      }
      const normalized = urls.map((u) => {
        try {
          return new URL(u, window.location.href).href;
        } catch (e) {
          return u;
        }
      });
      return Array.from(new Set(normalized));
    }

    // --- UI: single shared button which delegates actions to global handlers ---
    function createButton() {
      const btn = document.createElement("button");
      btn.className = "elh-uniplaces-btn";
      btn.dataset.mode = "copy";
      btn.title = "Copy JSON or save images";
      btn.textContent = "copy this room data to json";

      const stop = (e) => {
        e.stopPropagation();
      };

      btn.addEventListener(
        "click",
        async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            if (btn.dataset.mode === "copy") {
              if (typeof window.elh_copyAction === "function") {
                await window.elh_copyAction();
                btn.textContent = "copied!";
              } else {
                btn.textContent = "no copy action";
              }
            } else if (btn.dataset.mode === 'save_flat_imgs') {
              if (typeof window.elh_saveFlatImgsAction === "function") {
                await window.elh_saveFlatImgsAction({ button: btn });
              } else {
                btn.textContent = "no save flat action";
              }
            } else {
              if (typeof window.elh_saveImgsAction === "function") {
                await window.elh_saveImgsAction({ button: btn });
              } else {
                btn.textContent = "no save action";
              }
            }
            } catch (err) {
            console.error('[ELH-helper] [parser_uniplaces.common] elh action failed', err);
            btn.textContent = "failed";
          }
          setTimeout(() => {
            btn.disabled = false;
            btn.dataset.mode === "copy"
              ? (btn.textContent = "copy this room data to json")
              : (btn.textContent = "save room images");
          }, 1500);
        },
        true
      );

      btn.addEventListener("mousedown", stop, true);
      btn.addEventListener("mouseup", stop, true);
      btn.addEventListener("click", stop, true);
      return btn;
    }

    // create second button (save flat images)
    function createFlatButton() {
      const btn = document.createElement("button");
      btn.className = "elh-uniplaces-btn elh-flat-btn";
      btn.dataset.mode = "save_flat_imgs";
      btn.title = "Save flat images (all except first section)";
      btn.textContent = "save flat images";

      const stop = (e) => {
        e.stopPropagation();
      };

      btn.addEventListener(
        "click",
        async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            if (typeof window.elh_saveFlatImgsAction === "function") {
              await window.elh_saveFlatImgsAction({ button: btn });
              btn.textContent = "saved flat!";
            } else {
              btn.textContent = "no save flat action";
            }
            } catch (err) {
            console.error('[ELH-helper] [parser_uniplaces.common] elh flat action failed', err);
            btn.textContent = "failed";
          }
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "save flat images";
          }, 1500);
        },
        true
      );

      btn.addEventListener("mousedown", stop, true);
      btn.addEventListener("mouseup", stop, true);
      btn.addEventListener("click", stop, true);
      return btn;
    }

    function ensureButton() {
      let b = document.querySelector(".elh-uniplaces-btn");
      if (!b) {
        b = createButton();
        document.body.appendChild(b);
      }
      return b;
    }

    function ensureButtonGroup() {
      let g = document.querySelector('.elh-btn-group');
      if (!g) {
        g = document.createElement('div');
        g.className = 'elh-btn-group';
        // basic inline flex styling as fallback; project stylesheet may override
        g.style.display = 'flex';
        g.style.flexDirection = 'row';
        g.style.alignItems = 'center';
        g.style.gap = '8px';
      }
      return g;
    }

    function updateButtonMode() {
      const btn = ensureButton();
      // ensure flat button exists too (do not attach to body yet)
      let flatBtn = document.querySelector('.elh-flat-btn');
      if (!flatBtn) {
        flatBtn = createFlatButton();
      }
      const modal =
        document.querySelector("div.sc-1t6jsoh-0.dUeFQx.photos-modal") ||
        document.querySelector("div.photos-modal");
      if (modal) {
        btn.dataset.mode = "save_imgs";
        btn.textContent = "save room images";
        btn.title = "Save images into Downloads/ELH-helper/{roomId}/";
        const target = modal.querySelector("div.sc-1imzkxw-3.jhsuIB") || document.querySelector("div.sc-1imzkxw-3.jhsuIB");
        // create a group container and append both buttons into it; show the group only while modal is open
        const group = ensureButtonGroup();
        group.classList.add('inline');
        btn.classList.add("inline");
        flatBtn.classList.add('inline');
        // ensure children order
        if (group.firstChild !== btn) group.appendChild(btn);
        if (group.lastChild !== flatBtn) group.appendChild(flatBtn);
        try {
          if (target) {
            target.appendChild(group);
          } else {
            // fallback to body
            if (!document.body.contains(group)) document.body.appendChild(group);
          }
        } catch (e) {
          if (!document.body.contains(group)) document.body.appendChild(group);
        }
      } else {
        // hide/remove the group if present (we only show the group when modal is open)
        const group = document.querySelector('.elh-btn-group');
        if (group && group.parentNode) group.parentNode.removeChild(group);

        btn.dataset.mode = "copy";
        btn.textContent = "copy this room data to json";
        btn.title = "Parse this page and copy info to JSON";
        // Try to place the button inside the header nav as the second element
        const headerNav = document.querySelector('nav.sc-1vxvgv6-0.eVeMSC.header-desk-nav');
        if (headerNav) {
          // ensure button uses inline styling rules (overrides fixed position)
          btn.classList.add('inline');
          try {
            // insert at second position (index 1)
            const insertBeforeNode = headerNav.children[1] || null;
            headerNav.insertBefore(btn, insertBeforeNode);
          } catch (e) {
            // fallback to body if insertion fails
            if (!document.body.contains(btn)) document.body.appendChild(btn);
          }
        } else {
          // default behavior: floating fixed button on body
          btn.classList.remove('inline');
          if (!document.body.contains(btn)) document.body.appendChild(btn);
        }
      }
    }

    // debounce observer
    let _sched = null;
    let _last = 0;
    const DB = 250;
    function sched() {
      if (_sched) return;
      const run = () => {
        _sched = null;
        try {
          if (typeof requestIdleCallback === "function") requestIdleCallback(() => updateButtonMode(), { timeout: 1000 });
          else updateButtonMode();
        } catch (e) {
          try {
            updateButtonMode();
          } catch (ee) {}
        }
        _last = Date.now();
      };
      const since = Date.now() - _last;
      _sched = setTimeout(run, since > DB ? 0 : DB - since);
    }

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          const nodes = Array.from(m.addedNodes || []).concat(Array.from(m.removedNodes || []));
          for (const n of nodes) {
            if (!(n instanceof Element)) continue;
            if (
              n.classList &&
              (n.classList.contains("photos-modal") || n.classList.contains("sc-1t6jsoh-0") || n.classList.contains("dUeFQx"))
            ) {
              sched();
              return;
            }
            if (n.querySelector && n.querySelector(".sc-1t6jsoh-0.dUeFQx.photos-modal")) {
              sched();
              return;
            }
          }
        } else if (m.type === "attributes" && m.attributeName === "class") {
          const t = m.target;
          if (t instanceof Element) {
            if (
              t.classList &&
              (t.classList.contains("photos-modal") || t.classList.contains("sc-1t6jsoh-0") || t.classList.contains("dUeFQx"))
            ) {
              sched();
              return;
            }
          }
        }
      }
    });

    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    // init
    ensureButton();
    updateButtonMode();

    // expose helpers to other content scripts (already in same page scope but make explicit)
    window.elh_helpers = window.elh_helpers || {};
    Object.assign(window.elh_helpers, {
      filenameFromUrl,
      fallbackAnchorDownload,
      requestBackgroundDownload,
      parseRoomIdFromPath,
      collectImageUrlsFromRoomDiv,
    });
    } catch (err) {
    console.error('[ELH-helper] [parser_uniplaces.common] parser_uniplaces.common error', err);
  }
})();
