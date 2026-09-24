import { crc32, deflateSync } from "node:zlib";
import { verifyOfficialSite, type CompanyDiscoveryCandidate } from "@/lib/audit-engine/company-discovery";
import type { RegistryCandidate, RegistryPreflight } from "@/lib/audit-engine/company-registry";
import { crawlSite } from "@/lib/audit-engine/crawl";
import { siteOnlyDiagnostic, toAuditContext } from "@/lib/audit-engine/diagnostic";
import type { FetchHtmlResult } from "@/lib/audit-engine/probe";
import type { PipelineDeps } from "./pipeline";
import type { PreviewRow } from "./store";

/**
 * Offline fixtures for development and end-to-end tests (GC_PREVIEW_FIXTURES=1,
 * never honoured in production). They replace only the network edges —
 * registry, web search, page fetches, model jobs — so the REAL crawler,
 * extractors, profile builder, validator and renderer all run.
 */

export function fixturesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.GC_PREVIEW_FIXTURES === "1";
}

const MARTIN_VANNES: RegistryCandidate = {
  name: "TOITURE MARTIN",
  siren: "111111111",
  city: "VANNES",
  postalCode: "56000",
  legalName: "TOITURE MARTIN",
  address: "12 RUE DU PORT 56000 VANNES",
  naf: "43.91B",
  createdOn: "2009-03-01",
};
const MARTIN_LYON: RegistryCandidate = { name: "TOITURE MARTIN", siren: "111111112", city: "LYON", postalCode: "69003" };
const SANS_SITE: RegistryCandidate = {
  name: "ATELIER SANS SITE",
  siren: "222222222",
  city: "SAINT-CHRISTOPHE-DU-LIGNERON",
  postalCode: "85670",
  naf: "43.32A",
  createdOn: "2016-05-12",
};

function registry(name: string, city = ""): RegistryPreflight {
  const n = name.toLowerCase();
  if (n.includes("toiture martin")) {
    if (!city) return { status: "ambiguous", candidates: [MARTIN_VANNES, MARTIN_LYON] };
    if (/vannes|56000/i.test(city)) return { status: "unique", candidates: [MARTIN_VANNES] };
    if (/lyon|69003/i.test(city)) return { status: "unique", candidates: [MARTIN_LYON] };
    return { status: "none", candidates: [] };
  }
  if (n.includes("atelier sans site")) return { status: "unique", candidates: [SANS_SITE] };
  return { status: "none", candidates: [] };
}

const IMG = (name: string, w = 1200, h = 900) => `/wp-content/uploads/2024/05/${name}-${w}x${h}.jpg`;

const MARTIN_PAGES: Record<string, string> = {
  "/": `<!doctype html><html lang="fr"><head><title>Toiture Martin | Couvreur à Vannes</title>
<meta name="description" content="Couvreur à Vannes : réfection de toiture, zinguerie, démoussage.">
<meta name="theme-color" content="#1d4e89"><meta property="og:site_name" content="Toiture Martin">
<style>:root{--e-global-color-primary:#1d4e89;--e-global-color-accent:#e0a526}.btn{background:#1d4e89}</style></head>
<body><header><a href="/" class="custom-logo-link"><img class="custom-logo" src="/wp-content/uploads/logo-toiture-martin.png" alt="Toiture Martin"></a>
<nav><a href="/refection-toiture/">Réfection de toiture</a><a href="/zinguerie/">Zinguerie</a><a href="/realisations/">Réalisations</a><a href="/contact/">Contact</a></nav>
<a href="tel:0297000000">02 97 00 00 00</a></header>
<main><h1>Couvreur à Vannes</h1><p>Toiture Martin réalise la réfection de toiture, la zinguerie et les gouttières, le démoussage de toiture et la pose de fenêtres de toit Velux.</p>
<p>Nous intervenons à Vannes, Auray et dans tout le Golfe du Morbihan.</p>
<p>Entreprise qualifiée Qualibat, garantie décennale. Depuis 2009 à votre service.</p>
<p>Note 4,9/5 sur Google — 37 avis</p>
<img src="${IMG("chantier-ardoise")}" alt="Toiture en ardoise refaite à Vannes" width="1200" height="900">
<a href="/contact/">Demander un devis</a></main>
<footer><a href="/mentions-legales/">Mentions légales</a> <a href="mailto:contact@toiture-martin.test">contact@toiture-martin.test</a> <a href="https://www.facebook.com/toiture.martin.vannes">Facebook</a></footer></body></html>`,
  "/refection-toiture/": `<html><head><title>Réfection de toiture à Vannes</title></head><body><h1>Réfection de toiture</h1><p>La réfection complète de votre toiture en ardoise ou en tuile, de la charpente à la finition.</p><img src="${IMG("refection")}" alt="Réfection de toiture" width="1200" height="800"></body></html>`,
  "/zinguerie/": `<html><head><title>Zinguerie</title></head><body><h1>Zinguerie et gouttières</h1><p>Pose et remplacement de gouttières en zinc.</p></body></html>`,
  "/realisations/": `<html><head><title>Nos réalisations</title></head><body><h1>Nos réalisations</h1>${["ardoise-1", "ardoise-2", "velux", "zinc", "tuile", "charpente"].map((n) => `<img src="${IMG(n)}" alt="Chantier ${n}" width="1200" height="900">`).join("")}</body></html>`,
  "/contact/": `<html><head><title>Contact</title></head><body><h1>Contact</h1><form><label for="n">Nom</label><input id="n" name="nom"><label for="t">Téléphone</label><input id="t" name="tel"><textarea name="message"></textarea></form></body></html>`,
  "/mentions-legales/": `<html><head><title>Mentions légales</title></head><body><h1>Mentions légales</h1><p>Toiture Martin, SARL, SIRET 111 111 111 00012, 12 rue du Port 56000 Vannes.</p></body></html>`,
};

