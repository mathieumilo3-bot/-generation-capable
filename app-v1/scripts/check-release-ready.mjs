#!/usr/bin/env node
/**
 * Barrière de mise en production / soumission : liste tout ce qui est encore un placeholder.
 *   npm run release:check          (exit 1 s'il reste quelque chose)
 * Vérifie : fiche App Store (store.config.json), pages juridiques (legal.config.json, --strict), fichiers de liens universels,
 * eas.json, identifiants de build. N'appelle aucun service externe.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const issues = [];
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);
const flag = (file, re, why) => { const t = read(file); if (t === null) issues.push(`${file} : fichier manquant`); else if (re.test(t)) issues.push(`${file} : ${why}`); };

flag("apps/client/store.config.json", /REMPLACER/, "placeholders « REMPLACER » à renseigner (société, contact, URL, compte de test)");
flag("apps/client/store.config.json", /example\.com/, "URL example.com");
flag("apps/client/eas.json", /REMPLACER/, "ascAppId App Store Connect à renseigner");
flag("web-public/.well-known/apple-app-site-association", /TEAMID|example/, "TEAMID / bundle id à renseigner (Universal Links)");
flag("web-public/.well-known/assetlinks.json", /REMPLACER|example/, "empreinte SHA-256 / package à renseigner (App Links)");
flag("web-public/legal.config.json", /example\.com/, "URL / e-mail example.com (brand.appUrl, brand.supportEmail)");

try {
  execFileSync("node", [join(root, "web-public/build.mjs"), "--strict"], { stdio: "pipe" });
} catch (e) { issues.push("web-public/legal.config.json : " + String(e.stderr ?? e.stdout).trim().split("\n").slice(0, 20).join(" | ")); }
try { execFileSync("node", [join(root, "web-public/build.mjs"), "--check"], { stdio: "pipe" }); }
catch { issues.push("web-public : pages juridiques générées obsolètes (npm run legal:build)"); }

const env = process.env;
for (const k of ["APP_BUNDLE_ID", "EAS_PROJECT_ID", "APP_LINK_DOMAIN"]) if (!env[k] || /example/.test(env[k])) issues.push(`variable ${k} non définie ou factice (EAS env / shell)`);

if (issues.length) { console.error("✗ Pas prêt pour la production — à traiter :\n" + issues.map((i) => "  - " + i).join("\n")); process.exit(1); }
console.log("✓ prêt : plus aucun placeholder détecté");
