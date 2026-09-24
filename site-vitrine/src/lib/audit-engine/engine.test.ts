import { describe, expect, it } from "vitest";
import { runAudit } from "./engine";
import { crawlSite } from "./crawl";
import type { discoverCompany } from "./company-discovery";
import { ARTISAN_PAGES, fakeFetch } from "./fixtures/artisan-site";

const ROOT = "https://www.martin-couverture56.fr/";
const fixtureCrawl: typeof crawlSite = (url, opts) => crawlSite(url, { ...opts, fetchPage: fakeFetch(ARTISAN_PAGES) });
const noDiscovery: typeof discoverCompany = async () => ({ candidates: [], webSources: [] });

// No OpenAI key in tests: the AI layer is skipped and the site-verified
// cards are what ships — the floor this suite protects.
process.env.OPENAI_API_KEY = "";
process.env.OPEN_API_KEY = "";

describe("runAudit (one-shot pipeline)", () => {
  it("returns three specific cards for a reachable artisan site", async () => {
    const report = await runAudit(
      { entreprise: "Martin Couverture", siteUrl: ROOT, secteur: "Couvreur / toiture", objectif: "Plus de devis", ville: "Vannes" },
      { crawl: fixtureCrawl, discover: noDiscovery }
    );
    expect(report.degraded).toBe(false);
    expect(report.header.siteReachable).toBe(true);
    expect(report.header.sectorProfile).toBe("artisan");
    expect(report.diagnostic?.cards).toHaveLength(3);
    expect(report.diagnostic?.pagesAnalyzed).toBe(8);
    expect(report.actionPlan).toHaveLength(3);
  });

  it("resolves the company first when no site is given", async () => {
    const discover: typeof discoverCompany = async () => ({
      candidates: [
        { name: "Martin Couverture", website: ROOT, sector: "Couvreur / toiture", city: "Vannes", summary: "", confidence: "high", insights: [] },
      ],
      webSources: [],
    });
    const report = await runAudit({ entreprise: "martin couverture", siteUrl: "", secteur: "", objectif: "" }, { crawl: fixtureCrawl, discover });
    expect(report.header.entreprise).toBe("Martin Couverture");
    expect(report.header.siteUrl).toBe(ROOT);
    expect(report.diagnostic?.company.city).toBe("Vannes");
  });

  it("degrades honestly when the site cannot be read — a real diagnostic, no invention", async () => {
    const report = await runAudit(
      { entreprise: "Inconnu SARL", siteUrl: "https://ce-site-nexiste-pas.invalid", secteur: "", objectif: "" },
      { crawl: (url, opts) => crawlSite(url, { ...opts, fetchPage: fakeFetch({}) }), discover: noDiscovery }
    );
    expect(report.degraded).toBe(true);
    expect(report.degradedReason).toBeTruthy();
    // Nothing could be read, but the visitor still gets a real diagnostic —
    // three cards built only from the one true fact (nothing was found),
    // never an empty report.
    expect(report.diagnostic?.cards).toHaveLength(3);
    for (const c of report.diagnostic?.cards ?? []) {
      expect(c.basis).toBe("recherche");
      expect(c.finding).not.toMatch(/undefined|NaN/);
    }
  });

  it("clamps oversized input", async () => {
    const report = await runAudit(
      { entreprise: "x".repeat(5_000), siteUrl: ROOT, secteur: "Couvreur", objectif: "y".repeat(10_000) },
      { crawl: fixtureCrawl, discover: noDiscovery }
    );
    expect(report.header.objectif.length).toBeLessThanOrEqual(240);
    expect(report.header.entreprise.length).toBeLessThanOrEqual(160);
  });

  it("never lets a card claim an invented business metric", async () => {
    const report = await runAudit(
      { entreprise: "Martin Couverture", siteUrl: ROOT, secteur: "Couvreur / toiture", objectif: "", ville: "Vannes" },
      { crawl: fixtureCrawl, discover: noDiscovery }
    );
    const text = (report.diagnostic?.cards ?? []).map((c) => [c.title, c.finding, c.seen, c.loss, c.potentialText, c.fix].join(" ")).join(" ");
    expect(text).not.toMatch(/taux de conversion|chiffre d.affaires|\d+\s?%|\d+\s?€|\d+\s+clients? par/i);
  });
});
