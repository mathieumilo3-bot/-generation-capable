import { describe, expect, it } from "vitest";
import { classifyRegistryResults, normalizeRegistryName, registryIdentityHint } from "./company-registry";

describe("company registry preflight", () => {
  it("normalizes legal forms without losing the commercial name", () => {
    expect(normalizeRegistryName("SARL Gonçalves Bâtiment")).toBe("goncalves batiment");
    expect(normalizeRegistryName("A.A.T.P")).toBe("a a t p");
  });

  it("returns ambiguous immediately when the same exact name exists in different cities", () => {
    const result = classifyRegistryResults("Martin Couverture", [
      {
        siren: "111111111",
        nom_complet: "MARTIN COUVERTURE",
        etat_administratif: "A",
        siege: { libelle_commune: "Vannes", code_postal: "56000" },
      },
      {
        siren: "222222222",
        nom_raison_sociale: "MARTIN COUVERTURE SARL",
        etat_administratif: "A",
        siege: { libelle_commune: "Lyon", code_postal: "69003" },
      },
    ]);

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((candidate) => candidate.city)).toEqual(["Vannes", "Lyon"]);
    }
  });

  it("uses the city supplied by the visitor to select the legal entity", () => {
    const result = classifyRegistryResults(
      "Martin Couverture",
      [
        {
          siren: "111111111",
          nom_complet: "MARTIN COUVERTURE",
          etat_administratif: "A",
          siege: { libelle_commune: "Vannes", code_postal: "56000" },
        },
        {
          siren: "222222222",
          nom_complet: "MARTIN COUVERTURE",
          etat_administratif: "A",
          siege: { libelle_commune: "Lyon", code_postal: "69003" },
        },
      ],
      "Vannes"
    );

    expect(result.status).toBe("unique");
    if (result.status === "unique") expect(result.candidates[0].siren).toBe("111111111");
  });

  it("recognizes an exact commercial name or sigle from the registry", () => {
    const result = classifyRegistryResults("AATP", [
      {
        siren: "451619258",
        nom_complet: "A A T P",
        nom_raison_sociale: "A A T P",
        etat_administratif: "A",
        siege: {
          libelle_commune: "Bastelicaccia",
          code_postal: "20129",
          nom_commercial: "TROJANI.P",
        },
      },
    ]);

    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.candidates[0]).toMatchObject({
        siren: "451619258",
        city: "Bastelicaccia",
      });
      expect(registryIdentityHint(result.candidates[0])).toContain("SIREN 451619258");
    }
  });

  it("ignores closed legal units and fuzzy names instead of asking a useless city question", () => {
    const result = classifyRegistryResults("Martin Couverture", [
      {
        siren: "111111111",
        nom_complet: "MARTIN COUVERTURE",
        etat_administratif: "F",
        siege: { libelle_commune: "Vannes", code_postal: "56000" },
      },
      {
        siren: "222222222",
        nom_complet: "MARTIN COUVERTURE ET FILS",
        etat_administratif: "A",
        siege: { libelle_commune: "Lyon", code_postal: "69003" },
      },
    ]);

    expect(result).toEqual({ status: "none", candidates: [] });
  });
});
