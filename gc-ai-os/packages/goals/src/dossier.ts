import type {
  Deliverable,
  ExecutiveDecision,
  KeyResult,
  Mission,
  Objective,
} from "@gc-ai-os/shared-types";

export interface DossierInput {
  objective: Objective;
  keyResults: KeyResult[];
  missions: Mission[];
  deliverables: Deliverable[];
  decisions: ExecutiveDecision[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  blocked: "Bloquée",
  in_progress: "En cours",
  self_correcting: "Auto-correction",
  awaiting_validation: "Validation humaine requise",
  completed: "Terminée",
  failed: "Échouée",
};

/**
 * Assemble le dossier téléchargeable d'un objectif : le livrable final
 * du système. Un objectif ne se termine pas par une réponse de chat mais
 * par un document exploitable — plan, livrables de chaque mission, et
 * traçabilité des arbitrages du Directeur Général.
 *
 * Format Markdown volontairement : lisible tel quel, versionnable,
 * convertible (PDF, Word, Notion) sans dépendance ajoutée au projet.
 */
export function buildDossier(input: DossierInput): string {
  const { objective, keyResults, missions, deliverables, decisions } = input;
  const lines: string[] = [];

  lines.push(`# ${objective.title}`, "");
  lines.push(`> ${objective.statement}`, "");
  lines.push(
    `**Horizon** : ${objective.horizon} · **Statut** : ${objective.status} · ` +
      `**Budget consommé** : ${objective.spentMicros}/${objective.budgetMicros} µ€`,
    "",
  );
  lines.push(`*Dossier généré le ${new Date().toISOString().slice(0, 10)} par GC AI OS.*`, "");

  if (keyResults.length > 0) {
    lines.push("---", "", "## Résultats-clés", "");
    lines.push("| Métrique | Départ | Actuel | Cible | Unité |", "|---|---|---|---|---|");
    for (const kr of keyResults) {
      lines.push(`| ${kr.metric} | ${kr.baseline} | ${kr.current} | ${kr.target} | ${kr.unit} |`);
    }
    lines.push("");
  }

  lines.push("---", "", "## Plan d'exécution", "");
  lines.push("| # | Mission | Domaine | Agent | Statut |", "|---|---|---|---|---|");
  missions.forEach((mission, index) => {
    lines.push(
      `| ${index + 1} | ${mission.title} | ${mission.domain} | ` +
        `${mission.assignedAgentId ?? "—"} | ${STATUS_LABELS[mission.status] ?? mission.status} |`,
    );
  });
  lines.push("");

  lines.push("---", "", "## Livrables", "");
  if (deliverables.length === 0) {
    lines.push("*Aucun livrable produit.*", "");
  } else {
    for (const deliverable of deliverables) {
      const mission = missions.find((m) => m.id === deliverable.missionId);
      lines.push(`### ${mission?.title ?? deliverable.filename}`, "");
      lines.push(
        `*Produit par \`${deliverable.producedByAgentId}\` — fichier \`${deliverable.filename}\`.*`,
        "",
      );
      lines.push(deliverable.content.trim(), "");
    }
  }

  if (decisions.length > 0) {
    lines.push("---", "", "## Traçabilité des décisions", "");
    lines.push(
      "Chaque arbitrage du Directeur Général est reconstituable : agent retenu, score, alternatives écartées.",
      "",
    );
    for (const decision of decisions) {
      lines.push(`- **${decision.kind}** — ${decision.rationale}`);
    }
    lines.push("");
  }

  lines.push("---", "");
  lines.push(
    "*Ce dossier a été produit automatiquement par le moteur d'objectifs de GC AI OS. " +
      "Les missions marquées « Validation humaine requise » n'ont pas été exécutées : elles " +
      "correspondent à des actions critiques qui nécessitent une approbation explicite.*",
  );

  return lines.join("\n");
}
