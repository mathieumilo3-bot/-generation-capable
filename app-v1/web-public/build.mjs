#!/usr/bin/env node
/**
 * Générateur des pages juridiques publiques (FR) à partir de legal.config.json — source unique.
 *   node build.mjs            écrit les pages dans ce dossier (les champs vides deviennent « [À COMPLÉTER : …] »)
 *   node build.mjs --strict   échoue s'il reste un champ à compléter (à utiliser en production)
 *   node build.mjs --check    échoue si les pages versionnées ne correspondent plus à la configuration (CI)
 * Les textes sont des MODÈLES RÉDIGÉS POUR LA FRANCE (droit de la consommation, RGPD, LCEN) : ils doivent être relus par un
 * juriste avant publication — ils reposent sur des faits réels du produit (voir docs/PRIVACY_RETENTION.md).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PAGES } from "./legal-pages.mjs";

const dir = import.meta.dirname;
const cfg = JSON.parse(readFileSync(join(dir, "legal.config.json"), "utf8"));
const strict = process.argv.includes("--strict");
const check = process.argv.includes("--check");
const missing = new Set();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Valeur de configuration, ou marqueur visible si absente. */
const v = (path, label) => {
  const val = path.split(".").reduce((o, k) => (o == null ? o : o[k]), cfg);
  if (val === undefined || val === null || String(val).trim() === "") { missing.add(label ?? path); return `<mark>[À COMPLÉTER : ${esc(label ?? path)}]</mark>`; }
  return esc(val);
};
const ctx = { cfg, v, esc, H: cfg.retention.filesHours, HV: cfg.retention.videosHours };

const layout = (title, body) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ${esc(cfg.brand.productName)}</title><meta name="robots" content="index,follow"><link rel="stylesheet" href="style.css"></head>
<body><main>
<nav aria-label="Pages légales"><a href="mentions-legales.html">Mentions légales</a><a href="conditions.html">Conditions d'utilisation</a><a href="conditions-de-vente.html">Conditions de vente</a><a href="confidentialite.html">Confidentialité</a><a href="mes-donnees.html">Mes données</a><a href="supprimer-mon-compte.html">Supprimer mon compte</a></nav>
${body}
<p class="muted" style="margin-top:48px">Version du ${esc(cfg.effectiveDate)} · ${esc(cfg.brand.productName)}</p>
</main></body></html>
`;

const outputs = {};
for (const [file, page] of Object.entries(PAGES)) outputs[file] = layout(page.title, page.body(ctx));

if (check) {
  const stale = Object.entries(outputs).filter(([f, html]) => !existsSync(join(dir, f)) || readFileSync(join(dir, f), "utf8") !== html).map(([f]) => f);
  if (stale.length) { console.error("✗ Pages juridiques obsolètes (relancez `npm run legal:build`) :", stale.join(", ")); process.exit(1); }
  console.log("✓ pages juridiques à jour");
  process.exit(0);
}
if (strict && missing.size) { console.error("✗ Champs juridiques à compléter dans web-public/legal.config.json :\n  - " + [...missing].join("\n  - ")); process.exit(1); }
for (const [f, html] of Object.entries(outputs)) writeFileSync(join(dir, f), html);
console.log(`✓ ${Object.keys(outputs).length} pages générées` + (missing.size ? ` — ${missing.size} champ(s) à compléter : ${[...missing].join(", ")}` : " — configuration complète"));
