const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcUeH0R2aQgSWh0hhjkHEF2j3vSmWaFn-vpEvdl3wmgZavajJXslZR7zB8a8Wk3r2cKkXolnIXrq14/pub?gid=0&single=true&output=csv";

const BEERTYPE_BADGE = {
  "beertype=dark":    "beertype=dark.png",
  "beertype=darkNF":  "beertype=darkNF.png",
  "beertype=light":   "beertype=light.png",
  "beertype=lightNF": "beertype=lightNF.png",
  "beertype=other":   "beertype=other.png",
  "beertype=n/a":     "nonalc.png"
};

const ITEMS_PER_SCREEN = 15;

// ---------- чтение CSV ----------

async function fetchCsv() {
  const res = await fetch(CSV_URL);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map(r => r.split(delimiter));

  const headers = rows[0].map(h => stripQuotes(h.trim()));
  const dataRows = rows.slice(1).filter(r => r[0].trim() !== "");

  return dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const raw = (row[i] || "").trim();
      obj[h] = stripQuotes(raw);
    });
    return obj;
  });
}

function stripQuotes(str) {
  return str.replace(/^"+|"+$/g, "");
}

// ---------- маппинг полей ----------

function getState(item) {
  const v = (item["instock"] || "").toLowerCase();
  if (v.includes("sale")) return "sale";
  if (v.includes("no"))   return "pending";
  if (v.includes("yes"))  return "instock";
  return "instock";
}

function formatTitle(item) {
  // Используем исходный столбец "название"
  return item["название"] || item["Наименование"] || "";
}

function formatAbv(item) {
  // Берём исходную "крепость" (42 → 4.2%)
  const raw = Number(item["крепость"] || item["Крепость"]);
  if (!raw) return "";
  return (raw / 10).toFixed(1) + "%";
}

function formatOg(item) {
  const og =
    item["ПЛОТНОСТЬ"] ||
    item["Плотность"] ||
    item["Плотность°P"];
  if (!og) return "";
  return og + "°P";
}

function formatPrice(item) {
  // Берём исходную "цена"
  const raw = item["цена"] || item["Цена"] || item["Цена₽"];
  if (!raw) return "";

  let s = raw.toString();

  // если вдруг что-то типа "4 120" → берём второе число
  const m = s.match(/(\d+)\D+(\d+)/);
  if (m) s = m[2];

  // просто число → добавляем ₽
  if (/^\d+$/.test(s)) {
    return s + "₽";
  }

  // иначе возвращаем как есть
  return s;
}

function getCountry(item) {
  return item["Страна"] || "";
}

function getBadge(item) {
  const bt = item["beertype"];
  if (!bt) return "";
  const file = BEERTYPE_BADGE[bt];
  if (!file) return "";
  return `<img class="badge" src="img/${file}" alt="${bt}">`;
}

// ---------- шаблон карточки ----------

function cardTemplate(item) {
  const state   = getState(item);
  const title   = formatTitle(item);
  const abv     = formatAbv(item);
  const og      = formatOg(item);
  const price   = formatPrice(item);
  const country = getCountry(item);
  const badge   = getBadge(item);

  const specs = [abv, og].filter(Boolean).join(" ");

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

// ---------- рендер экрана ----------

async function renderScreen(screenNumber) {
  const container = document.getElementById("menu");
  if (!container) return;

  const allItems = await fetchCsv();

  allItems.sort((a, b) => Number(a["id"]) - Number(b["id"]));

  const start = (screenNumber - 1) * ITEMS_PER_SCREEN;
  const end   = start + ITEMS_PER_SCREEN;

  const items = allItems.slice(start, end);

  container.innerHTML = items.map(cardTemplate).join("");
}
