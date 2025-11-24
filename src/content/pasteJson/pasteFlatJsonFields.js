// pasteFlatJsonFields.js
(function () {
  // Debug: script loaded
  console.log('[ELH-helper] [pasteFlatJsonFields] script loaded, location.href=', location.href);

  // Insert button when possible; handle SPA/dynamic DOM by observing body
  // Ensure shared styles are present
  function loadSharedStylesOnce() {
    try {
      const ID = "elh-shared-styles";
      if (document.getElementById(ID)) return;
      const link = document.createElement("link");
      link.id = ID;
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("src/shared/buttons.css");
      document.head && document.head.appendChild(link);
    } catch (e) {
      console.warn('[ELH-helper] [pasteFlatJsonFields] Failed to inject shared styles', e);
    }
  }
  loadSharedStylesOnce();
  function isAllowedPage() {
    const url = location.href;
    try {
      const u = new URL(url);
      if (u.hostname !== "www.erasmuslifehousing.com") return false;
      const p = u.pathname.replace(/\/+/g, "/");
      // exact: /dashboard/admin/houses/form
      if (p === "/dashboard/admin/houses/form") return true;

      // /dashboard/admin/houses/form/{something}
      if (/^\/dashboard\/admin\/houses\/form\/[^\/]+\/?$/.test(p)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function createPasteButton() {
    // manage a shared floating container for paste buttons
    const containerId = 'elh-paste-container';
    // if page not allowed, remove button if exists and possibly remove container
    if (!isAllowedPage() || !document.body) {
      const existing = document.getElementById('elh-paste-json-btn');
      if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
      const container = document.getElementById(containerId);
      if (container && container.children.length === 0) container.remove();
      return;
    }

    // ensure container
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'elh-paste-container';
      document.body.appendChild(container);
    }

    if (document.getElementById("elh-paste-json-btn")) return; // already inserted
    const btn = document.createElement("button");
    btn.id = "elh-paste-json-btn";
    btn.type = "button";
    btn.textContent = "paste json data into listing fields";
    btn.className = "elh-btn elh-paste-btn";
    btn.addEventListener("click", handlePasteClick);
    container.appendChild(btn);
    console.log('[ELH-helper] [pasteFlatJsonFields] paste button inserted into container');
  }

  // Try to create immediately
  try {
    createPasteButton();
  } catch (e) {
    console.warn('[ELH-helper] [pasteFlatJsonFields] createPasteButton immediate failed', e);
  }

  // Listen for SPA navigation: patch history methods and listen to popstate
  (function setupLocationWatcher() {
    try {
      const dispatchLocationChange = () => {
        window.dispatchEvent(new Event('locationchange'));
      };
      const _push = history.pushState;
      history.pushState = function () {
        _push.apply(this, arguments);
        dispatchLocationChange();
      };
      const _replace = history.replaceState;
      history.replaceState = function () {
        _replace.apply(this, arguments);
        dispatchLocationChange();
      };
      window.addEventListener('popstate', dispatchLocationChange);
      window.addEventListener('locationchange', () => {
        // run create/remove logic on navigation
        try { createPasteButton(); } catch (e) {}
      });
    } catch (e) {
      console.warn('[ELH-helper] [pasteFlatJsonFields] location watcher failed', e);
    }
  })();

  // Observe DOM for dynamic changes (SPA) and insert button when body becomes available or when form renders
  const insObserver = new MutationObserver((mutations) => {createPasteButton();});
  insObserver.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });

  // Read clipboard and parse JSON. Returns parsed object or null
  async function readClipboardJson() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      console.log('[ELH-helper] [pasteFlatJsonFields] clipboard text length:', clipboardText ? clipboardText.length : 0);
      if (!clipboardText) {
        console.warn('[ELH-helper] [pasteFlatJsonFields] clipboard empty');
        return null;
      }
      try {
        const jsonData = JSON.parse(clipboardText);
        console.log('[ELH-helper] [pasteFlatJsonFields] parsed clipboard JSON keys:', jsonData && Object.keys(jsonData));
        return jsonData;
      } catch (e) {
        console.error('[ELH-helper] [pasteFlatJsonFields] Clipboard does not contain valid JSON.', e);
        return null;
      }
    } catch (err) {
      console.error('[ELH-helper] [pasteFlatJsonFields] Failed to read clipboard:', err);
      return null;
    }
  }



  // Detect which Step component is present on the page. Returns { component, el }
  function detectStepComponent() {
    const loc = document.querySelector(
      'div[data-sentry-component="StepLocation"]'
    );
    if (loc) return { component: "StepLocation", el: loc };
    const type = document.querySelector(
      'div[data-sentry-component="StepType"]'
    );
    if (type) return { component: "StepType", el: type };
    const comod = document.querySelector(
      'div[data-sentry-component="StepComodation"]'
    );
    if (comod) return { component: "StepComodation", el: comod };
    const rules = document.querySelector(
      'div[data-sentry-component="StepRules"]'
    );
    if (rules) return { component: "StepRules", el: rules };
    const imgs = document.querySelector(
      'div[data-sentry-component="StepImages"]'
    );
    if (imgs) return { component: "StepImages", el: imgs };
    return { component: null, el: null };
  }

  // Handle address insertion on StepLocation: street, neighborhood, city
  async function handleStepLocation(jsonData, stepDiv) {
    try {
      const addrObj =
        jsonData &&
        (jsonData.address ||
          jsonData.address_0 ||
          jsonData.address0 ||
          jsonData.street);
      let streetVal = "";
      let neighborhoodVal = "";
      let cityVal = "";
      if (addrObj) {
        if (typeof addrObj === "string") {
          streetVal = addrObj;
        } else if (typeof addrObj === "object") {
          streetVal = addrObj.street || addrObj.raw || "";
          neighborhoodVal = addrObj.neighborhood || "";
          cityVal = addrObj.city || "";
        }
      }
      console.log('[ELH-helper] [pasteFlatJsonFields] parsed address parts (StepLocation)', {
        streetVal,
        neighborhoodVal,
        cityVal,
      });

      if (streetVal) {
        const streetField = findStreetAddressField();
        if (streetField) {
          setInputValue(streetField, streetVal);
          highlightElement(streetField);
          console.log('[ELH-helper] [pasteFlatJsonFields] street set to', streetVal);
        } else {
          console.warn('[ELH-helper] [pasteFlatJsonFields] street input not found (StepLocation)');
        }
      }

      if (neighborhoodVal) {
        const neighField = findNeighborhoodField();
        if (neighField) {
          setInputValue(neighField, neighborhoodVal);
          highlightElement(neighField);
          console.log('[ELH-helper] [pasteFlatJsonFields] neighborhood set to', neighborhoodVal);
        } else {
          console.warn('[ELH-helper] [pasteFlatJsonFields] neighborhood input not found (StepLocation)');
        }
      }

      if (cityVal) {
        const cityControl = findCityControl();
        if (cityControl && cityControl.select) {
          const matchedOption = Array.from(cityControl.select.options).find(
            (opt) =>
              (opt.text || opt.label || "").trim().toLowerCase() ===
              cityVal.trim().toLowerCase()
          );
          if (matchedOption) {
            try {
              const nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype,
                "value"
              )?.set;
              if (nativeSetter)
                nativeSetter.call(cityControl.select, matchedOption.value);
              else cityControl.select.value = matchedOption.value;
              cityControl.select.dispatchEvent(
                new Event("input", { bubbles: true })
              );
              cityControl.select.dispatchEvent(
                new Event("change", { bubbles: true })
              );
              console.log('[ELH-helper] [pasteFlatJsonFields] city selected (select updated)', matchedOption.value, matchedOption.text);
              try {
                highlightElement(cityControl.select);
              } catch (e) {}
              if (cityControl.button) {
                try {
                  highlightElement(cityControl.button);
                } catch (e) {}
              }
            } catch (e) {
              console.warn('[ELH-helper] [pasteFlatJsonFields] failed to set select value safely', e);
            }
          } else {
            console.warn('[ELH-helper] [pasteFlatJsonFields] city option not found for', cityVal);
          }
        } else {
          console.warn('[ELH-helper] [pasteFlatJsonFields] city select control not found (StepLocation)');
        }
      }
    } catch (err) {
      console.warn('[ELH-helper] [pasteFlatJsonFields] handleStepLocation failed', err);
    }
  }
  // Handle StepType: set Furnished -> Yes if at least 3 items in room_furniture (ignoring 'window') and at least one contains 'bed'
  async function handleStepType(jsonData, stepTypeDiv) {
    try {
      if (!jsonData || !Array.isArray(jsonData.room_furniture)) return;
      const items = jsonData.room_furniture
        .filter((i) => i && typeof i === "string")
        .map((i) => i.trim())
        .filter(Boolean);
      const filtered = items.filter((i) => i.toLowerCase() !== "window");
      const hasBed = filtered.some((i) => i.toLowerCase().includes("bed"));
      if (filtered.length >= 3 && hasBed) {
        // set Furnished -> Yes
        const yesBtn = findRadioButtonByLabel("Furnished", "Yes");
        if (yesBtn) {
          const isChecked =
            yesBtn.getAttribute("data-state") === "checked" ||
            yesBtn.getAttribute("aria-checked") === "true";
          if (!isChecked) {
            try {
              yesBtn.click();
            } catch (e) {
              console.warn('[ELH-helper] [pasteFlatJsonFields] failed to click furnished yesBtn', e);
            }
          }
          highlightElement(yesBtn, "green");
          console.log('[ELH-helper] [pasteFlatJsonFields] set Furnished -> Yes');
        } else {
          console.warn('[ELH-helper] [pasteFlatJsonFields] Furnished Yes radio not found');
        }
      }
    } catch (err) {
      console.warn("[ELH-pasteJson] handleStepType failed", err);
    }
  }
  // Handle insertion for the StepComodation area (street, neighborhood, city, other_fees)
  async function handleStepComodation(jsonData, stepDiv) {
    try {
      // other_fees handling — only on StepComodation
      if (
        jsonData &&
        Array.isArray(jsonData.other_fees) &&
        jsonData.other_fees.length > 0 &&
        stepDiv
      ) {
        console.log(
          "[ELH-pasteJson] processing other_fees",
          jsonData.other_fees
        );
        const otherLines = [];
        for (const fee of jsonData.other_fees) {
          const label = (fee.label || "").trim();
          const raw = (fee.raw || "").trim();
          const desc = (fee.description || "").trim();
          if (!label) continue;
          if (label.toLowerCase() === "cleaning fee") {
            if (raw.toLowerCase() === "included") {
              const ok = setCheckboxByLabel("Cleaning", true);
              console.log("[ELH-pasteJson] set Cleaning checkbox:", ok);
              const cleaningTa =
                findTextareaByName("cleaningDescription") ||
                document.getElementById("«r2p»-form-item") ||
                document.querySelector('textarea[name="cleaningDescription"]');
              if (cleaningTa) {
                setInputValue(cleaningTa, desc);
                highlightElement(cleaningTa);
                console.log("[ELH-pasteJson] cleaning description set");
              } else {
                console.warn(
                  "[ELH-pasteJson] cleaning description textarea not found"
                );
              }
            } else {
              otherLines.push(`${label}: ${raw}${desc ? " — " + desc : ""}`);
            }
          } else {
            otherLines.push(`${label}: ${raw}${desc ? " — " + desc : ""}`);
          }
        }
        if (otherLines.length > 0) {
          const otherTa =
            findTextareaByName("otherAmenities") ||
            document.getElementById("«r2q»-form-item") ||
            document.querySelector('textarea[name="otherAmenities"]');
          if (otherTa) {
            const existing = (otherTa.value || otherTa.textContent || "")
              .toString()
              .trim();
            const newVal = existing
              ? existing + "\n" + otherLines.join("\n")
              : otherLines.join("\n");
            setInputValue(otherTa, newVal);
            highlightElement(otherTa);
            console.log("[ELH-pasteJson] other amenities set");
          } else {
            console.warn("[ELH-pasteJson] other amenities textarea not found");
          }
        }
      }
      } catch (err) {
      console.warn('[ELH-helper] [pasteFlatJsonFields] handleStepComodation failed', err);
    }
  }
  // Handle StepRules: set checkboxes for Smoking allowed and Pets allowed
  async function handleStepRules(jsonData, stepRulesDiv) {
    try {
      if (!jsonData || !jsonData.rental_conditions) return;

      // Smoking allowed -> find label 'Smoking allowed' and set that checkbox
      if (jsonData.rental_conditions.hasOwnProperty("Smoking allowed")) {
        const val = !!jsonData.rental_conditions["Smoking allowed"];
        const smokeBtn = findCheckboxButtonByLabel("Smoking allowed");
        if (smokeBtn) {
          // determine current state
          const isChecked =
            smokeBtn.getAttribute("data-state") === "checked" ||
            smokeBtn.getAttribute("aria-checked") === "true";
          if ((isChecked && !val) || (!isChecked && val)) {
            try {
              smokeBtn.click();
            } catch (e) {
              console.warn("[ELH-pasteJson] failed to click smokeBtn", e);
            }
          }
          highlightElement(smokeBtn, "green");
          console.log("[ELH-pasteJson] set Smoking allowed ->", val);
        } else {
          console.warn("[ELH-pasteJson] Smoking allowed checkbox not found");
        }
      }

      if (
        jsonData.rental_conditions.hasOwnProperty("Overnight guests allowed")
      ) {
        const val = !!jsonData.rental_conditions["Overnight guests allowed"];
        const overnightBtn = findCheckboxButtonByLabel("Allow Night Guests");
        if (overnightBtn) {
          const isChecked =
            overnightBtn.getAttribute("data-state") === "checked" ||
            overnightBtn.getAttribute("aria-checked") === "true";
          if ((isChecked && !val) || (!isChecked && val)) {
            try {
              overnightBtn.click();
            } catch (e) {
              console.warn("[ELH-pasteJson] failed to click overnightBtn", e);
            }
          }
          highlightElement(overnightBtn, "green");
          console.log("[ELH-pasteJson] set Overnight guests allowed ->", val);
        } else {
          console.warn(
            "[ELH-pasteJson] Overnight guests allowed checkbox not found"
          );
        }
      }

      // Pets allowed -> page label is 'Allow Pets' per UI snippet
      if (jsonData.rental_conditions.hasOwnProperty("Pets allowed")) {
        const val = !!jsonData.rental_conditions["Pets allowed"];
        const petsBtn = findCheckboxButtonByLabel("Allow Pets");
        if (petsBtn) {
          const isChecked =
            petsBtn.getAttribute("data-state") === "checked" ||
            petsBtn.getAttribute("aria-checked") === "true";
          if ((isChecked && !val) || (!isChecked && val)) {
            try {
              petsBtn.click();
            } catch (e) {
              console.warn("[ELH-pasteJson] failed to click petsBtn", e);
            }
          }
          highlightElement(petsBtn, "green");
          console.log("[ELH-pasteJson] set Allow Pets ->", val);
        } else {
          console.warn("[ELH-pasteJson] Allow Pets checkbox not found");
        }
      }
      // Preferred Gender from jsonData.gender -> set dropdown
      if (jsonData.gender) {
        try {
          const mapping = {
            "Mixed gender": "Doesn't Matter",
            Males: "Male",
            Females: "Female",
          };
          const desiredLabel = mapping[jsonData.gender] || jsonData.gender;
          const genderControl = findGenderControl();
          if (genderControl && genderControl.select) {
            const matchedOption = Array.from(genderControl.select.options).find(
              (opt) =>
                (opt.text || opt.label || "").trim().toLowerCase() ===
                (desiredLabel || "").trim().toLowerCase()
            );
            if (matchedOption) {
              try {
                const nativeSetter = Object.getOwnPropertyDescriptor(
                  HTMLSelectElement.prototype,
                  "value"
                )?.set;
                if (nativeSetter)
                  nativeSetter.call(genderControl.select, matchedOption.value);
                else genderControl.select.value = matchedOption.value;
                genderControl.select.dispatchEvent(
                  new Event("input", { bubbles: true })
                );
                genderControl.select.dispatchEvent(
                  new Event("change", { bubbles: true })
                );
                try {
                  highlightElement(genderControl.select);
                } catch (e) {}
                if (genderControl.button) {
                  try {
                    highlightElement(genderControl.button);
                  } catch (e) {}
                }
                console.log(
                  "[ELH-pasteJson] Preferred Gender set ->",
                  matchedOption.value,
                  matchedOption.text
                );
              } catch (e) {
                console.warn(
                  "[ELH-pasteJson] failed to set Preferred Gender safely",
                  e
                );
              }
            } else {
              console.warn(
                "[ELH-pasteJson] gender option not found for",
                desiredLabel
              );
            }
          } else {
            console.warn("[ELH-pasteJson] gender control not found");
          }
        } catch (err) {
          console.warn("[ELH-pasteJson] Preferred Gender handling failed", err);
        }
      }
    } catch (err) {
      console.warn("[ELH-pasteJson] handleStepRules failed", err);
    }
  }
  // Handle insertion for the StepImages area (apartment_description -> translation)
  async function handleStepImages(jsonData, stepImagesDiv) {
    try {
      if (
        stepImagesDiv &&
        jsonData &&
        typeof jsonData.apartment_description === "string" &&
        jsonData.apartment_description.trim()
      ) {
        const descVal = jsonData.apartment_description.trim();
        const descTa =
          stepImagesDiv.querySelector('textarea[name="specialObservations"]') ||
          document.querySelector('textarea[name="specialObservations"]') ||
          document.getElementById("«r14p»-form-item");
        if (descTa) {
          const loadingText = `loading translation of this...\n${descVal}`;
          setInputValue(descTa, loadingText);
          highlightElement(descTa, "orange");
          console.log(
            "[ELH-pasteJson] apartment_description (loading) inserted into Description textarea"
          );

          const promptObj = {
            instruction: `Answer me only with a translation of this text into English and nothing else: ${descVal}`,
          };

          try {
            chrome.runtime.sendMessage(
              { action: "gemini_request", prompt: JSON.stringify(promptObj) },
              (response) => {
                try {
                  if (!response) {
                    console.warn("[ELH-pasteJson] Gemini response empty");
                    return;
                  }
                  let translated = null;
                  if (
                    response.candidates &&
                    response.candidates[0] &&
                    response.candidates[0].content &&
                    response.candidates[0].content.parts &&
                    response.candidates[0].content.parts[0] &&
                    response.candidates[0].content.parts[0].text
                  ) {
                    translated = response.candidates[0].content.parts[0].text;
                  } else if (
                    response.output &&
                    typeof response.output === "string"
                  ) {
                    translated = response.output;
                  } else if (typeof response === "string") {
                    translated = response;
                  } else if (response.result && response.result.output_text) {
                    translated = response.result.output_text;
                  }

                  if (translated && typeof translated === "string") {
                    const finalText = translated.trim();
                    setInputValue(descTa, finalText);
                    highlightElement(descTa, "green");
                    console.log(
                      "[ELH-pasteJson] Gemini translation inserted into Description textarea"
                    );
                  } else {
                    console.warn(
                      "[ELH-pasteJson] Gemini response did not contain a translated text",
                      response
                    );
                  }
                } catch (e) {
                  console.warn(
                    "[ELH-pasteJson] Error processing Gemini response",
                    e,
                    response
                  );
                }
              }
            );
          } catch (e) {
            console.warn(
              "[ELH-pasteJson] Failed to call background Gemini request",
              e
            );
          }
        } else {
          console.warn(
            "[ELH-pasteJson] Description textarea for StepImages not found"
          );
        }
      }
    } catch (err) {
      console.warn("[ELH-pasteJson] handleStepImages failed", err);
    }
  }


  
  // Find a radio button (button[role="radio"]) associated with a label containing the given text (loose match)
  function findRadioButtonByLabel(labelText, optionLabel) {
    if (!labelText || !optionLabel) return null;
    // find group by labelText
    const groups = Array.from(
      document.querySelectorAll(
        '[data-sentry-component="StepType"], [role="radiogroup"], div'
      )
    );
    // try to find the label element first
    const labels = Array.from(document.querySelectorAll("label"));
    let groupRoot = null;
    for (const lbl of labels) {
      const txt = (lbl.textContent || "").trim().toLowerCase();
      if (txt.includes(labelText.trim().toLowerCase())) {
        groupRoot =
          lbl.parentElement || lbl.closest('[role="radiogroup"]') || document;
        break;
      }
    }
    const searchRoot = groupRoot || document;
    // find label for optionLabel inside searchRoot
    const optionLabels = Array.from(searchRoot.querySelectorAll("label"));
    for (const ol of optionLabels) {
      const ot = (ol.textContent || "").trim().toLowerCase();
      if (
        ot === optionLabel.trim().toLowerCase() ||
        ot.includes(optionLabel.trim().toLowerCase())
      ) {
        // try htmlFor -> radio button id
        if (ol.htmlFor) {
          const btn =
            document.getElementById(ol.htmlFor) ||
            document.querySelector(`button#${CSS.escape(ol.htmlFor)}`);
          if (btn && btn.getAttribute && btn.getAttribute("role") === "radio")
            return btn;
        }
        // previous sibling
        let prev = ol.previousElementSibling;
        if (prev && prev.getAttribute && prev.getAttribute("role") === "radio")
          return prev;
        // parent search
        const p = ol.parentElement;
        if (p) {
          const btn2 = p.querySelector('button[role="radio"]');
          if (btn2) return btn2;
        }
      }
    }
    return null;
  }
  // Find a button[role="checkbox"] associated with a label that contains the given text (loose match)
  function findCheckboxButtonByLabel(labelText) {
    if (!labelText) return null;
    const labels = Array.from(document.querySelectorAll("label"));
    const target = labelText.trim().toLowerCase();
    for (const lbl of labels) {
      const txt = (lbl.textContent || "").trim().toLowerCase();
      if (!txt) continue;
      // loose match: contains
      if (txt.includes(target)) {
        // prefer htmlFor -> button with matching id
        if (lbl.htmlFor) {
          const btn =
            document.getElementById(lbl.htmlFor) ||
            document.querySelector(`button#${CSS.escape(lbl.htmlFor)}`);
          if (
            btn &&
            btn.getAttribute &&
            btn.getAttribute("role") === "checkbox"
          )
            return btn;
        }
        // previous sibling
        let prev = lbl.previousElementSibling;
        if (
          prev &&
          prev.getAttribute &&
          prev.getAttribute("role") === "checkbox"
        )
          return prev;
        // parent search
        const parent = lbl.parentElement;
        if (parent) {
          const btn2 = parent.querySelector('button[role="checkbox"]');
          if (btn2) return btn2;
        }
      }
    }
    return null;
  }

  // Helper to find Preferred Gender control: returns { button, select }
  function findGenderControl() {
    const label = Array.from(document.querySelectorAll("label")).find((el) =>
      (el.textContent || "").toLowerCase().includes("preferred gender")
    );
    let btn = null;
    let sel = null;
    if (label) {
      const wrapper = label.parentElement || document;
      const next = label.nextElementSibling;
      if (next && next.matches && next.matches('button[role="combobox"]'))
        btn = next;
      sel = wrapper.querySelector("select");
    }
    if (!sel) {
      const selects = Array.from(document.querySelectorAll("select"));
      for (const s of selects) {
        const optsText = Array.from(s.options)
          .map((o) => (o.text || o.label || "").toLowerCase())
          .join(" ");
        if (optsText.includes("male") && optsText.includes("female")) {
          sel = s;
          break;
        }
      }
    }
    if (!btn)
      btn =
        document.querySelector('button[role="combobox"]') ||
        document.querySelector("button[aria-haspopup]");
    return { button: btn, select: sel };
  }

  // New structured click handler: read clipboard, detect step, dispatch to specific handlers
  async function handlePasteClick() {
    console.log("[ELH-pasteJson] paste button clicked");
    const jsonData = await readClipboardJson();
    if (!jsonData) return;

    const detected = detectStepComponent();
    if (detected.component === "StepLocation") {
      console.log("[ELH-pasteJson] Detected StepLocation");
      await handleStepLocation(jsonData, detected.el);
      return;
    }
    if (detected.component === "StepType") {
      console.log("[ELH-pasteJson] Detected StepType");
      await handleStepType(jsonData, detected.el);
      return;
    }
    if (detected.component === "StepComodation") {
      console.log("[ELH-pasteJson] Detected StepComodation");
      await handleStepComodation(jsonData, detected.el);
      return;
    }
    if (detected.component === "StepRules") {
      console.log("[ELH-pasteJson] Detected StepRules");
      await handleStepRules(jsonData, detected.el);
      return;
    }
    if (detected.component === "StepImages") {
      console.log("[ELH-pasteJson] Detected StepImages");
      await handleStepImages(jsonData, detected.el);
      return;
    }

    // If no single step detected, try to apply both handlers if their sections exist
    const fallbackLoc = document.querySelector(
      'div[data-sentry-component="StepLocation"]'
    );
    const fallbackType = document.querySelector(
      'div[data-sentry-component="StepType"]'
    );
    const fallbackComod = document.querySelector(
      'div[data-sentry-component="StepComodation"]'
    );
    const fallbackRules = document.querySelector(
      'div[data-sentry-component="StepRules"]'
    );
    const fallbackImgs = document.querySelector(
      'div[data-sentry-component="StepImages"]'
    );

    if (fallbackLoc) {
      console.log("[ELH-pasteJson] Fallback: applying StepLocation handler");
      await handleStepLocation(jsonData, fallbackLoc);
    }
    if (fallbackType) {
      console.log("[ELH-pasteJson] Fallback: applying StepType handler");
      await handleStepType(jsonData, fallbackType);
    }
    if (fallbackComod) {
      console.log("[ELH-pasteJson] Fallback: applying StepComodation handler");
      await handleStepComodation(jsonData, fallbackComod);
    }
    if (fallbackRules) {
      console.log("[ELH-pasteJson] Fallback: applying StepRules handler");
      await handleStepRules(jsonData, fallbackRules);
    }
    if (fallbackImgs) {
      console.log("[ELH-pasteJson] Fallback: applying StepImages handler");
      await handleStepImages(jsonData, fallbackImgs);
    }
  }

  function findStreetAddressField() {
    const targetLabel = "street address";
    console.log(
      "[ELH-pasteJson] findStreetAddressField: searching labels for",
      targetLabel
    );
    // 1) Try to find label whose text content contains targetLabel (case-insensitive)
    const labels = Array.from(document.querySelectorAll("label, span"));
    for (const label of labels) {
      const txt = (label.textContent || "").trim().toLowerCase();
      if (!txt) continue;
      if (
        txt.includes(targetLabel) ||
        txt.includes("street and number") ||
        txt.includes("street and")
      ) {
        console.log("[ELH-pasteJson] matching label found:", txt, label);
        // prefer associated input by htmlFor
        if (label.htmlFor) {
          const el = document.getElementById(label.htmlFor);
          if (el) {
            console.log("[ELH-pasteJson] found input by htmlFor", el);
            return el;
          }
        }
        // input inside label
        const inside = label.querySelector("input, textarea");
        if (inside) {
          console.log("[ELH-pasteJson] found input inside label", inside);
          return inside;
        }
        // sibling (common structure: label + wrapper)
        let sibling = label.nextElementSibling;
        if (sibling) {
          if (
            sibling.matches &&
            (sibling.matches("input, textarea") ||
              sibling.querySelector("input, textarea"))
          ) {
            const res = sibling.matches("input, textarea")
              ? sibling
              : sibling.querySelector("input, textarea");
            console.log("[ELH-pasteJson] found input near label sibling", res);
            return res;
          }
        }
      }
    }

    // 2) Fallback: search inputs/textarea by placeholder, aria-label, name, id
    console.log(
      "[ELH-pasteJson] findStreetAddressField: fallback searching inputs"
    );
    const candidates = Array.from(document.querySelectorAll("input, textarea"));
    for (const el of candidates) {
      const combined = [
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.name,
        el.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (
        combined.includes("street address") ||
        combined.includes("street_address") ||
        combined.includes("street") ||
        combined.includes("street and number")
      ) {
        console.log(
          "[ELH-pasteJson] found candidate by attributes:",
          combined,
          el
        );
        return el;
      }
    }

    console.log("[ELH-pasteJson] findStreetAddressField: nothing matched");
    return null;
  }

  // Helper: set value safely for controlled inputs
  function setInputValue(el, value) {
    try {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          el.constructor.prototype,
          "value"
        )?.set;
        if (nativeSetter) nativeSetter.call(el, value);
        else el.value = value;
      } else if ("value" in el) {
        el.value = value;
      } else {
        el.textContent = value;
      }
    } catch (e) {
      try {
        el.value = value;
      } catch (err) {
        el.textContent = value;
      }
    }
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {}
  }

  // highlightElement: delegate to shared module if available; default green; pass color='orange' to show loading state
  function highlightElement(el, color = "green") {
    try {
      if (!el) return;
      // If shared module not present, try to inject it (best-effort)
      if (!window.ELH || typeof window.ELH.highlightElement !== 'function') {
        try {
          const id = 'elh-highlight-module';
          if (!document.getElementById(id)) {
            const s = document.createElement('script');
            s.id = id;
            s.src = chrome.runtime.getURL('src/content/shared/highlight.js');
            // after load, try to call the shared implementation once
            s.onload = function () {
              try {
                if (window.ELH && typeof window.ELH.highlightElement === 'function') {
                  window.ELH.highlightElement(el, color);
                }
              } catch (e) {}
            };
            document.head && document.head.appendChild(s);
            // don't return: apply local fallback immediately so highlight shows while shared module loads
          }
        } catch (e) {}
      }

      if (window.ELH && typeof window.ELH.highlightElement === 'function') {
        try { window.ELH.highlightElement(el, color); return; } catch (e) {}
      }

      // fallback local behavior
      if (!el || !el.style) return;
      if (color === "orange") {
        el.style.border = "2px solid #ff8c00";
        el.style.boxShadow = "0 0 0 4px rgba(255,140,0,0.12)";
      } else {
        el.style.border = "2px solid #28a745";
        el.style.boxShadow = "0 0 0 4px rgba(40,167,69,0.12)";
      }
      el.style.outline = "none";
    } catch (e) {}
  }

  function findNeighborhoodField() {
    // Look for label 'Neighborhood' or name 'freguesia'
    const labels = Array.from(document.querySelectorAll("label"));
    for (const label of labels) {
      const txt = (label.textContent || "").trim().toLowerCase();
      if (
        txt.includes("neighborhood") ||
        txt.includes("neighbourhood") ||
        txt.includes("freguesia")
      ) {
        if (label.htmlFor) {
          const el = document.getElementById(label.htmlFor);
          if (el) return el;
        }
        const inside = label.querySelector("input, textarea");
        if (inside) return inside;
        const sibling = label.nextElementSibling;
        if (sibling) {
          if (
            sibling.matches &&
            (sibling.matches("input, textarea") ||
              sibling.querySelector("input, textarea"))
          ) {
            return sibling.matches("input, textarea")
              ? sibling
              : sibling.querySelector("input, textarea");
          }
        }
      }
    }
    // fallback by name/id
    const candidates = Array.from(document.querySelectorAll("input, textarea"));
    for (const el of candidates) {
      const combined = [
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.name,
        el.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (
        combined.includes("neighborhood") ||
        combined.includes("neighbourhood") ||
        combined.includes("freguesia")
      )
        return el;
    }
    return null;
  }

  function findCityControl() {
    // The page has a visible combobox button and a hidden select. Find the label 'Choose the city where you live' to get nearby elements
    const label = Array.from(document.querySelectorAll("label")).find((el) =>
      (el.textContent || "")
        .toLowerCase()
        .includes("choose the city where you live")
    );
    let btn = null;
    let sel = null;
    if (label) {
      // possible structure: label + button + select
      let next = label.nextElementSibling;
      // sometimes label and button are siblings inside a wrapper
      if (
        next &&
        next.matches &&
        next.matches(
          'button[role="combobox"], button[role="combobox"], [role="combobox"]'
        )
      )
        btn = next;
      // find nearby select
      const wrapper = label.parentElement || document;
      sel = wrapper.querySelector("select");
    }
    // general fallback: find select with city options (contains 'porto' etc.)
    if (!sel) {
      const selects = Array.from(document.querySelectorAll("select"));
      for (const s of selects) {
        const optsText = Array.from(s.options)
          .map((o) => (o.text || o.label || "").toLowerCase())
          .join(" ");
        if (
          optsText.includes("porto") ||
          optsText.includes("lisboa") ||
          optsText.includes("porto")
        ) {
          sel = s;
          break;
        }
      }
    }
    // fallback: try to find any button that looks like the visible combobox
    if (!btn)
      btn =
        document.querySelector('button[role="combobox"]') ||
        document.querySelector("button[aria-haspopup]");
    return { button: btn, select: sel };
  }

  function findTextareaByName(name) {
    if (!name) return null;
    let ta = document.querySelector(`textarea[name="${name}"]`);
    if (ta) return ta;
    // try id lookup
    const byId = Array.from(document.querySelectorAll("textarea")).find(
      (t) => t.id && t.id.includes(name)
    );
    if (byId) return byId;
    return null;
  }

  function setCheckboxByLabel(labelText, checked) {
    // The page uses a button role="checkbox" and a hidden input; find the label and toggle the associated button
    const labels = Array.from(document.querySelectorAll("label"));
    for (const lbl of labels) {
      const txt = (lbl.textContent || "").trim().toLowerCase();
      if (txt === labelText.toLowerCase()) {
        // try to find associated button (previous sibling in structure)
        // structure in markup: <button role="checkbox" ...></button><input hidden ...><label for="id">Cleaning</label>
        const forId = lbl.htmlFor;
        if (forId) {
          // find button with matching id nearby
          const btn =
            document.getElementById(forId) ||
            document.querySelector(`button#${CSS.escape(forId)}`);
          if (btn && btn.getAttribute("role") === "checkbox") {
            return toggleRadixCheckbox(btn, checked);
          }
        }
        // fallback: find previous button sibling
        let prev = lbl.previousElementSibling;
        if (
          prev &&
          prev.getAttribute &&
          prev.getAttribute("role") === "checkbox"
        ) {
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
      const isChecked =
        btn.getAttribute("data-state") === "checked" ||
        btn.getAttribute("aria-checked") === "true";
      if ((isChecked && checked) || (!isChecked && !checked)) return true; // already in desired state
      // try to click the button to toggle
      btn.click();
      // highlight it
      highlightElement(btn);
      return true;
    } catch (e) {
      console.warn("[ELH-pasteJson] toggleRadixCheckbox failed", e);
      return false;
    }
  }
})();
