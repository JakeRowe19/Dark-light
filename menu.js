// ----- НАСТРОЙКИ -----

const CSV_URL_BASE = "/data/menu.csv";

const ITEMS_PER_SCREEN = 15;
const ORDER_CARD_POSITION = 40;

// чтение CSV → массив объектов
async function fetchCsv() {
  // добавляем "мусорный" параметр, чтобы URL всегда был уникален
  const url = CSV_URL_BASE + `?t=${Date.now()}`;

  const res = await fetch(url, {
    cache: "no-store",        // просим браузер не использовать кэш
  });

  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map(r => r.split(delimiter));

  const headers = rows[0].map(h => sanitize(h));
  const dataRows = rows.slice(1).filter(r => r[0].trim() !== "");

  return dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = sanitize(row[i] || "");
    });
    return obj;
  });
}

function getAccent(item) {
  const raw = (item["Акцент"] || "").trim().toLowerCase();
  if (!raw || raw === "-") return "";

  const file = ACCENT_BADGE[raw];
  if (!file) return "";

  return `<img class="accent-badge" src="img/${file}" alt="${raw}">`;
}



// соответствие beertype -> картинка бейджа
const BEERTYPE_BADGE = {
  "beertype=dark":    "beertype=dark.png",
  "beertype=darkNF":  "beertype=darkNF.png",
  "beertype=light":   "beertype=light.png",
  "beertype=lightNF": "beertype=lightNF.png",
  "beertype=other":   "beertype=other.png",
  "beertype=n/a":     "nonalc.png",
  "beertype=wheat":   "beertype=wheat.png",
  "beertype=cider":   "beertype=cider.png",
  "beertype=mead":   "beertype=mead.png"
};

const ACCENT_BADGE = {
  "новинка": "accent-new.png",
  "медаль": "medal.png",
  "хит": "accent-hit.png"
};

// ----- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -----

function stripQuotes(str) {
  if (str == null) return "";
  let s = String(str);

  // убираем одну пару внешних кавычек
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }

  // заменяем двойные кавычки внутри на одиночные
  s = s.replace(/""/g, '"');

  return s.trim();
}

function sanitize(value) {
  return stripQuotes(value);
}


// ----- МАППИНГ ПОЛЕЙ И СОСТОЯНИЙ -----


// Заголовок: в первую очередь столбец S "Наименование"
// (он уже содержит "1.Ратминское" и т.п.)
// если он вдруг пустой → подстрахуемся id + "название"
function formatTitle(item) {
  return item["Наименование"] || "";
}


// Строка "крепость + плотность":
// берём как есть из столбца R "Плотность°P"
function formatSpecs(item) {
  const abvRaw = Number(item["крепость"]);
  const ogRaw  = Number(item["плотность"]);
  
  const abv = abvRaw ? (abvRaw / 10).toFixed(1) + "%" : "";
  const og  = ogRaw ? ogRaw + "oG" : "";

  return [abv, og].filter(Boolean).join(" ");
}

