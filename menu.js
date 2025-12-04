// ----- НАСТРОЙКИ -----

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcUeH0R2aQgSWh0hhjkHEF2j3vSmWaFn-vpEvdl3wmgZavajJXslZR7zB8a8Wk3r2cKkXolnIXrq14/pub?output=csv";

const ITEMS_PER_SCREEN = 15;

// соответствие beertype -> картинка бейджа
const BEERTYPE_BADGE = {
  "beertype=dark":    "beertype=dark.png",
  "beertype=darkNF":  "beertype=darkNF.png",
  "beertype=light":   "beertype=light.png",
  "beertype=lightNF": "beertype=lightNF.png",
  "beertype=other":   "beertype=other.png",
  "beertype=n/a":     "nonalc.png"
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


// чтение CSV → массив объектов
async function fetchCsv() {
  const res = await fetch(CSV_URL);
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

// ----- МАППИНГ ПОЛЕЙ И СОСТОЯНИЙ -----

function getState(item) {
  const v = (item["instock"] || "").toLowerCase();
  if (v.includes("sale")) return "sale";
  if (v.includes("no"))   return "pending";
  if (v.includes("yes"))  return "instock";
  return "instock";
}

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
  const og  = ogRaw ? ogRaw + "°P" : "";

  return [abv, og].filter(Boolean).join(" ");
}


// Цена
function formatPrice(item) {
  const state = getState(item);               // instock / sale / pending

  // читаем сырые значения из таблицы
  const rawBase = item["цена"] || item["Цена"] || "";
  const rawFinal = item["Цена₽"] || "";       // формула из таблицы
  const rawCoef = item["скидка 10%"] || item["скидка"] || item["коэффициент"] || item["V"] || "";

  // нормализация: оставляем только цифры и точку
  const num = (str) => {
    if (!str) return NaN;
    const cleaned = String(str)
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? NaN : n;
  };

  const base = num(rawBase);
  const final = num(rawFinal);
  const coef = num(rawCoef);

  let price = NaN;

  // если в таблице есть нормальная финальная цена → берем её
  if (state === "sale" && !isNaN(final)) {
    price = final;
  }
  // если скидка, но финальная колонка сломана → считаем сами
  else if (state === "sale" && !isNaN(base) && !isNaN(coef)) {
    price = Math.round(base * coef);
  }
  // обычные позиции
  else if (!isNaN(base)) {
    price = base;
  }
  // если базовой нет — хотя бы финальную
  else if (!isNaN(final)) {
    price = final;
  }

  if (isNaN(price)) return "";
  return Math.round(price) + "₽";
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
function getBadge(item) {
  const bt = sanitize(item["beertype"]);
  if (!bt) return "";
  const file = BEERTYPE_BADGE[bt];
  if (!file) return "";
  return `<img class="badge" src="img/${file}" alt="${bt}">`;
}

// ----- ШАБЛОН КАРТОЧКИ -----

function cardTemplate(item) {
  const state   = getState(item);        // instock / sale / pending ...
  const id      = getId(item);
  const name    = getName(item);
  const specs   = formatSpecs(item);     // "4.2% 12°P"
  const price   = formatPrice(item);     // "120₽"
  const country = getCountry(item);
  const badge   = getBadge(item);        // <img ...> или ""
  console.log(item["цена"], item["Цена₽"], getState(item), formatPrice(item));
  const isPending = state === "pending";

  return `
    <div class="beer-card state-${state}">
      <div class="card-top">
        <div class="title-id">${id}</div>
        <div class="title">${name}</div>
      </div>

      <div class="card-bottom">
        <div class="divider"></div>

        ${
          isPending
            ? `
              <div class="pending-text">В пути</div>
            `
            : `
              <div class="info-line">
                <span class="country">${country}</span>
                ${badge ? `<span class="badge-wrap">${badge}</span>` : ""}
              </div>
              <div class="info-line">
                <span class="abv">${specs}</span>
                <span class="price">${price}</span>
              </div>
            `
        }
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

  const start = (screenNumber - 1) * ITEMS_PER_SCREEN;
  const end   = start + ITEMS_PER_SCREEN;
  const items = allItems.slice(start, end);

  container.innerHTML = items.map(cardTemplate).join("");
}
