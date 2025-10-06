console.log("[ELH-Tim] Site loaded! This is a test Chrome extension.");

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
    /*
		// --- Копирование описания комнаты (закомментировано) ---
		let textarea = null;
		if (roomDescLabel.tagName.toLowerCase() === 'label' && roomDescLabel.htmlFor) {
			textarea = document.getElementById(roomDescLabel.htmlFor);
		}
		textarea = roomDescLabel.parentElement && roomDescLabel.parentElement.querySelector('textarea');
		if (textarea && textarea.value) {
			// ...existing code...
		}
		*/

    // --- Копирование первого изображения по клику ---
    const firstImg = document.querySelector("img");
    if (firstImg) {
      // Создаем кнопку для копирования
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy Image";
      copyBtn.style.position = "absolute";
      copyBtn.style.top = "10px";
      copyBtn.style.left = "10px";
      copyBtn.style.zIndex = "9999";
      copyBtn.style.background = "#1976d2";
      copyBtn.style.color = "#fff";
      copyBtn.style.border = "none";
      copyBtn.style.padding = "8px 12px";
      copyBtn.style.borderRadius = "6px";
      copyBtn.style.cursor = "pointer";

      // Вставляем кнопку в DOM рядом с изображением
      firstImg.parentElement.style.position = "relative";
      firstImg.parentElement.appendChild(copyBtn);

      copyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        const imgUrl = firstImg.src;
        navigator.clipboard
          .writeText(imgUrl)
          .then(() => {
            console.log("[ELH-Tim] First image URL copied to clipboard!");
            copyBtn.textContent = "URL Copied!";
            setTimeout(() => {
              copyBtn.textContent = "Copy Image";
            }, 1500);
          })
          .catch((err) => {
            console.warn("[ELH-Tim] Failed to copy image URL:", err);
          });
      });
    } else {
      console.warn("[ELH-Tim] No image found to copy.");
    }
    // --- Flex-контейнер для кнопок ---
    const flexBox = document.createElement("div");
    flexBox.style.display = "flex";
    flexBox.style.gap = "16px";
    flexBox.style.marginTop = "32px";
    flexBox.style.justifyContent = "flex-start";
    flexBox.style.alignItems = "flex-start";
    flexBox.style.flexDirection = "column";
    // Find the main block and append the flexBox as the last child
    const mainBlock = document.querySelector(
      ".bg-white.flex-col.p-5.h-fit.hidden.md\\:flex.rounded-md.min-w-64.w-64.sticky.top-0"
    );
    if (mainBlock && !mainBlock.querySelector(".copilot-flexbox")) {
      mainBlock.appendChild(flexBox);
    } else {
      roomDescLabel.parentElement.appendChild(flexBox);
    }

    // Общие стили для кнопок
    const baseBtnStyle = {
      color: "#fff",
      border: "none",
      padding: "10px 20px",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: "bold",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      transition: "background 0.2s",
    };

    // --- Кнопка для скриншота ---
    const screenshotBtn = document.createElement("button");
    screenshotBtn.textContent = "Copy Screenshot";
    screenshotBtn.style.background = "#235926";
    Object.assign(screenshotBtn.style, baseBtnStyle);
    flexBox.appendChild(screenshotBtn);

    // --- Кнопка для копирования описания комнаты ---
    const copyDescBtn = document.createElement("button");
    copyDescBtn.textContent = "Copy Description";
    copyDescBtn.style.background = "#39923e";
    Object.assign(copyDescBtn.style, baseBtnStyle);
    flexBox.appendChild(copyDescBtn);

    // --- Кнопка для вставки из буфера в поле названия комнаты ---
    const pasteNameBtn = document.createElement("button");
    pasteNameBtn.textContent = "Paste to Name";
    pasteNameBtn.style.background = "#4bbd50";
    Object.assign(pasteNameBtn.style, baseBtnStyle);
    flexBox.appendChild(pasteNameBtn);

    pasteNameBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        // Ищем label 'Room name' и input по for
        const nameLabel = Array.from(document.querySelectorAll("label")).find(
          (el) => el.textContent && el.textContent.trim() === "Room name"
        );
        let nameInput = null;
        if (nameLabel && nameLabel.htmlFor) {
          nameInput = document.getElementById(nameLabel.htmlFor);
        }
        if (!nameInput) {
          // Если не нашли по htmlFor, ищем input внутри блока
          nameInput =
            nameLabel &&
            nameLabel.parentElement &&
            nameLabel.parentElement.querySelector("input");
        }
        if (nameInput) {
          nameInput.value = text;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
          pasteNameBtn.textContent = "Pasted!";
          setTimeout(() => {
            pasteNameBtn.textContent = "Paste to Name";
          }, 1500);
          console.log("[ELH-Tim] Clipboard content pasted to room name field!");
        } else {
          console.warn("[ELH-Tim] Room name field not found for paste.");
        }
      } catch (err) {
        console.warn("[ELH-Tim] Failed to read clipboard:", err);
      }
    });

    copyDescBtn.addEventListener("click", function (e) {
      e.preventDefault();
      // Ищем textarea с описанием
      let textarea = null;
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
        navigator.clipboard
          .writeText(textarea.value)
          .then(() => {
            console.log("[ELH-Tim] Room description copied to clipboard!");
            copyDescBtn.textContent = "Description Copied!";
            setTimeout(() => {
              copyDescBtn.textContent = "Copy Description";
            }, 1500);
          })
          .catch((err) => {
            console.warn("[ELH-Tim] Failed to copy room description:", err);
          });
      } else {
        console.warn("[ELH-Tim] Room description not found to copy.");
      }
    });

    screenshotBtn.addEventListener("click", function (e) {
      e.preventDefault();
      chrome.runtime.sendMessage(
        { action: "capture_screenshot" },
        function (response) {
          if (response && response.screenshot) {
            // Создаем изображение из dataURL
            const img = new Image();
            img.onload = function () {
              // Обрезаем с 367 по X и с 300 по Y
              const cropX = 367;
              const cropY = 300;
              const cropWidth = img.width - cropX;
              const cropHeight = img.height - cropY;
              const canvas = document.createElement("canvas");
              canvas.width = cropWidth;
              canvas.height = cropHeight;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(
                img,
                cropX,
                cropY,
                cropWidth,
                cropHeight,
                0,
                0,
                cropWidth,
                cropHeight
              );
              canvas.toBlob(function (blob) {
                const item = new ClipboardItem({ [blob.type]: blob });
                navigator.clipboard
                  .write([item])
                  .then(() => {
                    console.log(
                      "[ELH-Tim] Cropped screenshot copied to clipboard!"
                    );
                    screenshotBtn.textContent = "Screenshot Copied!";
                    setTimeout(() => {
                      screenshotBtn.textContent = "Screenshot";
                    }, 1500);
                  })
                  .catch((err) => {
                    console.warn("[ELH-Tim] Failed to copy screenshot:", err);
                  });
              }, "image/png");
            };
            img.onerror = function () {
              console.warn("[ELH-Tim] Error loading screenshot for cropping.");
            };
            img.src = response.screenshot;
          } else {
            console.warn("[ELH-Tim] Failed to get screenshot.");
          }
        }
      );
    });
  }
}

