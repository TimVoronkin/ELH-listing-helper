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

    // Removed auxiliary buttons (screenshot, copy description, paste-to-name) per user request
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
  geminiBtn.textContent = "Generate Name via description";
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
