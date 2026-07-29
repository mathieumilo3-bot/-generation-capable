import { describe, expect, it } from "vitest";
import type { AgentBlueprint } from "@gc-ai-os/shared-types";
import { RESERVED_DOMAINS, validateBlueprint } from "./blueprint-schema";

function valid(): Partial<AgentBlueprint> {
  return {
    id: "analyste-tiktok",
    name: "Analyste TikTok",
    domain: "analyse-tiktok",
    role: "Analyse la performance des contenus TikTok des ambassadeurs",
    responsibilities: ["Analyser les performances"],
    skills: ["analyse-performance"],
    tools: [],
    criticalPatterns: ["supprim"],
    readAccess: ["business"],
    model: "claude-sonnet-5",
    systemGuidance: "",
  };
}

function issuesFor(candidate: Partial<AgentBlueprint>): string[] {
  const result = validateBlueprint(candidate);
  return result.valid ? [] : result.issues.map((i) => i.field);
}

describe("validateBlueprint — la garantie de sûreté de la Factory", () => {
  it("accepte un blueprint complet", () => {
    const result = validateBlueprint(valid());
    expect(result.valid).toBe(true);
  });

  it("refuse un domaine déjà occupé par le catalogue fondateur", () => {
    // Deux agents sur un même domaine rendraient le routage ambigu et
    // casseraient le chat pour ce domaine.
    expect(issuesFor({ ...valid(), domain: "marketing" })).toContain("domain");
  });

  it("refuse un domaine déjà pris par un agent fabriqué", () => {
    const taken = new Set([...RESERVED_DOMAINS, "analyse-tiktok"]);
    const result = validateBlueprint(valid(), taken);
    expect(result.valid).toBe(false);
  });

  it("refuse un identifiant mal formé", () => {
    expect(issuesFor({ ...valid(), id: "Avec Majuscules" })).toContain("id");
    expect(issuesFor({ ...valid(), id: "ab" })).toContain("id");
    expect(issuesFor({ ...valid(), id: "9-commence-par-chiffre" })).toContain("id");
  });

  it("refuse une expression régulière invalide dans les garde-fous", () => {
    // Un motif invalide laisserait passer une action critique en
    // silence — la publication doit échouer, pas ignorer le motif.
    expect(issuesFor({ ...valid(), criticalPatterns: ["[non-ferme"] })).toContain("criticalPatterns");
  });

  it("exige au moins une responsabilité et une compétence", () => {
    expect(issuesFor({ ...valid(), responsibilities: [] })).toContain("responsibilities");
    expect(issuesFor({ ...valid(), skills: [] })).toContain("skills");
  });

  it("refuse un rôle trop court pour être un mandat", () => {
    expect(issuesFor({ ...valid(), role: "Agent" })).toContain("role");
  });

  it("ne corrige jamais en silence : accumule tous les problèmes", () => {
    const result = validateBlueprint({ id: "X", name: "", domain: "", role: "", skills: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.length).toBeGreaterThan(3);
  });

  it("nettoie les entrées vides des tableaux sans échouer", () => {
    const result = validateBlueprint({ ...valid(), tools: ["", "  ", "github.create_pull_request"] });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.blueprint.tools).toEqual(["github.create_pull_request"]);
  });

  it("retombe sur un accès mémoire sûr quand readAccess est invalide", () => {
    const result = validateBlueprint({ ...valid(), readAccess: ["inexistant"] as never });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.blueprint.readAccess).toEqual(["business"]);
  });
});
