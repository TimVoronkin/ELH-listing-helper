console.log('[ELH-helper] [content] Site loaded!');

// Inject shared styles once
function loadSharedStylesOnce() {
  const ID = 'elh-shared-styles';
  if (document.getElementById(ID)) return;
  try {
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/shared/buttons.css');
    document.head && document.head.appendChild(link);
    } catch (err) {
    console.warn('[ELH-helper] [content] Failed to inject shared styles', err);
  }
}
loadSharedStylesOnce();

// Utilities
const qsAll = (sel) => Array.from(document.querySelectorAll(sel));
const findLabelOrSpan = (text) => qsAll('label, span').find((el) => el.textContent && el.textContent.trim() === text);
const findLabelStartsWith = (textStart) => qsAll('label, span').find((el) => el.textContent && el.textContent.trim().startsWith(textStart));

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function extractNamesFromResponse(response) {
  // Robust extraction: handle code fences, quoted strings, trailing commas, bare JSON, arrays, candidates, plain strings
  function stripCodeFences(s) {
    if (!s || typeof s !== 'string') return s;
    // remove ```json ... ``` or ``` ... ```
    s = s.replace(/```[\s\S]*?```/g, (m) => {
      // keep inner content
      return m.replace(/^```[a-zA-Z0-9]*\n?|\n?```$/g, '');
    });
    // remove single backticks
    s = s.replace(/`([^`]+)`/g, '$1');
    return s.trim();
  }

  function extractFirstJson(s) {
    if (!s || typeof s !== 'string') return null;
    const m = s.match(/(\{[\s\S]*?\})|(\[[\s\S]*?\])/);
    return m ? m[0] : null;
  }

  function splitCandidatesString(txt) {
    if (!txt) return null;
    // remove leading/trailing quotes and trailing commas
    txt = txt.replace(/^["'\s]+|["'\s,]+$/g, '').trim();
    // split by newlines first
    const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2) return lines.map(cleanName);
    // split by semicolon or bullet or numbered list markers
    const parts = txt.split(/[;\u2022\-\*\n,]\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.map(cleanName);
    return null;
  }

  function cleanName(n) {
    if (typeof n !== 'string') return '';
    let s = n.trim();
    // remove wrapping quotes and stray commas
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    // remove trailing commas or dots
    s = s.replace(/[\.,;:\s]+$/,'');
    // remove leading - or numbering like '1) '
    s = s.replace(/^\d+\)\s*/,'').replace(/^[-\u2013\u2014]\s*/,'');
    // remove surrounding code ticks/backticks
    s = s.replace(/^`+|`+$/g, '').trim();
    return s;
  }

  try {
    if (!response) return null;

    // If it's already an object with names
    if (typeof response === 'object' && response.names && Array.isArray(response.names)) return response.names.map(cleanName).filter(Boolean);

    // If response.text exists or candidate text, get the textual payload
    let textPayload = null;
    if (response && response.text && typeof response.text === 'string') textPayload = response.text;
    if (!textPayload && response && response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].text) {
      textPayload = response.candidates[0].content.parts[0].text;
    }
    if (!textPayload && typeof response === 'string') textPayload = response;

    if (textPayload) {
      textPayload = stripCodeFences(textPayload);
      // try extract JSON substring first
      const jsonSub = extractFirstJson(textPayload);
      if (jsonSub) {
        try {
          const parsed = JSON.parse(jsonSub);
          if (parsed && parsed.names && Array.isArray(parsed.names)) return parsed.names.map(cleanName).filter(Boolean);
          if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) return parsed.map(cleanName).filter(Boolean);
          // if object has string values, try to take them
          const stringVals = Object.values(parsed).filter(v => typeof v === 'string');
          if (stringVals.length >= 2) return stringVals.map(cleanName).filter(Boolean);
        } catch (e) { /* ignore JSON parse error */ }
      }

      // otherwise try to split by lines/commas etc
      const bySplit = splitCandidatesString(textPayload);
      if (bySplit && bySplit.length >= 1) return bySplit.map(cleanName).filter(Boolean);

      // try to extract quoted strings
      const quoteMatches = Array.from(textPayload.matchAll(/"([^\"]{2,200}?)"/g)).map(m => m[1]);
      if (quoteMatches && quoteMatches.length >= 1) return quoteMatches.map(cleanName).filter(Boolean);
    }

    } catch (e) {
    console.warn('[ELH-helper] [content] extractNamesFromResponse error', e);
  }
  return null;
}

function getInputForLabel(labelEl) {
  if (!labelEl) return null;
  if (labelEl.tagName.toLowerCase() === 'label' && labelEl.htmlFor) {
    const el = document.getElementById(labelEl.htmlFor);
    if (el) return el;
  }
  return labelEl.parentElement && labelEl.parentElement.querySelector('input, textarea');
}

// highlight helper: prefer shared module, otherwise fallback
function highlightElement(el, color = 'green') {
  try {
    if (!el) return;
    if (!window.ELH || typeof window.ELH.highlightElement !== 'function') {
      try {
        const id = 'elh-highlight-module';
        if (!document.getElementById(id)) {
          const s = document.createElement('script');
          s.id = id;
          s.src = chrome.runtime.getURL('src/content/shared/highlight.js');
          s.onload = function () {
            try { if (window.ELH && typeof window.ELH.highlightElement === 'function') window.ELH.highlightElement(el, color); } catch (e) {}
          };
          document.head && document.head.appendChild(s);
          // don't return: continue to apply local fallback immediately so UI shows highlighted state
        }
      } catch (e) {}
    }
    if (window.ELH && typeof window.ELH.highlightElement === 'function') { window.ELH.highlightElement(el, color); return; }

    // fallback
    if (!el || !el.style) return;
    if (color === 'orange') {
      el.style.border = '2px solid #ff8c00';
      el.style.boxShadow = '0 0 0 4px rgba(255,140,0,0.12)';
    } else {
      el.style.border = '2px solid #28a745';
      el.style.boxShadow = '0 0 0 4px rgba(40,167,69,0.12)';
    }
    el.style.outline = 'none';
  } catch (e) {}
}

function parseGeminiResponse(response, possibleKeys = ['new_room_name', 'description']) {
  let result = '';
  if (!response) return '';
  try {
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].text) {
      result = response.candidates[0].content.parts[0].text.trim();
    } else if (response.text) {
      result = response.text.trim();
    } else if (typeof response === 'string') {
      result = response.trim();
    } else if (typeof response === 'object') {
      for (const k of possibleKeys) {
        if (response[k] && typeof response[k] === 'string') {
          result = response[k].trim();
          break;
        }
      }
      if (!result) result = JSON.stringify(response);
    }

    // If JSON string, try to parse
    if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
      try {
        const parsed = JSON.parse(result);
        for (const k of possibleKeys) {
          if (parsed[k] && typeof parsed[k] === 'string') return parsed[k].trim();
        }
        const vals = Object.values(parsed).filter(v => typeof v === 'string');
        if (vals.length === 1) return vals[0].trim();
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.warn('[ELH-helper] [content] parseGeminiResponse error', e);
  }
  return result;
}

async function fetchStoredPrompt(key) {
  try {
    const res = await new Promise((resolve) => chrome.storage.local.get([key], (items) => resolve(items)));
    if (res && res[key]) return res[key];
  } catch (e) {
    console.warn('[ELH-helper] [content] fetchStoredPrompt error', e);
  }
  return null;
}

async function compressImageToJpegDataUrl(src, maxDim = 800, quality = 0.65) {
  try {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error('fetch failed: ' + resp.status);
    const blob = await resp.blob();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(blob);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    URL.revokeObjectURL(url);
    return dataUrl;
  } catch (e) {
    console.warn('[ELH-helper] [content] compressImageToJpegDataUrl failed', e);
    return null;
  }
}

function findFirstImageUrl() {
  try {
    const imagesLabel = findLabelStartsWith('Images');
    if (imagesLabel && imagesLabel.parentElement) {
      const container = imagesLabel.parentElement;
      const imgs = Array.from(container.querySelectorAll('img'));
      if (imgs && imgs.length > 0) {
        let src = imgs[0].getAttribute('src') || imgs[0].src || '';
        try {
          const parsed = new URL(src, location.origin);
          const proxied = parsed.searchParams.get('url');
          if (proxied) src = decodeURIComponent(proxied);
        } catch (err) {}
        if (src) return src;
      }
    }
  } catch (e) {
    console.error('[ELH-helper] [content] findFirstImageUrl error', e);
  }
  return null;
}

// Core: create and insert buttons but keep placement logic unchanged
function insertGeminiBtn() {
  const mainDiv = document.querySelector('div.space-y-6.pb-40[data-sentry-component="PhotosStep"]');
  if (!mainDiv) return;
  const infoP = Array.from(mainDiv.querySelectorAll('p')).find((el) => el.textContent && el.textContent.trim() === 'Add images and basic information');
  if (!infoP) return;

  // avoid double-insert
  if (infoP.nextSibling && infoP.nextSibling.classList && infoP.nextSibling.classList.contains('gemini-btn')) return;

  // buttons
  const geminiBtn = document.createElement('button');
  geminiBtn.textContent = '✦︎ Generate Name via description';
  geminiBtn.className = 'elh-btn gemini-btn';

  const geminiBtnImg = document.createElement('button');
  geminiBtnImg.textContent = '✦︎ Generate Name via description+img1';
  geminiBtnImg.className = 'elh-btn gemini-btn';

  const geminiDescBtn = document.createElement('button');
  geminiDescBtn.textContent = '✦︎ Generate Description via name+img1';
  geminiDescBtn.className = 'elh-btn gemini-btn';

  // Rate-limiting state for simple debounce/backoff
  let geminiLastCall = 0;
  let geminiBackoff = 0;

  async function handleNameGeneration({ includeImage = false, btn }) {
    try {
      const now = Date.now();
      if (now - geminiLastCall < 3000 + geminiBackoff * 1000) return;
      geminiLastCall = now;
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = "Waiting for Gemini's response...";
      btn.style.background = '#b0b0b0';
      btn.style.color = '#eee';
      btn.style.pointerEvents = 'none';

      // highlight target name input while Gemini is thinking
      let nameLabel = findLabelOrSpan('Room name');
      let nameInput = getInputForLabel(nameLabel);
      if (nameInput) {
        try { highlightElement(nameInput, 'orange'); } catch (e) {}
      }

      // get room description
      const roomDescLabel = findLabelOrSpan('Room Description');
      let textarea = getInputForLabel(roomDescLabel);
      let roomDesc = (textarea && textarea.value) ? textarea.value : '';
      if (!roomDesc) roomDesc = 'Описание не найдено';

      // Load stored prompt template for name generation
      let promptObj = await fetchStoredPrompt('PROMPT_OBJ');
      if (promptObj) {
        // ensure mutable copy
        try { promptObj = JSON.parse(JSON.stringify(promptObj)); } catch (e) {}
      }
      if (!promptObj) {
        // Default: request 3 distinct name suggestions as JSON
        promptObj = {
          instruction: 'Generate exactly 3 distinct, concise room title suggestions (3-7 words each) based on input.description. Use synonyms, vary word order, and emphasize different features (light, workspace, storage, view). Return valid JSON only in the form {"names":["...","...","..."]}. Do not include any explanatory text.',
          input: { description: roomDesc },
          output_format: { names: ['string'] },
          constraints: { use_room_number: true }
        };
      } else {
        if (!promptObj.input || typeof promptObj.input !== 'object') promptObj.input = {};
        promptObj.input.description = roomDesc;
      }

      if (includeImage) {
        const firstImgSrc = findFirstImageUrl();
        if (firstImgSrc) {
          const compressed = await compressImageToJpegDataUrl(firstImgSrc, 800, 0.65).catch(() => null);
          if (compressed) promptObj.input.image = compressed;
          else {
            try {
              const ss = await new Promise((res) => chrome.runtime.sendMessage({ action: 'capture_screenshot' }, (r) => res(r)));
              if (ss && ss.screenshot) promptObj.input.image = ss.screenshot;
              else promptObj.input.image = firstImgSrc;
            } catch (e) {
              promptObj.input.image = firstImgSrc;
            }
          }
        }
      }

      const prompt = JSON.stringify(promptObj);
      console.debug('[ELH-helper] [content] name generation prompt', promptObj);

      chrome.runtime.sendMessage({ action: 'gemini_request', prompt }, (response) => {
        // handle retry hint
        if (response && response.error && response.retryDelay && typeof response.retryDelay === 'string') {
          const m = response.retryDelay.match(/(\d+(?:\.\d+)?)s/);
          if (m) geminiBackoff = Math.max(geminiBackoff, Math.ceil(parseFloat(m[1])));
        }

        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.background = 'rgb(57 146 62)';
        btn.style.color = 'rgb(255, 255, 255)';
        btn.style.pointerEvents = 'auto';

        // Try to extract array of names and pick random one
        const names = extractNamesFromResponse(response);
        let chosen = '';
        if (names && Array.isArray(names) && names.length) {
          chosen = randomChoice(names).trim();
        } else {
          // fallback to single-field parsing
          const parsed = parseGeminiResponse(response, ['new_room_name']);
          chosen = parsed || '';
        }
        console.log('[ELH-helper] [content] Chosen room name:', chosen);

        // Insert chosen plain string into Room name field
        try {
          if (nameInput) {
            nameInput.value = chosen;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            try { highlightElement(nameInput, 'green'); } catch (e) {}
          } else {
            const nameLabel2 = findLabelOrSpan('Room name');
            const nameInput2 = getInputForLabel(nameLabel2);
            if (nameInput2) {
              nameInput2.value = chosen;
              nameInput2.dispatchEvent(new Event('input', { bubbles: true }));
              try { highlightElement(nameInput2, 'green'); } catch (e) {}
            }
          }
        } catch (e) { console.warn('[ELH-helper] [content] inserting name failed', e); }
      });

    } catch (e) {
      console.error('[ELH-helper] [content] handleNameGeneration error', e);
      try { btn.disabled = false; btn.style.pointerEvents = 'auto'; btn.textContent = '✦︎ Generate Name'; } catch (er) {}
    }
  }

  async function handleDescriptionGeneration(btn) {
    try {
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = "Waiting for Gemini's response...";
      btn.style.background = '#b0b0b0';
      btn.style.color = '#eee';
      btn.style.pointerEvents = 'none';

      // get room name
      const nameLabel = findLabelOrSpan('Room name');
      const nameInput = getInputForLabel(nameLabel);
      const roomName = nameInput && nameInput.value ? nameInput.value : '';

      // load prompt: try PROMPT_DESC_OBJ then PROMPT_OBJ
      let promptObj = await fetchStoredPrompt('PROMPT_DESC_OBJ');
      if (!promptObj) promptObj = await fetchStoredPrompt('PROMPT_OBJ');
      if (promptObj) try { promptObj = JSON.parse(JSON.stringify(promptObj)); } catch (e) {}
      if (!promptObj) {
        promptObj = {
          instruction: 'Write a short, engaging room description in English based on the room name and optional image. Keep it to 2-3 short sentences.',
          input: { room_name: roomName },
          output_format: { description: 'string' }
        };
      } else {
        if (!promptObj.input || typeof promptObj.input !== 'object') promptObj.input = {};
        promptObj.input.room_name = roomName || promptObj.input.room_name || '';
      }

      const firstImgSrc = findFirstImageUrl();
      if (firstImgSrc) {
        const compressed = await compressImageToJpegDataUrl(firstImgSrc, 800, 0.65).catch(() => null);
        if (compressed) promptObj.input.image = compressed;
        else {
          try {
            const ss = await new Promise((res) => chrome.runtime.sendMessage({ action: 'capture_screenshot' }, (r) => res(r)));
            if (ss && ss.screenshot) promptObj.input.image = ss.screenshot;
            else promptObj.input.image = firstImgSrc;
          } catch (e) { promptObj.input.image = firstImgSrc; }
        }
      }

      const prompt = JSON.stringify(promptObj);
      console.debug('[ELH-helper] [content] description prompt', promptObj);

      // highlight description textarea while Gemini is thinking
      const roomDescLabelPending = findLabelOrSpan('Room Description');
      const textareaPending = getInputForLabel(roomDescLabelPending);
      if (textareaPending) {
        try { highlightElement(textareaPending, 'orange'); } catch (e) {}
      }

      chrome.runtime.sendMessage({ action: 'gemini_request', prompt }, (response) => {
        btn.disabled = false;
        btn.textContent = orig;
        btn.style.background = 'rgb(57 146 62)';
        btn.style.color = 'rgb(255, 255, 255)';
        btn.style.pointerEvents = 'auto';

        const parsed = parseGeminiResponse(response, ['description']);
        console.log('[ELH-helper] [content] Parsed Gemini description result:', parsed);

        const roomDescLabel = findLabelOrSpan('Room Description');
        const textarea = getInputForLabel(roomDescLabel);
        if (textarea) {
          textarea.value = parsed;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          try { highlightElement(textarea, 'green'); } catch (e) {}
        }
      });

    } catch (e) {
      console.error('[ELH-helper] [content] handleDescriptionGeneration error', e);
      try { btn.disabled = false; btn.style.pointerEvents = 'auto'; btn.textContent = '✦︎ Generate Description'; } catch (er) {}
    }
  }

  geminiBtn.addEventListener('click', (e) => handleNameGeneration({ includeImage: false, btn: geminiBtn }));
  geminiBtnImg.addEventListener('click', (e) => handleNameGeneration({ includeImage: true, btn: geminiBtnImg }));
  geminiDescBtn.addEventListener('click', (e) => handleDescriptionGeneration(geminiDescBtn));

  // Insert controls close to form fields (preserve original placement logic)
  try {
    const nameLabel = findLabelOrSpan('Room name');
    if (nameLabel && nameLabel.parentElement) {
      const nameParent = nameLabel.parentElement;
      if (!nameParent.querySelector('.elh-gemini-controls')) {
        const controls = document.createElement('div');
        controls.className = 'elh-gemini-controls';
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.marginTop = '8px';
        controls.appendChild(geminiBtn);
        controls.appendChild(geminiBtnImg);
        const inputWrapper = nameParent.querySelector('div.relative') || nameParent.querySelector('input');
        if (inputWrapper && inputWrapper.parentNode) inputWrapper.parentNode.insertBefore(controls, inputWrapper.nextSibling);
        else nameParent.appendChild(controls);
      }
    }

    const descLabel = findLabelOrSpan('Room Description');
    if (descLabel && descLabel.parentElement) {
      const descParent = descLabel.parentElement;
      if (!descParent.querySelector('.elh-gemini-controls')) {
        const controlsDesc = document.createElement('div');
        controlsDesc.className = 'elh-gemini-controls';
        controlsDesc.appendChild(geminiDescBtn);
        const textareaWrapper = descParent.querySelector('div.relative') || descParent.querySelector('textarea');
        if (textareaWrapper && textareaWrapper.parentNode) textareaWrapper.parentNode.insertBefore(controlsDesc, textareaWrapper.nextSibling);
        else descParent.appendChild(controlsDesc);
      }
    }
  } catch (e) {
    // fallback: insert near info paragraph
    infoP.parentNode.insertBefore(geminiBtn, infoP.nextSibling);
    infoP.parentNode.insertBefore(geminiBtnImg, geminiBtn.nextSibling);
    infoP.parentNode.insertBefore(geminiDescBtn, geminiBtnImg.nextSibling);
  }
}

insertGeminiBtn();
const geminiObserver = new MutationObserver(() => insertGeminiBtn());
geminiObserver.observe(document.body, { childList: true, subtree: true });

// --- Insert "copy img" buttons under each image and implement copy-to-clipboard ---
function insertCopyImageButtons() {
  try {
    const imagesLabel = findLabelStartsWith('Images');
    if (!imagesLabel) return;
    const container = imagesLabel.parentElement;
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('img'));
    if (!imgs || imgs.length === 0) return;

    imgs.forEach((img) => {
      const tile = img.closest('.group') || img.parentElement || img;
      if (!tile) return;
      if (tile.querySelector('.elh-copy-img-btn')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'elh-btn elh-copy-img-btn small';
      btn.textContent = 'copy img';

      const imgWrapper = img.closest('.aspect-square') || img.parentElement;
      const insertParent = imgWrapper && imgWrapper.parentElement ? imgWrapper.parentElement : tile;
      insertParent.appendChild(btn);

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'copying...';

        let src = img.getAttribute('src') || img.src || '';
        try {
          const parsed = new URL(src, location.origin);
          const proxied = parsed.searchParams.get('url');
          if (proxied) src = decodeURIComponent(proxied);
        } catch (err) {}

        if (!src) {
          btn.textContent = 'No image URL';
          setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
          return;
        }

        try {
          const resp = await fetch(src);
          if (!resp.ok) throw new Error('fetch failed: ' + resp.status);
          const blob = await resp.blob();

          if (navigator.clipboard && window.ClipboardItem) {
            try {
              const item = new ClipboardItem({ [blob.type]: blob });
              await navigator.clipboard.write([item]);
              btn.textContent = 'img copied!';
              setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
              return;
            } catch (err) {}
          }

          try {
            const imgBitmap = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = imgBitmap.width; canvas.height = imgBitmap.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(imgBitmap, 0, 0);
            const blob2 = await new Promise((res) => canvas.toBlob(res, blob.type || 'image/png'));
            if (navigator.clipboard && window.ClipboardItem && blob2) {
              try { const item2 = new ClipboardItem({ [blob2.type]: blob2 }); await navigator.clipboard.write([item2]); btn.textContent = 'img copied!'; setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500); return; } catch (err) {}
            }
          } catch (err) {}

          try {
            const imgForCanvas = new Image(); imgForCanvas.crossOrigin = 'anonymous';
            const p = new Promise((resolve, reject) => { imgForCanvas.onload = () => resolve(); imgForCanvas.onerror = () => reject(new Error('Image load error')); });
            imgForCanvas.src = src; await p;
            const canvas2 = document.createElement('canvas'); canvas2.width = imgForCanvas.naturalWidth || imgForCanvas.width; canvas2.height = imgForCanvas.naturalHeight || imgForCanvas.height;
            const ctx2 = canvas2.getContext('2d'); ctx2.drawImage(imgForCanvas, 0, 0);
            const blob3 = await new Promise((res) => canvas2.toBlob(res, 'image/png'));
            if (blob3 && navigator.clipboard && window.ClipboardItem) {
              try { const item3 = new ClipboardItem({ [blob3.type]: blob3 }); await navigator.clipboard.write([item3]); btn.textContent = 'img copied!'; setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500); return; } catch (err) {}
            }
          } catch (err) {}

          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(src);
            btn.textContent = 'Link copied';
            setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
            return;
          } else {
            throw new Error('No clipboard available');
          }
        } catch (err) {
          try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(src); btn.textContent = 'Link copied'; } else btn.textContent = 'Failed'; } catch (err2) { btn.textContent = 'Failed'; }
          setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
        }
      });
    });

  } catch (e) {
    console.error('[ELH-helper] [content] insertCopyImageButtons error', e);
  }
}

insertCopyImageButtons();
const copyButtonsObserver = new MutationObserver(() => insertCopyImageButtons());
copyButtonsObserver.observe(document.body, { childList: true, subtree: true });
