import type { AgentBlueprint, MemoryScope } from "@gc-ai-os/shared-types";

export interface ValidationIssue {
  field: string;
  problem: string;
}

export type BlueprintValidation =
  | { valid: true; blueprint: AgentBlueprint }
  | { valid: false; issues: ValidationIssue[] };

const VALID_SCOPES: MemoryScope[] = ["global", "project", "agent", "technical", "business"];

const ID_PATTERN = /^[a-z][a-z0-9-]{2,48}$/;

/**
 * Domaines réservés au catalogue fondateur (voir
 * docs/gc-ai-os/03-agents.md). Un agent fabriqué ne peut pas s'attribuer
 * un domaine existant : cela créerait une ambiguïté de routage que
 * l'Orchestrateur remonterait en erreur à chaque message.
 */
const RESERVED_DOMAINS = new Set([
  "strategie",
  "architecture-technique",
  "frontend",
  "backend",
  "base-de-donnees",
  "infrastructure",
  "qualite",
  "marketing",
  "commercial",
  "support-client",
  "finance",
  "contenu",
  "recherche",
  "donnees",
  "conformite",
  "automatisation",
  "securite",
  "succes-client",
  "recrutement",
]);

/**
 * Validation stricte d'un manifeste d'agent produit par la Factory.
 *
 * C'est la pièce qui rend « des agents qui créent des agents » sûr :
 * puisque la Factory produit des données déclaratives et non du code,
 * tout ce qu'elle génère traverse ce schéma avant d'exister. Un
 * blueprint invalide est rejeté avec la liste précise des problèmes —
 * jamais corrigé en silence par une valeur devinée.
 */
export function validateBlueprint(
  candidate: Partial<AgentBlueprint>,
  existingDomains: Set<string> = RESERVED_DOMAINS,
): BlueprintValidation {
  const issues: ValidationIssue[] = [];

  const id = String(candidate.id ?? "").trim();
  if (!ID_PATTERN.test(id)) {
    issues.push({
      field: "id",
      problem: "Doit être en minuscules, 3 à 49 caractères, lettres/chiffres/tirets, commençant par une lettre.",
    });
  }

  const name = String(candidate.name ?? "").trim();
  if (name.length < 3) {
    issues.push({ field: "name", problem: "Nom trop court." });
  }

  const domain = String(candidate.domain ?? "").trim();
  if (!ID_PATTERN.test(domain)) {
    issues.push({ field: "domain", problem: "Format de domaine invalide." });
  } else if (existingDomains.has(domain)) {
    issues.push({
      field: "domain",
      problem: `Le domaine « ${domain} » est déjà occupé — le routage deviendrait ambigu.`,
    });
  }

  const role = String(candidate.role ?? "").trim();
  if (role.length < 10) {
    issues.push({ field: "role", problem: "Le rôle doit être décrit en une phrase complète." });
  }

  const responsibilities = asStringArray(candidate.responsibilities);
  if (responsibilities.length === 0) {
    issues.push({ field: "responsibilities", problem: "Au moins une responsabilité est requise." });
  }

  const skills = asStringArray(candidate.skills);
  if (skills.length === 0) {
    issues.push({ field: "skills", problem: "Au moins une compétence est requise." });
  }

  const readAccess = asStringArray(candidate.readAccess).filter((scope): scope is MemoryScope =>
    (VALID_SCOPES as string[]).includes(scope),
  );

  const criticalPatterns = asStringArray(candidate.criticalPatterns);
  for (const pattern of criticalPatterns) {
    try {
      new RegExp(pattern, "i");
    } catch {
      issues.push({ field: "criticalPatterns", problem: `Expression régulière invalide : ${pattern}` });
    }
  }

  if (issues.length > 0) return { valid: false, issues };

  return {
    valid: true,
    blueprint: {
      id,
      name,
      domain,
      role,
      responsibilities,
      skills,
      tools: asStringArray(candidate.tools),
      criticalPatterns,
      readAccess: readAccess.length > 0 ? readAccess : ["business"],
      model: String(candidate.model ?? "claude-sonnet-5"),
      systemGuidance: String(candidate.systemGuidance ?? "").trim(),
    },
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

export { RESERVED_DOMAINS };
