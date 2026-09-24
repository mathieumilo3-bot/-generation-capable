import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildBaseBlueprint } from "../blueprint-base";
import { validateBlueprint } from "../blueprint-validate";
import { buildTruthContext } from "../claims";
import { previewToken, proxiedAssetPath, readProxiedAsset, verifyPreviewToken } from "../tokens";
import type { VerifiedCompanyProfile } from "../types";

const profile: VerifiedCompanyProfile = {
  v: 1,
  generatedAt: "2026-09-24T00:00:00.000Z",
  presence: { level: "A", hasSite: true, siteReadable: true, pagesRead: 6 },
  identity: {
    publicName: { value: "Plomberie Durand", source: "site", confidence: "observed" },
    trade: { value: "Plombier chauffagiste", source: "x", confidence: "inferred" },
    tradeFamily: "plomberie_chauffage",
    city: { value: "Rennes", source: "registre", confidence: "observed" },
  },
  branding: { observedColors: null },
  contacts: { otherPhones: [], socials: [], hasQuoteForm: false },
  services: [
    { id: "svc_1", name: "Chaudière", quote: "Installation et entretien de chaudières gaz", source: "site", confidence: "observed" },
    { id: "svc_2", name: "Salle de bain", quote: "", source: "site", confidence: "observed" },
  ],
  areas: { localPages: [] },
  trust: { items: [], legalNotice: true },
  reviews: [],
  portfolioAssets: [{ id: "img_1", url: "https://p.test/a.jpg", alt: "", type: "site", pagePath: "/", source: "site" }],
  audit: { levers: [{ id: "lever_1", axis: "contacte", title: "Raccourcir le chemin jusqu’au devis", finding: "x", fix: "y", basis: "site" }], summary: "", mode: "site" },
};
const truth = buildTruthContext(profile, "plomberie durand rennes installation et entretien de chaudieres gaz");
const base = buildBaseBlueprint(profile);

describe("blueprint validation", () => {
  it("the deterministic floor always validates as-is", () => {
    const result = validateBlueprint(base, profile, truth, base);
    expect(result.rejections).toEqual([]);
    expect(result.source).toBe("ai");
  });

  it("refuses unknown ids, invented claims and impossible choices field by field", () => {
    const raw = {
      ...base,
      hero: { ...base.hero, headline: "Le meilleur plombier de Rennes, dépannage 24h/24" },
      secondaryCta: { label: "Appeler" }, // no verified phone
      services: { ...base.services, items: [{ serviceId: "svc_99", title: "Pompe à chaleur", description: null }] },
      portfolio: { heading: "Nos réalisations", assetIds: ["img_1", "img_404"] }, // a "site" photo is not a réalisation
      why: { heading: "Pourquoi nous", points: [{ title: "Certifié RGE", body: "Qualifié RGE depuis 1998.", factRef: "trust_9" }] },
      rationale: [{ leverId: "lever_1", title: "Un devis en deux clics", body: "Le devis est accessible à chaque écran." }],
      sections: [{ type: "services", variant: "ServicesGrid" }, { type: "hacked", variant: "Script" }, { type: "cta", variant: "CtaQuote" }],
    };
    const result = validateBlueprint(raw, profile, truth, base);
    const fields = result.rejections.map((r) => r.field);
    expect(fields).toEqual(expect.arrayContaining(["hero", "secondaryCta", "services", "portfolio", "why"]));
    expect(result.source).toBe("mixed");
    expect(result.blueprint.hero.headline).toBe(base.hero.headline);
    expect(result.blueprint.secondaryCta).toBeNull();
    expect(result.blueprint.rationale[0].title).toBe("Un devis en deux clics");
    expect(result.blueprint.sections.map((s) => s.type)).not.toContain("hacked");
    expect(result.blueprint.sections.at(-1)?.type).toBe("cta");
  });

  it("falls back entirely on garbage", () => {
    for (const raw of [null, "<html>", 42, [], { version: 2 }]) {
      const result = validateBlueprint(raw, profile, truth, base);
      expect(result.blueprint.hero.headline).toBe(base.hero.headline);
    }
  });
});

describe("tokens", () => {
  it("verifies only the server-issued read token", () => {
    const id = randomUUID();
    const token = previewToken(id);
    expect(verifyPreviewToken(id, token)).toBe(true);
    expect(verifyPreviewToken(id, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(verifyPreviewToken(randomUUID(), token)).toBe(false);
    expect(verifyPreviewToken("not-a-uuid", token)).toBe(false);
  });

  it("proxies only URLs it signed", () => {
    const path = proxiedAssetPath("https://site.test/photo.jpg");
    const params = new URL(`http://x${path}`).searchParams;
    expect(readProxiedAsset(params.get("u"), params.get("s"))).toBe("https://site.test/photo.jpg");
    const forged = Buffer.from("http://169.254.169.254/latest/meta-data").toString("base64url");
    expect(readProxiedAsset(forged, params.get("s"))).toBeNull();
  });
});
