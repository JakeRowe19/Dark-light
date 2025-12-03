// ----- НАСТРОЙКИ -----

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcUeH0R2aQgSWh0hhjkHEF2j3vSmWaFn-vpEvdl3wmgZavajJXslZR7zB8a8Wk3r2cKkXolnIXrq14/pub?gid=0&single=true&output=csv";

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
  return str.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();
}

function sanitize(value) {
  if (value == null) return "";
  return stripQuotes(String(value));
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
  const display = sanitize(item["Наименование"]);
  if (display) return display;

  const id   = sanitize(item["id"]);
  const name = sanitize(item["название"]);
  return [id, name].filter(Boolean).join(". ");
}

// Строка "крепость + плотность":
// берём как есть из столбца R "Плотность°P"
function formatSpecs(item) {
  return sanitize(item["Плотность°P"]) || sanitize(item["Плотность °P"]);
}

// Цена
function formatPrice(item) {
  let p = sanitize(item["Цена₽"]) || sanitize(item["цена"]);
  if (!p) return "";

  if (!/₽/.test(p)) {
    p = p + "₽";
  }
  return p;
}

// Страна
function getCountry(item) {
  return sanitize(item["Страна"]);
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
  const state   = getState(item);
  const title   = formatTitle(item);
  const specs   = formatSpecs(item);
  const price   = formatPrice(item);
  const country = getCountry(item);
  const badge   = getBadge(item);

  return `
    <div class="beer-card state-${state}">
      <div class="title">${title}</div>

      <div class="divider"></div>

      <div class="info-line">
        <span class="country">${country}</span>
        ${badge ? `<span class="badge-wrap">${badge}</span>` : ""}
      </div>

      <div class="info-line">
        <span class="abv">${specs}</span>
        <span class="price">${price}</span>
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
