import { describe, expect, it } from "vitest";
import { classifySector } from "./classify";

describe("classifySector", () => {
  it("matches every label the funnel's sector picker can send", () => {
    // These are exactly SECTORS[].name from src/lib/data/sectors.ts, plus
    // "Autre" alone (no précision yet, submit is blocked client-side but the
    // engine must still not crash on it).
    expect(classifySector("Restaurants").id).toBe("restaurant");
    expect(classifySector("Cabinets").id).toBe("avocat_reglemente");
    expect(classifySector("Immobilier").id).toBe("immobilier");
    expect(classifySector("Beauté").id).toBe("beaute_esthetique");
    expect(classifySector("Artisans").id).toBe("artisan");
    expect(classifySector("Services").id).toBe("services_locaux");
    expect(classifySector("Coachs").id).toBe("coach");
    expect(classifySector("Entreprises locales").id).toBe("services_locaux");
    expect(classifySector("Autre").id).toBe("autre");
  });

  it("reads the précision folded into an 'Autre — X' value", () => {
    expect(classifySector("Autre — Toiletteur canin").id).toBe("autre");
    expect(classifySector("Autre — Plombier chauffagiste").id).toBe("artisan");
    expect(classifySector("Autre — Cabinet d'avocats en droit social").id).toBe("avocat_reglemente");
  });

  it("is accent- and case-insensitive", () => {
    expect(classifySector("BEAUTÉ").id).toBe("beaute_esthetique");
    expect(classifySector("beaute").id).toBe("beaute_esthetique");
    expect(classifySector("  Restaurant  ").id).toBe("restaurant");
  });

  it("falls back to AUTRE for empty or unrecognized input, never throws", () => {
    expect(classifySector("").id).toBe("autre");
    expect(classifySector("   ").id).toBe("autre");
    expect(classifySector("Zorbatronique Quantique SARL").id).toBe("autre");
  });

  it("prefers the more specific keyword when several profiles could match", () => {
    // "cabinet dentaire" contains "cabinet" (avocat_reglemente) AND the more
    // specific "cabinet dentaire" (dentiste_sante) — the longer, more
    // specific keyword must win.
    expect(classifySector("Cabinet dentaire du centre-ville").id).toBe("dentiste_sante");
  });

  it("covers all fifteen declared sectors plus AUTRE", () => {
    const samples: Record<string, string> = {
      dentiste_sante: "Dentiste",
      coach: "Coach sportif",
      consultant: "Consultant en stratégie",
      agence: "Agence de communication",
      restaurant: "Restaurant italien",
      immobilier: "Agence immobilière",
      artisan: "Électricien",
      ecommerce: "Boutique en ligne de vêtements",
      salle_de_sport: "Salle de sport",
      beaute_esthetique: "Institut de beauté",
      formation: "Organisme de formation",
      services_locaux: "Pressing",
      saas_logiciel: "Éditeur de logiciel SaaS",
      avocat_reglemente: "Avocat en droit des affaires",
      automobile: "Garage automobile",
      autre: "Fabricant de meubles sur mesure",
    };
    for (const [expectedId, input] of Object.entries(samples)) {
      expect(classifySector(input).id, `"${input}" should classify as ${expectedId}`).toBe(expectedId);
    }
  });
});
