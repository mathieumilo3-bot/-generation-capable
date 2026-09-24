#!/usr/bin/env node
/**
 * Burn-in of the GC Preview Engine V2 against a REAL deployment, with REAL
 * companies. One case per invocation (the GitHub workflow runs them in a
 * matrix). Drives the public API exactly like the browser does, answers the
 * single precision question when asked, then checks the result:
 *
 *   identity (SIREN / city / official domain), anti-invention (numbers,
 *   labels, reviews, guarantees, superlatives), blueprint structure, every
 *   image through the proxy, e-mail registration, latency.
 *
 * Usage: node scripts/preview-burnin.mjs --base https://… --case '{"id":…}' --out dir
 * Exit code 1 when a critical check fails.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith("--") ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const BASE = (args.base || "").replace(/\/$/, "");
const c = JSON.parse(args.case || "{}");
const OUT = args.out || "burnin-out";
mkdirSync(OUT, { recursive: true });

const failures = [];
const warnings = [];
const timeline = [];
const t0 = Date.now();
const since = () => Math.round((Date.now() - t0) / 1000);
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function post(path, body) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: BASE },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json().catch(() => null);
      if (res.status >= 500 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 2_000));
        continue;
      }
      return { status: res.status, data };
    } catch (error) {
      if (attempt === 2) return { status: 0, data: null, error: String(error) };
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
}

function finish(extra = {}) {
  const summary = { id: c.id, name: c.name, trade: c.trade, ok: failures.length === 0, failures, warnings, seconds: since(), timeline, ...extra };
  writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ id: c.id, ok: summary.ok, failures, warnings, seconds: summary.seconds, level: extra.level, domain: extra.domain, city: extra.city }, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

// --- 0. homonym probes: the registry itself says whether the city must be asked
if (c.probeHomonym) {
  const LEGAL = new Set(["sarl", "sas", "sasu", "eurl", "sa", "sci", "ei", "eirl", "societe", "entreprise", "etablissements", "ets"]);
  const key = (v) => norm(v).split(" ").filter((t) => t && !LEGAL.has(t)).join(" ");
  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(c.name)}&per_page=12&minimal=true&include=siege`;
  const payload = await fetch(url).then((r) => r.json()).catch(() => ({ results: [] }));
  const exact = (payload.results || []).filter(
    (r) => r.etat_administratif !== "F" && [r.nom_complet, r.nom_raison_sociale, r.sigle, r.siege?.nom_commercial].some((n) => n && key(n) === key(c.name))
  );
  const cities = [...new Set(exact.map((r) => r.siege?.libelle_commune).filter(Boolean))];
  c.expectCityQuestion = cities.length > 1;
  c.city = c.city || cities[0] || "";
  timeline.push({ t: since(), event: `registre : ${exact.length} homonyme(s) exact(s) dans ${cities.length} ville(s)` });
}

// --- 1. start -------------------------------------------------------------
let askedCity = false;
let start = await post("/api/preview/start", { companyName: c.name, idempotencyKey: randomUUID(), consent: "UNSPECIFIED" });
timeline.push({ t: since(), event: `start ${start.status} ${start.data?.status ?? start.data?.error ?? ""}` });
if (start.data?.status === "needs_city") {
  askedCity = true;
  if (!c.city) {
    failures.push("ville demandée alors qu’aucune ville n’est connue pour ce cas");
    finish();
  }
  start = await post("/api/preview/start", { companyName: c.name, cityHint: c.city, idempotencyKey: randomUUID(), consent: "UNSPECIFIED" });
  timeline.push({ t: since(), event: `start+city ${start.status}` });
}
if (c.expectCityQuestion === true && !askedCity) warnings.push("homonymes attendus mais la ville n’a pas été demandée d’emblée");
if (c.expectCityQuestion === false && askedCity) failures.push("ville demandée alors que l’entreprise est unique au registre");
if (start.status !== 200 || !start.data?.id) {
  failures.push(`démarrage impossible (${start.status} ${JSON.stringify(start.data)})`);
  finish();
}
const { id, token } = start.data;

if (c.email) {
  const notify = await post("/api/preview/notify", { id, token, email: "delivered@resend.dev", consent: "UNSPECIFIED" });
  if (notify.data?.status !== "registered") failures.push(`e-mail non enregistré (${notify.status})`);
  timeline.push({ t: since(), event: "email registered" });
}

// --- 2. drive the pipeline --------------------------------------------------
let status = start.data.preview;
let lastStage = "";
let clarified = { city: false, site: false };
const deadline = Date.now() + 7 * 60_000;
while (Date.now() < deadline) {
  if (status?.stage !== lastStage) {
    timeline.push({ t: since(), event: `stage ${status?.stage}` });
    lastStage = status?.stage;
  }
  if (status?.status === "ready" || status?.status === "failed") break;
  if (status?.status === "needs_input") {
    timeline.push({ t: since(), event: `needs ${status.needs}` });
    let answer = null;
    if (status.needs === "city" && c.city && !clarified.city) {
      answer = { city: c.city };
      clarified.city = true;
    } else if (status.needs === "site" && !clarified.site) {
      answer = c.site ? { siteUrl: c.site } : { noSite: true };
      clarified.site = true;
      if (!c.expectNoSite) warnings.push("adresse du site demandée (identification web non concluante)");
    }
    if (!answer) {
      failures.push(`précision « ${status.needs} » demandée sans réponse possible`);
      break;
    }
    const res = await post("/api/preview/clarify", { id, token, ...answer });
    status = res.data?.preview ?? status;
    continue;
  }
  await new Promise((r) => setTimeout(r, 3_000));
  const res = await post("/api/preview/advance", { id, token });
  if (res.data?.preview) status = res.data.preview;
}
if (status?.status !== "ready") {
  failures.push(`pas prête après ${since()} s (statut ${status?.status}, étape ${status?.stage})`);
  finish();
}
const readySeconds = since();

// --- 3. result ----------------------------------------------------------------
const result = await post("/api/preview/result", { id, token });
const doc = result.data?.document;
const quality = result.data?.quality ?? {};
if (!doc) {
  failures.push("document absent");
  finish();
}
const bp = doc.blueprint;

// Identity
if (c.expectSiren && doc.site.siren !== c.expectSiren) failures.push(`SIREN ${doc.site.siren ?? "absent"} ≠ ${c.expectSiren}`);
if (c.expectCity && !norm(doc.site.city).includes(norm(c.expectCity)) && !norm(c.expectCity).includes(norm(doc.site.city))) {
  failures.push(`ville « ${doc.site.city ?? "absente"} » ≠ « ${c.expectCity} »`);
}
if (c.expectDomain) {
  const got = (doc.site.currentDomain || "").replace(/^www\./, "");
  if (!got) failures.push(`site officiel non retrouvé (attendu ${c.expectDomain})`);
  else if (got !== c.expectDomain.replace(/^www\./, "")) failures.push(`site ${got} ≠ ${c.expectDomain}`);
}
if (c.expectNoSite && doc.presenceLevel !== "C") warnings.push(`attendu sans site, niveau ${doc.presenceLevel} (${doc.site.currentDomain})`);

// Structure
if (!Array.isArray(bp.sections) || bp.sections.length > 8 || bp.sections.at(-1)?.type !== "cta") failures.push("structure de sections invalide");
if (!bp.hero?.headline) failures.push("hero vide");

// Anti-invention: everything the page says must be backed by the document.
const copy = JSON.stringify({ hero: bp.hero, services: bp.services, why: bp.why, area: bp.area, about: bp.about, finalCta: bp.finalCta, portfolio: bp.portfolio.heading, cta: [bp.primaryCta, bp.secondaryCta] });
const facts = norm(
  JSON.stringify({ site: doc.site, services: doc.services, trust: doc.trust, reviews: doc.reviews, zone: doc.zoneQuote, levers: doc.levers, provenance: doc.provenance })
);
const factDigits = new Set(facts.match(/\d+/g) ?? []);
for (const d of norm(copy.replace(/"(?:serviceId|factRef|leverId|imageAssetId|variant|type)":"[^"]*"/g, "")).match(/\d+/g) ?? []) {
  if (!factDigits.has(d)) failures.push(`nombre non justifié dans la page : ${d}`);
}
const text = norm(copy);
const rule = (re, allowed, label) => {
  if (re.test(text) && !allowed) failures.push(`affirmation non justifiée : ${label}`);
};
rule(/\bavis\b|etoiles|temoignage/, doc.reviews.length > 0, "avis");
rule(/decennale/, doc.trust.some((t) => t.kind === "insurance"), "décennale");
rule(/\brge\b|qualibat|qualipac|qualifelec|qualit enr|certifie|labellise/, doc.trust.some((t) => t.kind === "certification"), "label/certification");
rule(/\bn 1\b|numero un|leader|le meilleur|la meilleure|incontournable/, false, "superlatif");
rule(/ euros? |€|\bprix\b|\btarif/, false, "prix");
if (/gratuit|24 ?h|24 24|7 ?j|urgence/.test(text)) warnings.push("gratuit / urgence / 24-7 présent : autorisé seulement si le site le dit (vérifié par la garde serveur)");
for (const [assetId, asset] of Object.entries(doc.assets)) {
  if (!asset.src.startsWith("/api/preview/image?")) failures.push(`image non proxifiée : ${assetId}`);
}
if (/r[ée]alisation|chantier/i.test(bp.portfolio.heading) && bp.portfolio.assetIds.some((a) => doc.assets[a]?.kind !== "realisation")) {
  failures.push("photo non issue d’une page réalisations présentée comme réalisation");
}

// Images really load through the proxy
const imageUrls = [...Object.values(doc.assets).map((a) => a.src), ...(doc.site.logo ? [doc.site.logo.src] : [])];
let broken = 0;
for (const src of imageUrls) {
  try {
    const res = await fetch(`${BASE}${src}`, { signal: AbortSignal.timeout(15_000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) broken += 1;
  } catch {
    broken += 1;
  }
}
if (imageUrls.length && broken / imageUrls.length > 0.5) failures.push(`${broken}/${imageUrls.length} images indisponibles via le proxy`);
else if (broken) warnings.push(`${broken}/${imageUrls.length} images indisponibles (masquées proprement par le rendu)`);

if (readySeconds > 180) warnings.push(`prête en ${readySeconds} s (cible 60–120 s)`);

// Resume link works (same as the e-mail link).
const reopen = await post("/api/preview/result", { id, token });
if (reopen.data?.status !== "ready") failures.push("réouverture par lien impossible");

finish({
  level: doc.presenceLevel,
  tradeFamily: doc.tradeFamily,
  domain: doc.site.currentDomain ?? null,
  city: doc.site.city ?? null,
  siren: doc.site.siren ?? null,
  publicName: doc.site.name,
  headline: bp.hero.headline,
  sections: bp.sections.map((s) => `${s.type}:${s.variant}`),
  services: bp.services.items.length,
  photos: Object.keys(doc.assets).length,
  palette: doc.palette.source,
  askedCity,
  readySeconds,
  blueprintSource: quality.blueprintSource,
  rejections: (quality.rejections || []).map((r) => `${r.field}: ${r.reason}`),
  reusedFrom: quality.reusedFrom,
  errorCode: quality.errorCode,
  timings: quality.timings,
  vitrine: `${BASE}/audit/preview-v2/vitrine#id=${id}&t=${token}`,
});