export function fixtureFetch(url: string): Promise<FetchHtmlResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve({ ok: false, reason: "invalid_url" });
  }
  if (parsed.hostname !== "toiture-martin.test") return Promise.resolve({ ok: false, reason: "network_error" });
  const html = MARTIN_PAGES[parsed.pathname] ?? MARTIN_PAGES[`${parsed.pathname}/`];
  if (!html) return Promise.resolve({ ok: false, reason: "http_error", status: 404 });
  return Promise.resolve({ ok: true, finalUrl: parsed, status: 200, html, responseTimeMs: 40 });
}

type FakeJob = { kind: "discovery" | "investigation" | "blueprint"; readyAt: number; payload: unknown };
const jobs = (globalThis as unknown as { __gcPreviewFixtureJobs?: Map<string, FakeJob> }).__gcPreviewFixtureJobs ?? new Map<string, FakeJob>();
(globalThis as unknown as { __gcPreviewFixtureJobs?: Map<string, FakeJob> }).__gcPreviewFixtureJobs = jobs;

export const outbox: { to: string; subject: string; link: string }[] =
  ((globalThis as unknown as { __gcPreviewOutbox?: { to: string; subject: string; link: string }[] }).__gcPreviewOutbox ??= []);

function job(kind: FakeJob["kind"], delayMs: number, payload: unknown): string {
  const id = `resp_fixture${kind}${Math.random().toString(36).slice(2, 12)}`;
  jobs.set(id, { kind, readyAt: Date.now() + delayMs, payload });
  return id;
}

function discoveryFor(name: string, city: string): CompanyDiscoveryCandidate[] {
  const n = name.toLowerCase();
  if (n.includes("toiture martin") && /vannes|56000/i.test(city)) {
    return [{ name: "Toiture Martin", website: "https://toiture-martin.test/", sector: "Couvreur / toiture", city: "Vannes", summary: "Couvreur à Vannes", confidence: "high" }];
  }
  if (n.includes("atelier sans site")) {
    return [{ name: "Atelier Sans Site", website: "", sector: "Menuisier", city: "Saint-Christophe-du-Ligneron", summary: "Menuisier", confidence: "high" }];
  }
  return [];
}

export function fixtureDeps(delays = { discovery: 1_200, investigation: 3_500, blueprint: 1_500 }): Partial<PipelineDeps> {
  return {
    lookupRegistry: async (name, city) => registry(name, city),
    startDiscovery: async (name, options) => job("discovery", delays.discovery, discoveryFor(name, options.cityHint ?? "")),
    collectDiscovery: async (jobId, _name, options) => {
      const found = jobs.get(jobId);
      if (!found) return { status: "failed", reason: "unknown_job" };
      if (Date.now() < found.readyAt) return { status: "pending" };
      const candidates = found.payload as CompanyDiscoveryCandidate[];
      const verify = options?.verify ?? ((c: CompanyDiscoveryCandidate) => Promise.resolve(c));
      return { status: "done", result: { candidates: await Promise.all(candidates.map((c) => (c.website ? verify(c, { cityHint: options?.cityHint }) : c))), webSources: [] } };
    },
    verifySite: (candidate, opts) => verifyOfficialSite(candidate, { ...opts, fetchPage: (url) => fixtureFetch(url) }),
    crawl: (url, options) => crawlSite(url, { ...options, fetchPage: (u) => fixtureFetch(u) }),
    fetchStylesheet: async () => null,
    startInvestigation: async (dossier) => job("investigation", delays.investigation, dossier),
    collectInvestigation: async (jobId, dossier) => {
      const found = jobs.get(jobId);
      if (!found) return { status: "failed", reason: "unknown_job" };
      if (Date.now() < found.readyAt) return { status: "pending" };
      return { status: "done", diagnostic: siteOnlyDiagnostic(toAuditContext(dossier)), research: null };
    },
    startBlueprint: async (_profile, base) =>
      job("blueprint", delays.blueprint, {
        ...base,
        hero: { ...base.hero, subheadline: `${base.hero.subheadline}` },
        // An invented promise the validator must refuse.
        services: { ...base.services, intro: "Devis gratuit sous 24h, intervention en urgence 7j/7." },
      }),
    collectBlueprint: async (jobId) => {
      const found = jobs.get(jobId);
      if (!found) return { status: "failed", reason: "unknown_job" };
      if (Date.now() < found.readyAt) return { status: "pending" };
      return { status: "done", raw: found.payload, model: "fixture" };
    },
    sendReadyEmail: async (row: PreviewRow) => {
      const { previewLink } = await import("./email");
      outbox.push({ to: row.email ?? "", subject: `Votre nouvelle vitrine est prête — ${row.company_name}`, link: previewLink(row, "http://localhost:3000") });
      return true;
    },
  };
}

/** A small generated PNG (brand-tinted gradient) so offline previews show real images through the proxy. */
export function fixturePng(seed: string, width = 480, height = 360): Uint8Array {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = [40 + (h % 60), 60 + ((h >> 8) % 60), 80 + ((h >> 16) % 80)];
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const o = y * (width * 3 + 1) + 1 + x * 3;
      const t = (x / width + y / height) / 2;
      raw[o] = Math.min(255, base[0] + t * 120);
      raw[o + 1] = Math.min(255, base[1] + t * 90);
      raw[o + 2] = Math.min(255, base[2] + t * 60);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))])
  );
}
