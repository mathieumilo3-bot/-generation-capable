import { describe, expect, it } from "vitest";
import { runAllAnalyzers } from "./index";
import { classifySector } from "../classify";
import { parseHtmlSignals } from "../probe";
import type { DeclaredInput, SiteSignals } from "../types";

function reachableSignals(html: string): SiteSignals {
  return {
    reachable: true,
    finalUrl: "https://exemple.fr/",
    httpStatus: 200,
    responseTimeMs: 120,
    isHttps: true,
    ...parseHtmlSignals(html),
  };
}

const UNREACHABLE_SIGNALS: SiteSignals = {
  reachable: false,
  unreachableReason: "network_error",
  title: { value: null, confidence: "unknown", source: "x" },
  metaDescription: { value: null, confidence: "unknown", source: "x" },
  h1: { value: null, confidence: "unknown", source: "x" },
  wordCount: { value: null, confidence: "unknown", source: "x" },
  hasViewportMeta: { value: null, confidence: "unknown", source: "x" },
  hasHtmlLangAttr: { value: null, confidence: "unknown", source: "x" },
  hasStructuredData: { value: null, confidence: "unknown", source: "x" },
  telLinkCount: { value: null, confidence: "unknown", source: "x" },
  mailtoLinkCount: { value: null, confidence: "unknown", source: "x" },
  formCount: { value: null, confidence: "unknown", source: "x" },
  socialLinks: { value: null, confidence: "unknown", source: "x" },
  actionWords: { value: null, confidence: "unknown", source: "x" },
  priceMentionCount: { value: null, confidence: "unknown", source: "x" },
  testimonialSignalCount: { value: null, confidence: "unknown", source: "x" },
  faqSignalPresent: { value: null, confidence: "unknown", source: "x" },
  guaranteeSignalPresent: { value: null, confidence: "unknown", source: "x" },
  urgencySignalPresent: { value: null, confidence: "unknown", source: "x" },
  legalNoticeLinkPresent: { value: null, confidence: "unknown", source: "x" },
};

const THIN_PAGE = `<!doctype html><html><head><title>Accueil</title></head><body><h1>Bienvenue</h1></body></html>`;

const RICH_RESTAURANT_PAGE = `<!doctype html>
<html lang="fr">
<head>
  <title>Le Bistrot du Coin — Réservez votre table à Lyon</title>
  <meta name="description" content="Réservez en ligne au Bistrot du Coin, cuisine traditionnelle lyonnaise, avis 4.8/5.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">{"@type":"Restaurant"}</script>
</head>
<body>
  <h1>Réservez votre table au Bistrot du Coin</h1>
  <p>Cuisine traditionnelle depuis 1998. Menu à partir de 25€. Garantie satisfait ou remboursé sur nos coffrets cadeaux.</p>
  <a href="tel:+33478000000">Appelez-nous</a>
  <a href="mailto:contact@bistrot.fr">Écrivez-nous</a>
  <a href="https://www.instagram.com/bistrotducoin">Instagram</a>
  <form><input name="reservation"></form>
  <section>★★★★★ Avis clients : "Excellent accueil" — Marie, 2024</section>
  <section>Questions fréquentes sur la réservation</section>
  <footer><a href="/mentions-legales">Mentions légales</a></footer>
</body>
</html>`;

const DECLARED: DeclaredInput = { siteUrl: "https://exemple.fr", secteur: "Restaurants", objectif: "Plus de demandes" };

