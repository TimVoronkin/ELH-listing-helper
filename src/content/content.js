console.log("[ELH-Tim] Site loaded! This is a test Chrome extension.");

// Ensure shared styles are injected once per page
function loadSharedStylesOnce() {
  try {
    const ID = 'elh-shared-styles';
    if (document.getElementById(ID)) return;
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/shared/buttons.css');
    document.head && document.head.appendChild(link);
  } catch (e) {
    console.warn('Failed to inject shared styles', e);
  }
}
loadSharedStylesOnce();

const elhPattern =
  /^https:\/\/www\.erasmuslifehousing\.com\/dashboard\/admin\/listings\/[\w-]+\/rooms\/form\/[\w-]+$/;
if (elhPattern.test(window.location.href)) {
  console.log("[ELH-Tim] ELH site opened!");
}

// Проверка наличия вкладки с Room Description

let roomDescriptionHandled = false;
function checkRoomDescription() {
  if (roomDescriptionHandled) return;
  // Ищем label или span с текстом 'Room Description'
  const roomDescLabel = Array.from(
    document.querySelectorAll("label, span")
  ).find(
    (el) => el.textContent && el.textContent.trim() === "Room Description"
  );
  if (roomDescLabel) {
    roomDescriptionHandled = true;
    console.log("[ELH-Tim] Room Description tab opened!");
  }
}

// Проверяем сразу после загрузки
checkRoomDescription();

// Также проверяем при изменении DOM (например, если вкладка открывается динамически)
const observer = new MutationObserver(() => {
  checkRoomDescription();
});
observer.observe(document.body, { childList: true, subtree: true });