function extractDiscountPercent(availabilityRaw) {
  const v = String(availabilityRaw || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  // ищем любое число перед %
  const m = v.match(/(\d+)\s*%/);
  if (!m) return 0;

  const p = Number(m[1]);
  if (!isFinite(p)) return 0;

  // защита от мусора
  return Math.max(0, Math.min(100, p));
}

function getState(item) {
  const raw = sanitize(item["Наличие"]);
  const v = String(raw || "").toLowerCase().trim();

  // если есть % — это скидка
  if (extractDiscountPercent(v) > 0) return "sale";

  if (v === "нет") return "pending";
  if (v === "да")  return "instock";

  // по умолчанию считаем "в наличии"
  return "instock";
}

function formatPrice(item) {
  // 1) Базовая цена
  const rawBase = item["цена"] || item["Цена"] || "";
  const cleaned = String(rawBase)
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  const base = parseFloat(cleaned);
  if (!isFinite(base)) return "";

  // 2) Скидка из "Наличие"
  const discountPercent = extractDiscountPercent(item["Наличие"]);

  // 3) Итоговая цена
  const coef = 1 - discountPercent / 100;
  const final = Math.round(base * coef);

  return final + "₽";
}


// Страна
function getCountry(item) {
  return sanitize(item["Страна"]);
}

function getId(item) {
  return item["id"] || "";
}

function getName(item) {
  return item["название"] || "";
}


// Бейдж
const TYPE_TO_BEERTYPE = {
  "темное":        "beertype=dark",
  "темное н/ф":    "beertype=darkNF",
  "светлое":       "beertype=light",
  "светлое н/ф":   "beertype=lightNF",
  "пшеничное":     "beertype=wheat",
  "сидр":          "beertype=cider",
  "Медовуха":      "beertype=mead",
  "Другое":        "beertype=other@,
  "б/а":           "beertype=n/a"
};


function getBadge(item) {
  // читаем из столбца "Тип"
  const rawType = sanitize(item["Тип"]);
  if (!rawType) return "";

  // нормализация
  const key = rawType
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const beertype = TYPE_TO_BEERTYPE[key];
  if (!beertype) return "";

  const file = BEERTYPE_BADGE[beertype];
  if (!file) return "";

  return `<img class="badge" src="img/${file}" alt="${key}">`;
}



// ----- ШАБЛОН КАРТОЧКИ -----

function cardTemplate(item) {
  const accent  = getAccent(item);
  const state   = getState(item);
  const id      = getId(item);
  const name    = getName(item);
  const specs   = formatSpecs(item);
  const country = getCountry(item);
  const badge   = getBadge(item);
  const price   = formatPrice(item);

  const priceHtml =
    state === "pending"
      ? `<span class="price-pending">В пути</span>`
      : `<span class="price">${price}</span>`;

  return `
    <div class="beer-card state-${state}">
      ${accent}
      <div class="card-top">
        <div class="title-id">${id}</div>
        <div class="title">${name}</div>
      </div>

      <div class="card-bottom">
        <div class="divider"></div>

        <div class="info-line">
          <span class="country">${country}</span>
          ${badge ? `<span class="badge-wrap">${badge}</span>` : ""}
        </div>

        <div class="info-line">
          <span class="abv">${specs}</span>
          ${priceHtml}
        </div>
      </div>
    </div>
  `;
}

function orderCardTemplate() {
  return `
    <div class="beer-card state-order">
      <div class="card-top">
        <div class="title">Цены указаны за литр</div>
      </div>

      <div class="card-bottom">
        <div class="divider"></div>

        <div class="info-line" style="justify-content:center; text-align:center;">
          <span class="order-text">
            А еще вы можете заглянуть в холодильники -->
          </span>
        </div>
      </div>
    </div>
  `;
}


// ----- РЕНДЕР ЭКРАНА -----

async function renderScreen(screenNumber) {
  const container = document.getElementById("menu");
  if (!container) return;

  const allItems = await fetchCsv();

  // сортируем по id
  allItems.sort((a, b) => Number(a["id"]) - Number(b["id"]));

  // +1 элемент: спец-карточка в конце
  const itemsWithOrder = [...allItems];
  const orderIndex = Math.max(0, (ORDER_CARD_POSITION || 1) - 1);

  // вставляем даже если позиция "после конца" — тогда просто станет последней
  const safeIndex = Math.min(orderIndex, itemsWithOrder.length);
  itemsWithOrder.splice(safeIndex, 0, { __custom: "order" });

  const start = (screenNumber - 1) * ITEMS_PER_SCREEN;
  const end   = start + ITEMS_PER_SCREEN;
  const items = itemsWithOrder.slice(start, end);

  container.innerHTML = items.map(item => {
    if (item.__custom === "order") return orderCardTemplate();
    return cardTemplate(item);
  }).join("");
}
