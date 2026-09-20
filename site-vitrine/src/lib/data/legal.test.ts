import { describe, expect, it } from "vitest";
import {
  LEGAL_ENTITY,
  isLegalEntityComplete,
  legalRows,
  missingLegalFields,
  type LegalEntity,
} from "./legal";

const FILLED: LegalEntity = {
  denomination: "GC SAS",
  formeJuridique: "SAS",
  capital: "1 000 €",
  siege: "1 rue de l'Exemple, 75000 Paris",
  siren: "900000000",
  rcs: "RCS Paris 900 000 000",
  tvaIntracommunautaire: "FR00900000000",
  directeurPublication: "Prénom Nom",
  email: "contact@generationcapable.fr",
  telephone: "",
};

describe("legal entity", () => {
  it("ships the verified identity details, including the confirmed public contact email", () => {
    expect(isLegalEntityComplete(LEGAL_ENTITY)).toBe(true);
    expect(legalRows(LEGAL_ENTITY).map((row) => row.label)).toEqual([
      "Dénomination sociale",
      "Forme juridique",
      "Siège social",
      "SIREN / SIRET",
      "Directeur de la publication",
      "Email",
    ]);
  });

  it("has nothing left missing", () => {
    expect(missingLegalFields(LEGAL_ENTITY)).toEqual([]);
  });

  it("is complete once the mandatory fields are filled", () => {
    expect(isLegalEntityComplete(FILLED)).toBe(true);
    expect(missingLegalFields(FILLED)).toEqual([]);
  });

  it("renders the filled rows in order and skips the empty ones", () => {
    const labels = legalRows(FILLED).map((row) => row.label);
    expect(labels).toEqual([
      "Dénomination sociale",
      "Forme juridique",
      "Capital social",
      "Siège social",
      "SIREN / SIRET",
      "RCS",
      "TVA intracommunautaire",
      "Directeur de la publication",
      "Email",
    ]);
    expect(labels).not.toContain("Téléphone");
  });

  it("treats whitespace as unfilled", () => {
    expect(isLegalEntityComplete({ ...FILLED, siren: "   " })).toBe(false);
    expect(legalRows({ ...FILLED, rcs: "  " }).map((r) => r.label)).not.toContain("RCS");
  });
});