function insertGeminiBtn() {
  // Найти <div class="space-y-6 pb-40" ...>
  const mainDiv = document.querySelector(
    'div.space-y-6.pb-40[data-sentry-component="PhotosStep"]'
  );
  if (!mainDiv) return;
  // Найти <p> с текстом 'Add images and basic information'
  const infoP = Array.from(mainDiv.querySelectorAll("p")).find(
    (el) =>
      el.textContent &&
      el.textContent.trim() === "Add images and basic information"
  );
  if (!infoP) return;
  // Проверить, не вставлена ли уже кнопка
  if (
    infoP.nextSibling &&
    infoP.nextSibling.classList &&
    infoP.nextSibling.classList.contains("gemini-btn")
  )
    return;

  // Создать кнопку
  const geminiBtn = document.createElement("button");
  geminiBtn.textContent = "Generate Name via description";
  geminiBtn.className = "elh-btn gemini-btn";

  // debounce / basic rate limiting per button
  let geminiLastCall = 0;
  let geminiBackoff = 0; // seconds
  geminiBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - geminiLastCall < 3000 + geminiBackoff * 1000) {
      // ignore quick repeated clicks
      return;
    }
    geminiLastCall = now;
    geminiBtn.disabled = true;
    geminiBtn.textContent = "Waiting for Gemini's response...";
    geminiBtn.style.background = "#b0b0b0";
    geminiBtn.style.color = "#eee";
    geminiBtn.style.pointerEvents = "none";
    // Получаем описание комнаты
    let roomDesc = "";
    const roomDescLabel = Array.from(
      document.querySelectorAll("label, span")
    ).find(
      (el) => el.textContent && el.textContent.trim() === "Room Description"
    );
    let textarea = null;
    if (roomDescLabel) {
      if (
        roomDescLabel.tagName.toLowerCase() === "label" &&
        roomDescLabel.htmlFor
      ) {
        textarea = document.getElementById(roomDescLabel.htmlFor);
      }
      if (!textarea) {
        textarea =
          roomDescLabel.parentElement &&
          roomDescLabel.parentElement.querySelector("textarea");
      }
      if (textarea && textarea.value) {
        roomDesc = textarea.value;
      }
    }
    if (!roomDesc) roomDesc = "Описание не найдено";
    // Формируем укороченный JSON-промпт (минимизируем токены)
    const promptObj = {
      instruction: "Make a concise room name from the description. Include room number if present.",
      input: { description: roomDesc },
      output_format: { new_room_name: "string" },
      constraints: { use_room_number: true }
    };
    const prompt = JSON.stringify(promptObj);

    // no caching: always request fresh result

    chrome.runtime.sendMessage(
      {
        action: "gemini_request",
        prompt: prompt,
      },
      function (response) {
        // handle possible rate-limit retry info
        if (response && response.error) {
          try {
            // if retryDelay provided (e.g., "39s"), parse seconds
            if (response.retryDelay && typeof response.retryDelay === 'string') {
              const m = response.retryDelay.match(/(\d+(?:\.\d+)?)s/);
              if (m) geminiBackoff = Math.max(geminiBackoff, Math.ceil(parseFloat(m[1])));
            }
          } catch (e) {}
        }
        geminiBtn.disabled = false;
        geminiBtn.textContent = "Generate Name via description";
        geminiBtn.style.background = "rgb(57 146 62)";
        geminiBtn.style.color = "rgb(255, 255, 255)";
        geminiBtn.style.pointerEvents = "auto";
        // Парсим чистый результат
        let result = "";
        // primary: candidates -> content -> parts[0].text
        if (
          response &&
          response.candidates &&
          response.candidates[0] &&
          response.candidates[0].content &&
          response.candidates[0].content.parts &&
          response.candidates[0].content.parts[0] &&
          response.candidates[0].content.parts[0].text
        ) {
          result = response.candidates[0].content.parts[0].text.trim();
        } else if (response && response.text) {
          result = response.text.trim();
        } else if (response && typeof response === 'string') {
          result = response.trim();
        } else if (response && typeof response === 'object') {
          // try common fields
          if (response.new_room_name && typeof response.new_room_name === 'string') {
            result = response.new_room_name.trim();
          } else {
            result = JSON.stringify(response);
          }
        }
        // If the result is a JSON string like '{"new_room_name":"..."}', try to parse and extract
        if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
          try {
            const parsed = JSON.parse(result);
            if (parsed && typeof parsed === 'object') {
              if (parsed.new_room_name && typeof parsed.new_room_name === 'string') {
                result = parsed.new_room_name.trim();
              } else {
                // try to find any string value in the object
                const vals = Object.values(parsed).filter(v => typeof v === 'string');
                if (vals.length === 1) result = vals[0].trim();
              }
            }
          } catch (e) {
            // not JSON — keep as-is
          }
        }
        console.log('Parsed Gemini result:', result);
        // Вставить результат в поле Room name
        const nameLabel = Array.from(document.querySelectorAll("label")).find(
          (el) => el.textContent && el.textContent.trim() === "Room name"
        );
        let nameInput = null;
        if (nameLabel && nameLabel.htmlFor) {
          nameInput = document.getElementById(nameLabel.htmlFor);
        }
        if (!nameInput) {
          nameInput =
            nameLabel &&
            nameLabel.parentElement &&
            nameLabel.parentElement.querySelector("input");
        }
        if (nameInput) {
          nameInput.value = result;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
          // no caching: do not store the result, always generate fresh
        }
      }
    );
  });

  // Создать кнопку, которая также добавляет первую картинку в промпт
  const geminiBtnImg = document.createElement("button");
  geminiBtnImg.textContent = "Generate Name via description+img1";
  geminiBtnImg.className = "elh-btn gemini-btn";

  geminiBtnImg.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    geminiBtnImg.disabled = true;
    geminiBtnImg.textContent = "Waiting for Gemini's response...";
    geminiBtnImg.style.background = "#b0b0b0";
    geminiBtnImg.style.color = "#eee";
    geminiBtnImg.style.pointerEvents = "none";
    // Получаем описание комнаты (same as other button)
    let roomDesc = "";
    const roomDescLabel = Array.from(
      document.querySelectorAll("label, span")
    ).find(
      (el) => el.textContent && el.textContent.trim() === "Room Description"
    );
    let textarea = null;
    if (roomDescLabel) {
      if (
        roomDescLabel.tagName.toLowerCase() === "label" &&
        roomDescLabel.htmlFor
      ) {
        textarea = document.getElementById(roomDescLabel.htmlFor);
      }
      if (!textarea) {
        textarea =
          roomDescLabel.parentElement &&
          roomDescLabel.parentElement.querySelector("textarea");
      }
      if (textarea && textarea.value) {
        roomDesc = textarea.value;
      }
    }
  if (!roomDesc) roomDesc = "Описание не найдено";

    // Try to find first image URL using same logic as copy-img
    let firstImgSrc = null;
    try {
      const imagesLabel = Array.from(document.querySelectorAll('label, span')).find(
        (el) => el.textContent && el.textContent.trim().startsWith('Images')
      );
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
          if (src) firstImgSrc = src;
        }
      }
    } catch (e) {
      console.error('find first image error', e);
    }

    // For image requests: load stored PROMPT_OBJ (if any), inject description and attach compressed image
    let promptObj = null;
    try {
      const stored = await new Promise((res) => chrome.storage.local.get(['PROMPT_OBJ'], (items) => res(items)));
      if (stored && stored.PROMPT_OBJ) {
        try {
          promptObj = JSON.parse(JSON.stringify(stored.PROMPT_OBJ)); // deep copy
        } catch (e) {
          promptObj = stored.PROMPT_OBJ;
        }
      }
    } catch (e) {
      console.warn('read PROMPT_OBJ error', e);
    }
    if (!promptObj) {
      // fallback minimal spec
      promptObj = {
        instruction: "Make a concise room name from the description. Include room number if present.",
        input: { description: roomDesc },
        output_format: { new_room_name: "string" },
        constraints: { use_room_number: true }
      };
    } else {
      // ensure input exists and set description
      if (!promptObj.input || typeof promptObj.input !== 'object') promptObj.input = {};
      promptObj.input.description = roomDesc;
    }

    // helper to compress image to JPEG data URL
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
        console.warn('compressImageToJpegDataUrl failed', e);
        return null;
      }
    }

    if (firstImgSrc) {
      try {
        const compressed = await compressImageToJpegDataUrl(firstImgSrc, 800, 0.65);
        if (compressed) promptObj.input.image = compressed;
        else promptObj.input.image = firstImgSrc;
      } catch (e) {
        promptObj.input.image = firstImgSrc;
      }
    }
    const prompt = JSON.stringify(promptObj);

    // no caching for image requests: always send a fresh request

    chrome.runtime.sendMessage(
      {
        action: "gemini_request",
        prompt: prompt,
      },
      function (response) {
        geminiBtnImg.disabled = false;
        geminiBtnImg.textContent = "Generate Name via description+img1";
        geminiBtnImg.style.background = "rgb(57 146 62)";
        geminiBtnImg.style.color = "rgb(255, 255, 255)";
        geminiBtnImg.style.pointerEvents = "auto";
        // Парсим чистый результат (reuse same parsing logic)
        let result = "";
        if (
          response &&
          response.candidates &&
          response.candidates[0] &&
          response.candidates[0].content &&
          response.candidates[0].content.parts &&
          response.candidates[0].content.parts[0] &&
          response.candidates[0].content.parts[0].text
        ) {
          result = response.candidates[0].content.parts[0].text.trim();
        } else if (response && response.text) {
          result = response.text.trim();
        } else if (response && typeof response === 'string') {
          result = response.trim();
        } else if (response && typeof response === 'object') {
          if (response.new_room_name && typeof response.new_room_name === 'string') {
            result = response.new_room_name.trim();
          } else {
            result = JSON.stringify(response);
          }
        }
        if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
          try {
            const parsed = JSON.parse(result);
            if (parsed && typeof parsed === 'object') {
              if (parsed.new_room_name && typeof parsed.new_room_name === 'string') {
                result = parsed.new_room_name.trim();
              } else {
                const vals = Object.values(parsed).filter(v => typeof v === 'string');
                if (vals.length === 1) result = vals[0].trim();
              }
            }
          } catch (e) {
            // not JSON — keep as-is
          }
        }
        console.log('Parsed Gemini result:', result);
        // Вставить результат в поле Room name
        const nameLabel = Array.from(document.querySelectorAll("label")).find(
          (el) => el.textContent && el.textContent.trim() === "Room name"
        );
        let nameInput = null;
        if (nameLabel && nameLabel.htmlFor) {
          nameInput = document.getElementById(nameLabel.htmlFor);
        }
        if (!nameInput) {
          nameInput =
            nameLabel &&
            nameLabel.parentElement &&
            nameLabel.parentElement.querySelector("input");
        }
        if (nameInput) {
          nameInput.value = result;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
          // no caching: do not store result
        }
      }
    );
  });

  // New button: generate short description from Room name + first image
  const geminiDescBtn = document.createElement('button');
  geminiDescBtn.textContent = 'Generate Description via name+img1';
  geminiDescBtn.className = 'elh-btn gemini-btn';

  geminiDescBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    geminiDescBtn.disabled = true;
    geminiDescBtn.textContent = "Waiting for Gemini's response...";
    geminiDescBtn.style.background = '#b0b0b0';
    geminiDescBtn.style.color = '#eee';
    geminiDescBtn.style.pointerEvents = 'none';

    // find the Room name value
    let roomName = '';
    const nameLabel = Array.from(document.querySelectorAll('label')).find(
      (el) => el.textContent && el.textContent.trim() === 'Room name'
    );
    let nameInput = null;
    if (nameLabel && nameLabel.htmlFor) nameInput = document.getElementById(nameLabel.htmlFor);
    if (!nameInput) {
      nameInput = nameLabel && nameLabel.parentElement && nameLabel.parentElement.querySelector('input');
    }
    if (nameInput && nameInput.value) roomName = nameInput.value;

    // find first image url (reuse logic)
    let firstImgSrc = null;
    try {
      const imagesLabel = Array.from(document.querySelectorAll('label, span')).find(
        (el) => el.textContent && el.textContent.trim().startsWith('Images')
      );
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
          if (src) firstImgSrc = src;
        }
      }
    } catch (e) { console.error('find first image error', e); }

    // load PROMPT_DESC_OBJ from storage
    let promptObj = null;
    try {
      const stored = await new Promise((res) => chrome.storage.local.get(['PROMPT_DESC_OBJ', 'PROMPT_OBJ'], (items) => res(items)));
      if (stored && stored.PROMPT_DESC_OBJ) {
        try { promptObj = JSON.parse(JSON.stringify(stored.PROMPT_DESC_OBJ)); } catch (e) { promptObj = stored.PROMPT_DESC_OBJ; }
      }
      // fallback: if no desc prompt, try to use PROMPT_OBJ as base
      if (!promptObj && stored && stored.PROMPT_OBJ) {
        try { promptObj = JSON.parse(JSON.stringify(stored.PROMPT_OBJ)); } catch (e) { promptObj = stored.PROMPT_OBJ; }
      }
    } catch (e) { console.warn('read PROMPT_DESC_OBJ error', e); }

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

    // attach compressed image if available
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
        console.warn('compressImageToJpegDataUrl failed', e);
        return null;
      }
    }

    if (firstImgSrc) {
      try {
        const compressed = await compressImageToJpegDataUrl(firstImgSrc, 800, 0.65);
        if (compressed) promptObj.input.image = compressed;
        else promptObj.input.image = firstImgSrc;
      } catch (e) {
        promptObj.input.image = firstImgSrc;
      }
    }

    const prompt = JSON.stringify(promptObj);

    chrome.runtime.sendMessage({ action: 'gemini_request', prompt: prompt }, function(response) {
      geminiDescBtn.disabled = false;
      geminiDescBtn.textContent = 'Generate Description via name+img1';
      geminiDescBtn.style.background = 'rgb(57 146 62)';
      geminiDescBtn.style.color = 'rgb(255, 255, 255)';
      geminiDescBtn.style.pointerEvents = 'auto';

      let result = '';
      if (response && response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].text) {
        result = response.candidates[0].content.parts[0].text.trim();
      } else if (response && response.text) {
        result = response.text.trim();
      } else if (response && typeof response === 'string') {
        result = response.trim();
      } else if (response && typeof response === 'object') {
        if (response.description && typeof response.description === 'string') result = response.description.trim();
        else result = JSON.stringify(response);
      }
      if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
        try {
          const parsed = JSON.parse(result);
          if (parsed && typeof parsed === 'object') {
            if (parsed.description && typeof parsed.description === 'string') result = parsed.description.trim();
            else {
              const vals = Object.values(parsed).filter(v => typeof v === 'string');
              if (vals.length === 1) result = vals[0].trim();
            }
          }
        } catch (e) {}
      }
      console.log('Parsed Gemini description result:', result);

      // insert into Room Description textarea
      const roomDescLabel = Array.from(document.querySelectorAll('label, span')).find((el) => el.textContent && el.textContent.trim() === 'Room Description');
      let textarea = null;
      if (roomDescLabel) {
        if (roomDescLabel.tagName.toLowerCase() === 'label' && roomDescLabel.htmlFor) textarea = document.getElementById(roomDescLabel.htmlFor);
        if (!textarea) textarea = roomDescLabel.parentElement && roomDescLabel.parentElement.querySelector('textarea');
      }
      if (textarea) {
        textarea.value = result;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });

  // Вставить кнопки после <p>
  // Try to insert buttons near the corresponding form fields (room name / room description)
  try {
    // Insert name buttons into the container that holds the 'Room name' label/input
    const nameLabel = Array.from(document.querySelectorAll('label, span')).find(
      (el) => el.textContent && el.textContent.trim() === 'Room name'
    );
    if (nameLabel && nameLabel.parentElement) {
      const nameParent = nameLabel.parentElement;
      // avoid duplicate controls
      if (!nameParent.querySelector('.elh-gemini-controls')) {
        const controls = document.createElement('div');
        controls.className = 'elh-gemini-controls';
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.marginTop = '8px';
        controls.appendChild(geminiBtn);
        controls.appendChild(geminiBtnImg);
        // Insert after the input wrapper if present, otherwise at the end
        const inputWrapper = nameParent.querySelector('div.relative') || nameParent.querySelector('input');
        if (inputWrapper && inputWrapper.parentNode) inputWrapper.parentNode.insertBefore(controls, inputWrapper.nextSibling);
        else nameParent.appendChild(controls);
      }
    }

    // Insert description button into the container that holds the 'Room Description' label/textarea
    const descLabel = Array.from(document.querySelectorAll('label, span')).find(
      (el) => el.textContent && el.textContent.trim() === 'Room Description'
    );
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
    // fallback: if DOM shape unexpected, insert after the info paragraph as before
    infoP.parentNode.insertBefore(geminiBtn, infoP.nextSibling);
    infoP.parentNode.insertBefore(geminiBtnImg, geminiBtn.nextSibling);
    infoP.parentNode.insertBefore(geminiDescBtn, geminiBtnImg.nextSibling);
  }
}