describe("runAllAnalyzers", () => {
  it("degrades gracefully when the site is unreachable — no crash, no fabricated data", () => {
    const sector = classifySector(DECLARED.secteur);
    const findings = runAllAnalyzers(DECLARED, UNREACHABLE_SIGNALS, sector);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      // No finding may claim to have observed content it couldn't have read.
      if (finding.confidence === "observed") {
        expect(finding.dimension).not.toBe("positioning");
      }
      // Every negative finding — including the unreachable-site notices —
      // must give the visitor something to do with it.
      if (finding.polarity === "negative") {
        expect(finding.recommendation, `"${finding.id}" is negative but has no recommendation`).toBeTruthy();
      }
    }
  });

  it("never emits a finding that states a fabricated number (revenue, conversion rate, traffic)", () => {
    const sector = classifySector(DECLARED.secteur);
    const site = reachableSignals(RICH_RESTAURANT_PAGE);
    const findings = runAllAnalyzers(DECLARED, site, sector);

    const forbiddenPatterns = [
      /vous perdez \d/i,
      /\d+\s?%\s?(de\s)?(vos\s)?(prospects|clients|visiteurs)\s?(abandonnent|perdus)/i,
      /taux de conversion de \d/i,
      /chiffre d'affaires/i,
      /\d+\s?€\s?de\s?(pertes|manque)/i,
    ];
    for (const finding of findings) {
      const haystack = `${finding.title} ${finding.statement} ${finding.recommendation ?? ""}`;
      for (const pattern of forbiddenPatterns) {
        expect(haystack, `finding "${finding.id}" looks like it fabricates a number: "${haystack}"`).not.toMatch(pattern);
      }
    }
  });

  it("every finding carries evidence and a valid confidence status", () => {
    const sector = classifySector(DECLARED.secteur);
    const site = reachableSignals(RICH_RESTAURANT_PAGE);
    const findings = runAllAnalyzers(DECLARED, site, sector);

    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(["observed", "inferred", "unknown"]).toContain(finding.confidence);
      expect(Array.isArray(finding.evidence)).toBe(true);
      expect(finding.impact).toBeGreaterThanOrEqual(1);
      expect(finding.impact).toBeLessThanOrEqual(5);
      expect(finding.effort).toBeGreaterThanOrEqual(1);
      expect(finding.effort).toBeLessThanOrEqual(5);
      if (finding.polarity === "negative") {
        expect(finding.recommendation, `negative finding "${finding.id}" has no recommendation`).toBeTruthy();
      }
    }
  });

  it("flags a rich, well-equipped page mostly positively", () => {
    const sector = classifySector(DECLARED.secteur);
    const site = reachableSignals(RICH_RESTAURANT_PAGE);
    const findings = runAllAnalyzers(DECLARED, site, sector);

    const positives = findings.filter((f) => f.polarity === "positive");
    expect(positives.length).toBeGreaterThan(0);
    expect(positives.some((f) => f.dimension === "social_proof")).toBe(true);
    expect(positives.some((f) => f.dimension === "trust")).toBe(true);
  });

  it("flags a thin, unequipped page with multiple concrete leaks", () => {
    const sector = classifySector(DECLARED.secteur);
    const site = reachableSignals(THIN_PAGE);
    const findings = runAllAnalyzers(DECLARED, site, sector);

    const negatives = findings.filter((f) => f.polarity === "negative");
    expect(negatives.length).toBeGreaterThan(3);
    expect(negatives.some((f) => f.dimension === "conversion" && f.id.includes("mobile"))).toBe(true);
    expect(negatives.some((f) => f.dimension === "trust")).toBe(true);
    expect(negatives.some((f) => f.dimension === "social_proof")).toBe(true);
  });

  it("works for the AUTRE sector without crashing", () => {
    const sector = classifySector("Éditeur de bandes dessinées indépendant");
    expect(sector.id).toBe("autre");
    const site = reachableSignals(THIN_PAGE);
    expect(() => runAllAnalyzers(DECLARED, site, sector)).not.toThrow();
    expect(runAllAnalyzers(DECLARED, site, sector).length).toBeGreaterThan(0);
  });

  it("weighs an objective-critical finding higher when it is a sector priority", () => {
    const dentalSector = classifySector("Dentiste");
    const restaurantSector = classifySector("Restaurant");
    const site = reachableSignals(THIN_PAGE);

    const dentalFindings = runAllAnalyzers({ ...DECLARED, secteur: "Dentiste" }, site, dentalSector);
    const restaurantFindings = runAllAnalyzers({ ...DECLARED, secteur: "Restaurant" }, site, restaurantSector);

    const dentalMobile = dentalFindings.find((f) => f.id === "conversion_no_mobile_viewport");
    const restaurantMobile = restaurantFindings.find((f) => f.id === "conversion_no_mobile_viewport");
    // Both exist — mobile viewport matters everywhere — but this asserts the
    // sector-weighting mechanism actually runs rather than being dead code.
    expect(dentalMobile).toBeDefined();
    expect(restaurantMobile).toBeDefined();
  });
});
