#!/usr/bin/env node
/**
 * Garde-fous de dépôt (lint métier) — échoue en CI si une règle produit/sécurité est violée :
 *  1. aucun secret serveur (service_role, sb_secret_) dans le code client/admin/partagé ;
 *  2. aucun terme technique du moteur dans les textes visibles par le client (FFmpeg, Deepgram, LLM, worker, queue…) ;
 *  3. aucun prix codé en dur dans l'app (les prix viennent de pricing_rules) ;
 *  4. aucun calcul monétaire en flottant (parseFloat) côté client/admin ;
 *  5. aucun fichier .env réel suivi par git.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const problems = [];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".expo", "build", "coverage"].includes(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(extname(p))) yield p;
  }
}
const isTest = (p) => /(^|\/)(test|tests|__tests__)\//.test(p) || /\.(test|spec)\.[tj]sx?$/.test(p);
/** Retire commentaires bloc et ligne (approximatif mais suffisant pour ces règles). */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const strings = (src) => [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]);

const clientish = ["apps/client/src", "apps/admin/src", "packages/ui/src", "packages/domain/src", "packages/api/src", "packages/config/src", "packages/payments/src", "packages/analytics/src"];
const customerFacing = ["apps/client/src", "packages/ui/src", "packages/domain/src"];

for (const base of clientish) {
  const dir = join(root, base);
  try { statSync(dir); } catch { continue; }
  for (const file of walk(dir)) {
    const rel = relative(root, file);
    const code = stripComments(readFileSync(file, "utf8"));
    if (isTest(rel)) continue;

    if (/service_role|sb_secret_[A-Za-z0-9]|SERVICE_ROLE_KEY/.test(code) && !/loadEnv|refus|interdit|reject/i.test(code)) problems.push(`${rel}: référence à un secret serveur dans du code client`);
    if (/parseFloat\(/.test(code) && /apps\/(client|admin)/.test(rel)) problems.push(`${rel}: parseFloat interdit (argent = centimes entiers)`);

    if (customerFacing.some((b) => rel.startsWith(b)) && !rel.includes("/lib/") && !/\/(logic|oauth|nav|queries|hooks|store-adapter|provider|useLiveSync)\.tsx?$/.test(rel)) {
      for (const s of strings(code)) {
        if (/\b(ffmpeg|deepgram|llm|executor|encoding pass|worker-\d)\b/i.test(s) || /\bqueue\b/i.test(s) && /\s/.test(s)) problems.push(`${rel}: terme technique visible par le client : « ${s.slice(0, 60)} »`);
        if (/\b(2[,.]42|4[,.]84|7[,.]00|9[,.]50|2[,.]90|5[,.]80)\s?(€|euros?)/i.test(s)) problems.push(`${rel}: prix codé en dur : « ${s.slice(0, 60)} »`);
      }
      if (/price_cents\s*[:=]\s*(242|484|700|950|290|580)\b/.test(code)) problems.push(`${rel}: price_cents codé en dur`);
    }
  }
}

try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n");
  for (const f of tracked) if (/(^|\/)\.env(\.[a-z]+)?$/.test(f) && !f.endsWith(".example")) problems.push(`${f}: fichier .env suivi par git`);
} catch { /* hors dépôt git */ }

if (problems.length) {
  console.error("✗ Garde-fous :\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log("✓ garde-fous OK (secrets, termes techniques, prix codés en dur, flottants, .env)");