// Проверяем сразу после загрузки
checkRoomDescription();

// Также проверяем при изменении DOM (например, если вкладка открывается динамически)
const observer = new MutationObserver(() => {
  checkRoomDescription();
});
observer.observe(document.body, { childList: true, subtree: true });

// --- Кнопка Gemini справа от label Room name ---

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
  geminiBtn.textContent = "Generate Name w Gemini";
  geminiBtn.className = "gemini-btn";
  geminiBtn.style.background = "rgb(57 146 62)";
  geminiBtn.style.color = "rgb(255, 255, 255)";
  geminiBtn.style.border = "none";
  geminiBtn.style.padding = "8px 18px";
  geminiBtn.style.borderRadius = "8px";
  geminiBtn.style.cursor = "pointer";
  geminiBtn.style.fontSize = "16px";
  geminiBtn.style.fontWeight = "bold";
  geminiBtn.style.verticalAlign = "middle";
  geminiBtn.style.position = "relative";

  geminiBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
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
    // Формируем JSON-промпт
    const promptObj = {
      instruction:
        "Generate a natural room name based on the provided description, ensuring it matches the room's features. Use the room number from the original description. Follow the style of provided examples like 'Bright Double Room X with Balcony & Desk' or 'Cozy Single Room X with Wardrobe & Lamp'. Avoid repeating names, especially consecutively, and vary the mentioned elements (e.g., balcony, desk, window) based on what stands out most. Only include a bright or distinctive wall/floor color if explicitly mentioned in the description. Return only the new room name.",
      input: {
        description: roomDesc,
      },
      output_format: {
        new_room_name: "string",
      },
      examples: [
        {
          input: {
            description:
              "Room 7 is a small room with a single bed, a desk, and a large window.",
          },
          output: {
            new_room_name: "Bright Single Room 7 with Large Window & Desk",
          },
        },
        {
          input: {
            description: "Room 12 has two beds, a blue wall, and a balcony.",
          },
          output: {
            new_room_name: "Spacious Twin Room 12 with Blue Wall & Balcony",
          },
        },
      ],
      constraints: {
        use_room_number: true,
        avoid_repeating_names: true,
        include_color_only_if_mentioned: true,
      },
    };
    const prompt = JSON.stringify(promptObj);

    chrome.runtime.sendMessage(
      {
        action: "gemini_request",
        prompt: prompt,
      },
      function (response) {
        geminiBtn.disabled = false;
        geminiBtn.textContent = "Generate Name with Gemini AI";
        geminiBtn.style.background = "rgb(57 146 62)";
        geminiBtn.style.color = "rgb(255, 255, 255)";
        geminiBtn.style.pointerEvents = "auto";
        // Парсим чистый результат
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
        } else {
          result = JSON.stringify(response);
        }
        console.log(result);
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
        }
      }
    );
  });

  // Вставить кнопку после <p>
  infoP.parentNode.insertBefore(geminiBtn, infoP.nextSibling);
}

// Вставляем кнопку при загрузке и при изменении DOM
insertGeminiBtn();
const geminiObserver = new MutationObserver(() => {
  insertGeminiBtn();
});
geminiObserver.observe(document.body, { childList: true, subtree: true });
