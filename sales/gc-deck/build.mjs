#!/usr/bin/env node
/**
 * Builds the GC sales deck in the Slides artifact format:
 *   <out>/project/deck.json + <out>/project/slides/<id>.html
 *
 *   node sales/gc-deck/build.mjs --out=<dir> [--offer=full|conversion|acquisition|growth]
 *                                            [--config=<other config.mjs>]
 *
 * Slides outside the chosen mode are written with `hidden`: still editable,
 * skipped when presenting and exporting. Publish the output folder to the
 * deck artifact (see README.md).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FACES, SECTIONS, SLIDES } from "./slides.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

if (!args.out) {
  console.error("Usage: node build.mjs --out=<dir> [--offer=full|conversion|acquisition|growth] [--config=<file>]");
  process.exit(1);
}

const configPath = args.config ? path.resolve(args.config) : new URL("./config.mjs", import.meta.url).pathname;
const { default: base } = await import(pathToFileURL(configPath).href);
const cfg = { ...base, offer: args.offer ?? base.offer };

const OFFERS = ["full", "conversion", "acquisition", "growth"];
if (!OFFERS.includes(cfg.offer)) {
  console.error(`Unknown offer "${cfg.offer}". Expected one of: ${OFFERS.join(", ")}`);
  process.exit(1);
}

const proofs = new Set(cfg.selectedProof[cfg.offer] ?? []);
const hasProspect = Boolean(cfg.prospectCompany);

function visible(slide) {
  const [group, offer] = slide.group.split(":");
  switch (group) {
    case "core":
    case "method":
    case "cta":
      return true;
    case "proof":
      return proofs.has(slide.id);
    case "overview":
      return cfg.offer === "full";
    case "offer":
      return cfg.offer === "full" || cfg.offer === offer;
    case "perso":
      return hasProspect;
    default:
      return false;
  }
}

const out = path.resolve(args.out);
await mkdir(path.join(out, "project", "slides"), { recursive: true });

const titles = {
  full: "GC — Systèmes de revenus digitaux",
  conversion: "GC Conversion — Systèmes de revenus digitaux",
  acquisition: "GC Acquisition — Systèmes de revenus digitaux",
  growth: "GC Growth System — Systèmes de revenus digitaux",
};

let number = 0;
for (const slide of SLIDES) {
  const shown = visible(slide);
  if (shown) number += 1;
  const ctx = { hidden: !shown, chapter: slide.chapter, num: shown ? String(number).padStart(2, "0") : "—" };
  const html = slide.render(cfg, ctx);
  await writeFile(path.join(out, "project", "slides", `${slide.id}.html`), `${html.trim()}\n`);
}

const deck = {
  v: 4,
  createdOnFiles: { v: 1, at: args.createdAt ?? new Date().toISOString().replace(/\.\d+Z$/, "Z") },
  title: hasProspect ? `${titles[cfg.offer]} — ${cfg.prospectCompany}` : titles[cfg.offer],
  order: SLIDES.map((slide) => slide.id),
  sections: SECTIONS,
  faces: FACES,
  designSystems: [],
};
await writeFile(path.join(out, "project", "deck.json"), `${JSON.stringify(deck, null, 2)}\n`);

console.log(`${deck.title}: ${number} slides shown, ${SLIDES.length - number} hidden → ${out}`);
