import { chromium } from "playwright";
import fs from "fs/promises";

const BASE_URL = "https://jakerowe19.github.io/Dark-light";

const VIEWPORT = {
  width: 3840,
  height: 2160,
};

const SCREENS = [
  { name: "screen1", path: "/screen1.html" },
  { name: "screen2", path: "/screen2.html" },
  { name: "screen3", path: "/screen3.html" },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await fs.mkdir("out", { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });

  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  for (const screen of SCREENS) {
    const url = BASE_URL + screen.path;

    console.log("Rendering:", url);

    await page.goto(url, { waitUntil: "networkidle" });

    // Ждём загрузку шрифтов
    try {
      await page.evaluate(() => document.fonts.ready);
    } catch {}

    // Даём время JS подтянуть Google Sheets и дорендерить карточки
    await wait(4000);

    await page.screenshot({
      path: `out/${screen.name}.png`,
      fullPage: false,
    });
  }

  await browser.close();
})();
