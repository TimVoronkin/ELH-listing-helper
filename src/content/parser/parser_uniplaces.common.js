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
    } catch (e) { console.warn('parser: failed to inject shared styles', e); }
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
            } else {
              if (typeof window.elh_saveImgsAction === "function") {
                await window.elh_saveImgsAction({ button: btn });
              } else {
                btn.textContent = "no save action";
              }
            }
          } catch (err) {
            console.error("elh action failed", err);
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

    function ensureButton() {
      let b = document.querySelector(".elh-uniplaces-btn");
      if (!b) {
        b = createButton();
        document.body.appendChild(b);
      }
      return b;
    }

    function updateButtonMode() {
      const btn = ensureButton();
      const modal =
        document.querySelector("div.sc-1t6jsoh-0.dUeFQx.photos-modal") ||
        document.querySelector("div.photos-modal");
      if (modal) {
        btn.dataset.mode = "save_imgs";
        btn.textContent = "save room images";
        btn.title = "Save images into Downloads/ELH-helper/{roomId}/";
        const target = modal.querySelector("div.sc-1imzkxw-3.jhsuIB") || document.querySelector("div.sc-1imzkxw-3.jhsuIB");
        if (target) {
          btn.classList.add("inline");
          try {
            target.appendChild(btn);
          } catch (e) {
            if (!document.body.contains(btn)) document.body.appendChild(btn);
          }
        } else {
          btn.classList.remove("inline");
          if (!document.body.contains(btn)) document.body.appendChild(btn);
        }
      } else {
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
    console.error("parser_uniplaces.common error", err);
  }
})();
