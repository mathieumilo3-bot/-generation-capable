#!/usr/bin/env node
/**
 * Visual QA of every preview produced by the burn-in: 375 / 390 / 430 / 768
 * / 1440 px. Checks horizontal overflow, broken images, empty sections and
 * clipped headings or buttons; saves screenshots. Exit 1 on any defect.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const dir = process.argv[2] || "burnin-out";
const shots = process.argv[3] || "burnin-shots";
mkdirSync(shots, { recursive: true });
const cases = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")))
  .filter((c) => c.vitrine);

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const report = [];
let defects = 0;
for (const c of cases) {
  const row = { id: c.id, widths: {} };
  for (const width of [375, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
    await page.addInitScript(() => localStorage.setItem("gc-revenue-consent-v1", "refused"));
    try {
      await page.goto(c.vitrine, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForSelector("[data-testid=preview-site]", { timeout: 45_000 });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      const r = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        broken: [...document.querySelectorAll(".gcp img")].filter((i) => i.complete && i.naturalWidth === 0).length,
        emptySections: [...document.querySelectorAll(".gcp section")].filter((s) => s.innerText.trim().length < 3).length,
        clipped: [...document.querySelectorAll(".gcp h2, .gcp h3, .gcp h4, .gcp .gcp-btn")].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.slice(0, 40)),
        h1: document.querySelectorAll("h1").length,
      }));
      const bad = r.overflow > 0 || r.emptySections > 0 || r.clipped.length > 0 || r.h1 !== 1;
      if (bad) defects += 1;
      row.widths[width] = r;
      if (width === 390 || width === 1440) await page.screenshot({ path: `${shots}/${c.id}-${width}.png`, fullPage: true });
    } catch (error) {
      defects += 1;
      row.widths[width] = { error: String(error).slice(0, 200) };
    }
    await page.close();
  }
  report.push(row);
  console.log(c.id, JSON.stringify(row.widths));
}
await browser.close();
writeFileSync(`${shots}/visual-report.json`, JSON.stringify(report, null, 2));
console.log(`${cases.length} previews × 5 widths — ${defects} defect(s)`);
process.exit(defects ? 1 : 0);
