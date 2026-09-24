import { describe, expect, it } from "vitest";
import { buildTruthContext, checkCopy } from "../claims";
import type { VerifiedCompanyProfile } from "../types";

function profile(overrides: Partial<VerifiedCompanyProfile> = {}): VerifiedCompanyProfile {
  return {
    v: 1,
    generatedAt: "2026-09-24T00:00:00.000Z",
    presence: { level: "A", hasSite: true, siteReadable: true, pagesRead: 5 },
    identity: {
      publicName: { value: "Toiture Martin", source: "site", confidence: "observed" },
      trade: { value: "Couvreur", source: "x", confidence: "inferred" },
      tradeFamily: "couverture_charpente",
      city: { value: "Vannes", source: "registre", confidence: "observed" },
      foundedYear: { value: "2009", source: "registre", confidence: "observed" },
    },
    branding: { observedColors: null },
    contacts: { phone: { value: "02 97 00 00 00", source: "site", confidence: "observed" }, otherPhones: [], socials: [], hasQuoteForm: true },
    services: [{ id: "svc_1", name: "Réfection de toiture", quote: "La réfection complète de votre toiture en ardoise", source: "site", confidence: "observed" }],
    areas: { localPages: [] },
    trust: { items: [{ id: "trust_1", label: "Qualibat", kind: "certification", source: "site", confidence: "observed" }], legalNotice: true },
    reviews: [],
    portfolioAssets: [],
    audit: { levers: [], summary: "", mode: "site" },
    ...overrides,
  };
}

const truth = buildTruthContext(profile(), "nous intervenons a vannes, auray et dans tout le golfe du morbihan");

describe("anti-invention guard", () => {
  it.each([
    ["Devis gratuit en ligne", "gratuit"],
    ["Dépannage 24h/24 et 7j/7", "nombre non vérifié (24)"],
    ["Intervention en urgence le week-end", "urgence / 24-7"],
    ["Couvreur certifié RGE", "label"],
    ["Garantie décennale sur tous nos travaux", "décennale"],
    ["Plus de 500 clients satisfaits", "nombre non vérifié (500)"],
    ["Note de 4,9/5 sur Google", "nombre non vérifié (4)"],
    ["Le meilleur couvreur du Morbihan", "superlatif"],
    ["Toiture à partir de 90 € le m²", "nombre non vérifié (90)"],
    ["Depuis 1985 à votre service", "nombre non vérifié (1985)"],
    ["Couvreur à Lorient et Quimper", "lieu non vérifié (Lorient)"],
    ["« La plus belle toiture de Bretagne depuis toujours »", "citation introuvable"],
    ["Voir <script>alert(1)</script>", "balisage ou lien"],
    ["Rendez-vous sur https://evil.test", "balisage ou lien"],
  ])("refuses %s", (text, reason) => {
    const result = checkCopy(text, truth);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });

  it.each([
    "Couvreur à Vannes",
    "Réfection de toiture, zinguerie et démoussage. Décrivez votre projet et recevez votre devis.",
    "Entreprise qualifiée Qualibat",
    "Depuis 2009",
    "Un appel au 02 97 00 00 00 suffit pour parler de votre projet.",
    "« La réfection complète de votre toiture en ardoise »",
    "Nous intervenons à Vannes et Auray",
  ])("accepts supported copy: %s", (text) => {
    expect(checkCopy(text, truth)).toEqual({ ok: true });
  });

  it("allows review language only when reviews were verified", () => {
    expect(checkCopy("Les avis de nos clients", truth).ok).toBe(false);
    const withReviews = buildTruthContext(
      profile({ reviews: [{ id: "rev_1", platform: "Google", rating: "4,9/5", count: "37 avis", source: "site", confidence: "observed" }] }),
      ""
    );
    expect(checkCopy("Les avis de nos clients", withReviews).ok).toBe(true);
    expect(checkCopy("4,9/5 sur Google, 37 avis", withReviews).ok).toBe(true);
  });
});
