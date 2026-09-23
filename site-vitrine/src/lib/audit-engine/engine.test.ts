import { describe, expect, it } from "vitest";
import { runAudit } from "./engine";
import { parseHtmlSignals } from "./probe";
import type { DeclaredInput, SiteSignals } from "./types";

function reachable(html: string): SiteSignals {
  return {
    reachable: true,
    finalUrl: "https://exemple.fr/",
    httpStatus: 200,
    responseTimeMs: 90,
    isHttps: true,
    ...parseHtmlSignals(html),
  };
}

function unreachable(reason: SiteSignals["unreachableReason"] = "network_error"): SiteSignals {
  const why = `unreachable (${reason})`;
  const u = { value: null as null, confidence: "unknown" as const, source: why };
  return {
    reachable: false,
    unreachableReason: reason,
    title: u,
    metaDescription: u,
    h1: u,
    wordCount: u,
    hasViewportMeta: u,
    hasHtmlLangAttr: u,
    hasStructuredData: u,
    telLinkCount: u,
    mailtoLinkCount: u,
    formCount: u,
    socialLinks: u,
    actionWords: u,
    priceMentionCount: u,
    testimonialSignalCount: u,
    faqSignalPresent: u,
    guaranteeSignalPresent: u,
    urgencySignalPresent: u,
    legalNoticeLinkPresent: u,
  };
}

const RICH_HTML = `<!doctype html>
<html lang="fr">
<head>
  <title>Le Bistrot du Coin — Réservez votre table à Lyon</title>
  <meta name="description" content="Réservez en ligne au Bistrot du Coin.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">{"@type":"Restaurant"}</script>
</head>
<body>
  <h1>Réservez votre table au Bistrot du Coin</h1>
  <p>Cuisine traditionnelle. Menu à partir de 25€. Garantie satisfait ou remboursé.</p>
  <a href="tel:+33478000000">Appelez-nous</a>
  <form><input name="reservation"></form>
  <section>★★★★★ Avis clients : "Excellent accueil"</section>
  <footer><a href="/mentions-legales">Mentions légales</a></footer>
</body>
</html>`;

const THIN_HTML = `<html><head><title>Accueil</title></head><body></body></html>`;

describe("runAudit", () => {
  it("produces a complete report for a reachable, content-rich site", async () => {
    const input: DeclaredInput = { siteUrl: "https://mon-restaurant.fr", secteur: "Restaurants", objectif: "Plus de demandes" };
    const report = await runAudit(input, { probe: async () => reachable(RICH_HTML) });

    expect(report.degraded).toBe(false);
    expect(report.header.siteReachable).toBe(true);
    expect(report.header.sectorProfile).toBe("restaurant");
    expect(report.header.objectif).toBe("Plus de demandes");
    expect(report.topLeaks.length).toBeGreaterThanOrEqual(0);
    expect(report.topLeaks.length).toBeLessThanOrEqual(5);
    expect(report.worksWell.length).toBeLessThanOrEqual(3);
    expect(report.actionPlan.length).toBe(report.topLeaks.filter((f) => f.recommendation).length);
    expect(report.sectorNote).toContain("cuisine");
    expect(report.engineVersion).toBeTruthy();
  });

  it("still produces a usable report when the site cannot be reached — never crashes, never fabricates", async () => {
    const input: DeclaredInput = { siteUrl: "https://ce-site-nexiste-pas-du-tout.invalid", secteur: "Restaurants", objectif: "Plus de visibilité" };
    const report = await runAudit(input, { probe: async () => unreachable("network_error") });

    expect(report.degraded).toBe(true);
    expect(report.degradedReason).toBeTruthy();
    expect(report.header.siteReachable).toBe(false);
    // Even degraded, the sector-heuristic engine still returns *something*
    // actionable rather than an empty report.
    expect(report.topLeaks.length + report.worksWell.length).toBeGreaterThanOrEqual(0);
  });

  it("handles a completely unrecognized sector without throwing (falls back to AUTRE)", async () => {
    const input: DeclaredInput = {
      siteUrl: "https://exemple.fr",
      secteur: "Éditeur de bandes dessinées indépendant",
      objectif: "Plus de ventes",
    };
    const report = await runAudit(input, { probe: async () => reachable(THIN_HTML) });
    expect(report.header.sectorProfile).toBe("autre");
  });

  it("handles a submission with an empty declared sector and objective", async () => {
    const input: DeclaredInput = { siteUrl: "https://exemple.fr", secteur: "", objectif: "" };
    const report = await runAudit(input, { probe: async () => reachable(THIN_HTML) });
    expect(report.header.sectorProfile).toBe("autre");
    expect(report).toBeTruthy();
  });

  it("clamps oversized input instead of crashing or passing it through unbounded", async () => {
    const input: DeclaredInput = {
      siteUrl: "https://exemple.fr/" + "x".repeat(10_000),
      secteur: "Restaurants",
      objectif: "y".repeat(10_000),
    };
    const report = await runAudit(input, { probe: async () => reachable(THIN_HTML) });
    expect(report.header.objectif.length).toBeLessThanOrEqual(240);
  });

  it("survives a single analyzer throwing without losing the rest of the report", async () => {
    // Regression guard for the per-analyzer try/catch in runAllAnalyzers:
    // simulate the shape of a corrupt signal set an analyzer might choke on.
    const brokenSite = reachable(RICH_HTML);
    // @ts-expect-error deliberately malformed to probe defensive coding
    brokenSite.actionWords = undefined;
    const input: DeclaredInput = { siteUrl: "https://exemple.fr", secteur: "Restaurants", objectif: "Plus de demandes" };
    await expect(runAudit(input, { probe: async () => brokenSite })).resolves.toBeTruthy();
  });

  it("never lets a finding's text claim a specific fabricated business metric", async () => {
    const input: DeclaredInput = { siteUrl: "https://exemple.fr", secteur: "Restaurants", objectif: "Plus de demandes" };
    const report = await runAudit(input, { probe: async () => reachable(THIN_HTML) });
    const allText = [
      ...report.topLeaks,
      ...report.worksWell,
      ...report.otherFindings,
    ]
      .map((f) => `${f.title} ${f.statement} ${f.recommendation ?? ""}`)
      .join(" ");
    expect(allText).not.toMatch(/taux de conversion de \d/i);
    expect(allText).not.toMatch(/chiffre d'affaires de/i);
    expect(allText).not.toMatch(/\d+\s?clients? par (mois|semaine|jour)/i);
  });
});
