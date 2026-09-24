import { describe, expect, it } from "vitest";
import { detectTradeFamily, getBusinessUi } from "../trades";

describe("preview business families", () => {
  const cases: Array<[string, Parameters<typeof detectTradeFamily>[0], string]> = [
    ["restaurant", { sector: "Restaurant gastronomique", naf: "56.10A" }, "restaurant"],
    ["health", { sector: "Cabinet dentaire", naf: "86.23Z" }, "sante_bien_etre"],
    ["ecommerce", { sector: "Boutique en ligne de vêtements" }, "ecommerce_marque"],
    ["saas", { sector: "Logiciel SaaS de gestion" }, "saas_logiciel"],
    ["agency", { sector: "Agence marketing B2B", naf: "73.11Z" }, "agence_b2b"],
    ["real estate", { sector: "Agence immobilière", naf: "68.31Z" }, "immobilier"],
    ["hotel", { sector: "Hôtel et chambres", naf: "55.10Z" }, "hotellerie"],
    ["events", { sector: "Agence événementielle", naf: "82.30Z" }, "evenementiel"],
    ["coaching", { sector: "Coaching et accompagnement" }, "coaching_conseil"],
    ["professional services", { sector: "Cabinet avocat juridique" }, "services_professionnels"],
  ];

  for (const [label, signals, expected] of cases) {
    it(`detects ${label}`, () => {
      expect(detectTradeFamily(signals)).toBe(expected);
    });
  }

  it("keeps artisan quote flow as the default for construction", () => {
    expect(getBusinessUi("couverture_charpente").primaryCta).toBe("Demander un devis");
  });

  it("changes the conversion action for reservation and product businesses", () => {
    expect(getBusinessUi("restaurant").primaryCta).toMatch(/Réserver/i);
    expect(getBusinessUi("saas_logiciel").primaryCta).toMatch(/démo/i);
    expect(getBusinessUi("ecommerce_marque").showArea).toBe(false);
  });
});
