// parser_uniplaces.js — cleaned final implementation

(function () {
  "use strict";
  try {
    const STYLE_ID = "elh-uniplaces-style";
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement("style");
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
  z-index: 2147483647 !important;
}
.elh-uniplaces-btn:disabled { opacity: 0.7; cursor: default; }
.elh-uniplaces-btn.inline { position: static !important; top: auto !important; left: auto !important; margin: 6px !important; z-index: auto !important; display: inline-block !important; }
      `;
      document.head && document.head.appendChild(s);
    }

    // filename helpers
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
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime &&
          chrome.runtime.sendMessage
        ) {
          chrome.runtime.sendMessage(
            { action: "download", url, filename },
            (resp) => {
              if (!resp || resp.error)
                cb &&
                  cb(
                    new Error(
                      resp && resp.error ? resp.error : "no response from bg"
                    )
                  );
              else cb && cb(null, resp.id);
            }
          );
          return true;
        }
      } catch (e) {}
      return false;
    }

    function parseRoomIdFromPath() {
      try {
        const m = window.location.pathname.match(
          /\/accommodation\/(?:[^\/]+)\/(\d+)(?:$|\/)/i
        );
        if (m && m[1]) return m[1];
        const parts = window.location.pathname.split("/").filter(Boolean);
        for (let i = parts.length - 1; i >= 0; i--)
          if (/^\d+$/.test(parts[i])) return parts[i];
      } catch (e) {}
      return "unknown-id";
    }

    // --- full page parser (restored from previous version) ---
    function findRoomData() {
      // Keep insertion order: source_url first
      const result = { source_url: window.location.href };

      // room name: h1.sc-1yx4bkn-1.fExLZX
      const h1 = document.querySelector('h1.sc-1yx4bkn-1.fExLZX');
      result.room_name = (h1 && h1.textContent) ? h1.textContent.trim() : '';

      // address: div.sc-1yx4bkn-4.cArfBY -> text
      const addressDiv = document.querySelector('div.sc-1yx4bkn-4.cArfBY');
      const addrRaw = (addressDiv && addressDiv.textContent) ? addressDiv.textContent.trim() : '';
      // parse into components: expected format 'street, neighborhood, city'
      let street = '';
      let neighborhood = '';
      let city = '';
      if (addrRaw) {
        const parts = addrRaw.split(',').map(p => p.trim());
        street = parts[0] || '';
        neighborhood = parts[1] || '';
        city = parts[2] || '';
      }
      result.address = {
        raw: addrRaw,
        street,
        neighborhood,
        city
      };

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

    function collectImageUrlsFromRoomDiv(roomDiv) {
      const urls = [];
      if (!roomDiv) return urls;
      // <img>
      const imgs = Array.from(roomDiv.querySelectorAll("img"));
      for (const img of imgs) {
        const u =
          img.src ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy") ||
          "";
        if (u) urls.push(u);
        else if (img.srcset)
          urls.push(img.srcset.split(",").pop().trim().split(" ")[0]);
      }
      // background-image style
      const styled = Array.from(roomDiv.querySelectorAll("[style]"));
      for (const el of styled) {
        const s = el.getAttribute("style") || "";
        const m = s.match(/background-image:\s*url\(([^)]+)\)/i);
        if (m && m[1]) urls.push(m[1].replace(/(^['\"]|['\"]$)/g, ""));
      }
      // <source> tags
      const sources = Array.from(roomDiv.querySelectorAll("source"));
      for (const src of sources) {
        const u = src.srcset || src.src || src.getAttribute("data-src") || "";
        if (u) urls.push(u);
      }
      // normalize and unique
      const normalized = urls.map((u) => {
        try {
          return new URL(u, window.location.href).href;
        } catch (e) {
          return u;
        }
      });
      return Array.from(new Set(normalized));
    }

    // UI
    // The new createButton uses the richer parser to copy full JSON when in copy mode
    function createButton() {
      const btn = document.createElement("button");
      btn.className = "elh-uniplaces-btn";
      btn.dataset.mode = "copy";
      btn.title = "Copy JSON or save images";
      btn.textContent = "copy this room data to json";

      const stop = (e) => {
        e.stopPropagation();
      };

      async function copyFullData() {
        const data = findRoomData();
        const txt = JSON.stringify(data, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText)
          await navigator.clipboard.writeText(txt);
        else {
          const ta = document.createElement("textarea");
          ta.value = txt;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
      }

      btn.addEventListener(
        "click",
        async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          btn.disabled = true;
          try {
            if (btn.dataset.mode === "copy") {
              await copyFullData();
              btn.textContent = "copied!";
            } else {
              // save mode: reuse existing image-save logic
              const modal =
                document.querySelector(
                  "div.sc-1t6jsoh-0.dUeFQx.photos-modal"
                ) || document.querySelector("div.photos-modal");
              const gallery =
                (modal && modal.querySelector("div.sc-16mjnzn-0.cBPfVX")) ||
                document.querySelector("div.sc-16mjnzn-0.cBPfVX");
              if (!gallery) {
                btn.textContent = "no gallery";
              } else {
                const firstDiv = Array.from(gallery.children).find(
                  (n) => n && n.tagName && n.tagName.toLowerCase() === "div"
                );
                const roomLabel =
                  firstDiv && firstDiv.id
                    ? firstDiv.id.trim()
                    : firstDiv
                    ? firstDiv.getAttribute("id") || ""
                    : "room";
                const roomId = parseRoomIdFromPath();
                const urls = collectImageUrlsFromRoomDiv(firstDiv);
                if (!urls.length) {
                  btn.textContent = "no images";
                } else {
                  let done = 0;
                  btn.textContent = `saving ${done}/${urls.length}`;
                  urls.forEach((u) => {
                    const url = u;
                    const orig = filenameFromUrl(url);
                    const safeLabel = String(roomLabel || "room").replace(
                      /[\\/]+/g,
                      "_"
                    );
                    const safeOrig = String(orig).replace(/[\\/]+/g, "_");
                    const targetName = `${safeLabel}-${safeOrig}`;
                    const reqFilename = `${roomId}/${targetName}`; // background prefixes with ELH-helper/
                    const onDone = () => {
                      done++;
                      btn.textContent = `saving ${done}/${urls.length}`;
                      if (done === urls.length) btn.textContent = "saved";
                    };
                    const sent = requestBackgroundDownload(
                      url,
                      reqFilename,
                      (err) => {
                        if (err)
                          fallbackAnchorDownload(
                            url,
                            `${roomId}-${targetName}`
                          );
                        onDone();
                      }
                    );
                    if (!sent) {
                      fallbackAnchorDownload(url, `${roomId}-${targetName}`);
                      onDone();
                    }
                  });
                }
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
              : (btn.textContent = "save imgs");
          }, 1500);
        },
        true
      );
      // stop propagation of mouse events in capture so site doesn't react
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
        btn.textContent = "save imgs";
        btn.title = "Save images into Downloads/ELH-helper/{roomId}";
        const target =
          modal.querySelector("div.sc-1imzkxw-3.jhsuIB") ||
          document.querySelector("div.sc-1imzkxw-3.jhsuIB");
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
        btn.classList.remove("inline");
        if (!document.body.contains(btn)) document.body.appendChild(btn);
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
          if (typeof requestIdleCallback === "function")
            requestIdleCallback(() => updateButtonMode(), { timeout: 1000 });
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
          const nodes = Array.from(m.addedNodes || []).concat(
            Array.from(m.removedNodes || [])
          );
          for (const n of nodes) {
            if (!(n instanceof Element)) continue;
            if (
              n.classList &&
              (n.classList.contains("photos-modal") ||
                n.classList.contains("sc-1t6jsoh-0") ||
                n.classList.contains("dUeFQx"))
            ) {
              sched();
              return;
            }
            if (
              n.querySelector &&
              n.querySelector(".sc-1t6jsoh-0.dUeFQx.photos-modal")
            ) {
              sched();
              return;
            }
          }
        } else if (m.type === "attributes" && m.attributeName === "class") {
          const t = m.target;
          if (t instanceof Element) {
            if (
              t.classList &&
              (t.classList.contains("photos-modal") ||
                t.classList.contains("sc-1t6jsoh-0") ||
                t.classList.contains("dUeFQx"))
            ) {
              sched();
              return;
            }
          }
        }
      }
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    // init
    ensureButton();
    updateButtonMode();
  } catch (err) {
    console.error("parser_uniplaces error", err);
  }
})();