// Вставляем кнопку при загрузке и при изменении DOM
insertGeminiBtn();
const geminiObserver = new MutationObserver(() => {
  insertGeminiBtn();
});
geminiObserver.observe(document.body, { childList: true, subtree: true });

// --- Insert "copy img" buttons under each image and implement copy-to-clipboard ---
function insertCopyImageButtons() {
  try {
    const imagesLabel = Array.from(document.querySelectorAll('label, span')).find(
      (el) => el.textContent && el.textContent.trim().startsWith('Images')
    );
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
          setTimeout(() => {
            btn.textContent = origText;
            btn.disabled = false;
          }, 1500);
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
              setTimeout(() => {
                btn.textContent = origText;
                btn.disabled = false;
              }, 1500);
              return;
            } catch (err) {}
          }

          try {
            const imgBitmap = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = imgBitmap.width;
            canvas.height = imgBitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgBitmap, 0, 0);
            const blob2 = await new Promise((res) => canvas.toBlob(res, blob.type || 'image/png'));
            if (navigator.clipboard && window.ClipboardItem && blob2) {
              try {
                const item2 = new ClipboardItem({ [blob2.type]: blob2 });
                await navigator.clipboard.write([item2]);
                btn.textContent = 'img copied!';
                setTimeout(() => {
                  btn.textContent = origText;
                  btn.disabled = false;
                }, 1500);
                return;
              } catch (err) {}
            }
          } catch (err) {}

          try {
            const imgForCanvas = new Image();
            imgForCanvas.crossOrigin = 'anonymous';
            const imgLoadPromise = new Promise((resolve, reject) => {
              imgForCanvas.onload = () => resolve();
              imgForCanvas.onerror = () => reject(new Error('Image load error'));
            });
            imgForCanvas.src = src;
            await imgLoadPromise;
            const canvas2 = document.createElement('canvas');
            canvas2.width = imgForCanvas.naturalWidth || imgForCanvas.width;
            canvas2.height = imgForCanvas.naturalHeight || imgForCanvas.height;
            const ctx2 = canvas2.getContext('2d');
            ctx2.drawImage(imgForCanvas, 0, 0);
            const blob3 = await new Promise((res) => canvas2.toBlob(res, 'image/png'));
            if (blob3 && navigator.clipboard && window.ClipboardItem) {
              try {
                const item3 = new ClipboardItem({ [blob3.type]: blob3 });
                await navigator.clipboard.write([item3]);
                btn.textContent = 'img copied!';
                setTimeout(() => {
                  btn.textContent = origText;
                  btn.disabled = false;
                }, 1500);
                return;
              } catch (err) {}
            }
          } catch (err) {}

          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(src);
            btn.textContent = 'Link copied';
            setTimeout(() => {
              btn.textContent = origText;
              btn.disabled = false;
            }, 1500);
            return;
          } else {
            throw new Error('No clipboard available');
          }
        } catch (err) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(src);
              btn.textContent = 'Link copied';
            } else {
              btn.textContent = 'Failed';
            }
          } catch (err2) {
            btn.textContent = 'Failed';
          }
          setTimeout(() => {
            btn.textContent = origText;
            btn.disabled = false;
          }, 1500);
        }
      });
    });
  } catch (e) {
    console.error('insertCopyImageButtons error', e);
  }
}

// Запуск при загрузке + наблюдатель за DOM для динамической подгрузки изображений
insertCopyImageButtons();
const copyButtonsObserver = new MutationObserver(() => {
  insertCopyImageButtons();
});
copyButtonsObserver.observe(document.body, { childList: true, subtree: true });
