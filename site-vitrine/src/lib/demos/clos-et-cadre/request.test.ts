import { describe, expect, it } from "vitest";
import {
  EMPTY_REQUEST,
  STEP_FIELDS,
  normalisePhone,
  parseRequest,
  qualify,
  urbanismHint,
  validateFields,
  type ProjectRequest,
} from "./request";

const complete: ProjectRequest = {
  ...EMPTY_REQUEST,
  projectType: "extension",
  propertyType: "maison",
  commune: "Chatou",
  era: "avant-1948",
  currentSurface: 118,
  addedSurface: 38,
  occupancy: "habite",
  works: ["Ouverture de mur porteur", "Cuisine"],
  progress: ["plans"],
  timeline: "3-6-mois",
  budget: "150-300",
  description: "Remplacer la véranda par une extension ouverte sur le jardin.",
  photoCount: 3,
  name: "Claire Martin",
  email: "claire@example.com",
  phone: "06 12 34 56 78",
  callbackSlot: "soir",
  contactMode: "visite",
  consent: true,
};

describe("validateFields", () => {
  it("accepts a complete request at every step", () => {
    for (const fields of STEP_FIELDS) {
      expect(validateFields(complete, fields)).toEqual({});
    }
  });

  it("only reports the fields of the step being validated", () => {
    const errors = validateFields(EMPTY_REQUEST, STEP_FIELDS[0]);
    expect(Object.keys(errors).sort()).toEqual(["projectType", "propertyType"]);
  });

  it("requires the commune to be named when it is outside the list", () => {
    const errors = validateFields({ ...complete, commune: "autre", otherCommune: "" }, STEP_FIELDS[1]);
    expect(errors.otherCommune).toBeDefined();
  });

  it("lets the created surface stay unknown, but rejects nonsense", () => {
    expect(validateFields({ ...complete, addedSurface: null }, STEP_FIELDS[1])).toEqual({});
    expect(validateFields({ ...complete, addedSurface: -4 }, STEP_FIELDS[1]).addedSurface).toBeDefined();
  });

  it("requires explicit consent", () => {
    expect(validateFields({ ...complete, consent: false }, STEP_FIELDS[3]).consent).toBeDefined();
  });
});

describe("normalisePhone", () => {
  it("accepts national and international French formats", () => {
    expect(normalisePhone("06 12 34 56 78")).toBe("0612345678");
    expect(normalisePhone("+33 6 12 34 56 78")).toBe("0612345678");
    expect(normalisePhone("0033612345678")).toBe("0612345678");
  });

  it("rejects incomplete numbers", () => {
    expect(normalisePhone("06 12 34")).toBeNull();
    expect(normalisePhone("00 12 34 56 78")).toBeNull();
  });
});

describe("parseRequest", () => {
  it("rejects a non-object body", () => {
    expect(parseRequest("hello").ok).toBe(false);
    expect(parseRequest(null).ok).toBe(false);
  });

  it("drops unknown keys and coerces surfaces", () => {
    const result = parseRequest({ ...complete, currentSurface: "118", injected: "<script>" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.currentSurface).toBe(118);
      expect(result.request).not.toHaveProperty("injected");
    }
  });

  it("rejects values outside the allowed lists", () => {
    const result = parseRequest({ ...complete, budget: "illimité", works: ["Piscine"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.budget).toBeDefined();
      expect(result.errors.works).toBeDefined();
    }
  });
});

describe("urbanismHint", () => {
  it("flags permit and architect beyond 150 m² in total", () => {
    expect(urbanismHint(complete)?.label).toBe("Permis de construire et architecte");
  });

  it("reads a small extension as a déclaration préalable", () => {
    expect(urbanismHint({ ...complete, currentSurface: 90, addedSurface: 15 })?.label).toBe("Déclaration préalable probable");
  });

  it("flags co-ownership approval for a load-bearing wall in a flat", () => {
    const flat = { ...complete, projectType: "restructuration" as const, propertyType: "appartement" as const, addedSurface: null };
    expect(urbanismHint(flat)?.label).toBe("Accord de copropriété");
  });
});

describe("qualify", () => {
  const fixedDate = new Date("2026-09-25T10:00:00Z");

  it("marks an in-zone, well-funded, near-term project as priority A", () => {
    const brief = qualify(complete, fixedDate);
    expect(brief.priority).toBe("A");
    expect(brief.reference).toMatch(/^CC-20260925-[0-9A-Z]{4}$/);
    expect(brief.headline).toBe("Extension · maison de 118 m² · +38 m² · Chatou");
    expect(brief.signals.map((signal) => signal.label)).toContain("Enveloppe cohérente");
  });

  it("flags an envelope too low for the surface described", () => {
    const brief = qualify({ ...complete, addedSurface: 60, budget: "40-80" }, fixedDate);
    expect(brief.priority).toBe("C");
    expect(brief.signals.map((signal) => signal.label)).toContain("Enveloppe à clarifier");
  });

  it("orients projects under the company threshold", () => {
    const brief = qualify({ ...complete, budget: "moins-40" }, fixedDate);
    expect(brief.signals.map((signal) => signal.label)).toContain("Sous le seuil de l'entreprise");
  });

  it("never guesses a budget that was not given", () => {
    const brief = qualify({ ...complete, budget: "inconnu" }, fixedDate);
    expect(brief.priority).toBe("B");
    expect(brief.signals.map((signal) => signal.label)).toContain("Enveloppe non communiquée");
  });

  it("flags communes outside the served area", () => {
    const brief = qualify({ ...complete, commune: "autre", otherCommune: "Évry" }, fixedDate);
    expect(brief.priority).toBe("C");
    expect(brief.signals[0].label).toBe("Hors zone habituelle");
  });

  it("builds a visit checklist from what the prospect declared", () => {
    const brief = qualify(complete, fixedDate);
    expect(brief.checklist).toContain("Prévoir le sondage du mur ou des fondations lors de la visite");
    expect(brief.checklist).toContain("3 photos jointes à consulter avant l'appel");
  });
});
