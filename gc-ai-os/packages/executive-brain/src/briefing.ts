import type { MetricRegistry } from "@gc-ai-os/metrics";
import { runBrains } from "./brains";
import { arbitrate, type Arbitration } from "./decision-engine";
import { computeEnterpriseScore, type EnterpriseScore } from "./enterprise-score";
import type { BrainReport } from "./types";

export interface DailyBriefing {
  date: string;
  score: EnterpriseScore;
  reports: BrainReport[];
  arbitration: Arbitration;
  /** Décision du jour, en une phrase. */
  priority: string;
  /** Métriques à brancher en premier pour que le système voie plus clair. */
  instrumentationGaps: Array<{ id: string; label: string; source: string; domain: string }>;
  markdown: string;
}

/**
 * Briefing exécutif du matin (voir docs/gc-ai-os/14-executive-brain.md).
 *
 * C'est le rituel produit : un dirigeant ouvre GC AI OS et voit la note
 * de l'entreprise, la priorité du jour argumentée, et ce qui empêche le
 * système d'y voir plus clair.
 *
 * Le ton est volontairement factuel. Quand rien n'est mesuré, le
 * briefing le dit et désigne l'instrumentation comme priorité — plutôt
 * que d'inventer une recommandation stratégique qui aurait l'air
 * sérieuse et ne reposerait sur rien.
 */
export async function buildDailyBriefing(registry: MetricRegistry): Promise<DailyBriefing> {
  const [score, reports] = await Promise.all([
    computeEnterpriseScore(registry),
    runBrains(registry),
  ]);

  const arbitration = arbitrate(reports.flatMap((report) => report.proposals));

  const gaps = (await registry.unmeasured()).map((definition) => ({
    id: definition.id,
    label: definition.label,
    source: definition.source,
    domain: definition.domain,
  }));

  const priority = arbitration.winner
    ? arbitration.winner.proposal.title
    : "Aucune priorité dégagée : aucun seuil franchi et rien à instrumenter.";

  const date = new Date().toISOString().slice(0, 10);

  return {
    date,
    score,
    reports,
    arbitration,
    priority,
    instrumentationGaps: gaps,
    markdown: renderBriefing({ date, score, reports, arbitration, gaps }),
  };
}

function renderBriefing(input: {
  date: string;
  score: EnterpriseScore;
  reports: BrainReport[];
  arbitration: Arbitration;
  gaps: Array<{ id: string; label: string; source: string; domain: string }>;
}): string {
  const { date, score, reports, arbitration, gaps } = input;
  const lines: string[] = [];

  lines.push(`# Briefing exécutif — ${date}`, "");
  lines.push(`_${score.headline}_`, "");

  lines.push("## Note d'entreprise", "");
  lines.push("| Département | Note | Métriques mesurées |", "|---|---|---|");
  for (const domain of score.domains) {
    lines.push(
      `| ${domain.label} | ${domain.score === null ? "**non mesuré**" : `${domain.score}/100`} ` +
        `| ${domain.measuredCount}/${domain.totalCount} |`,
    );
  }
  lines.push("");

  lines.push("## Priorité du jour", "");
  if (arbitration.winner) {
    const { proposal } = arbitration.winner;
    lines.push(`**${proposal.title}**`, "");
    lines.push(proposal.rationale, "");
    lines.push(
      `*Proposé par ${proposal.brainId.toUpperCase()} Brain · score d'arbitrage ` +
        `${arbitration.winner.score} · ${arbitration.winner.explanation}*`,
      "",
    );
    lines.push(`Exécution : domaine \`${proposal.executionDomain}\`.`, "");
  } else {
    lines.push("_Aucune priorité dégagée aujourd'hui._", "");
  }

  lines.push(`> ${arbitration.rationale}`, "");

  if (arbitration.contested.length > 0) {
    lines.push("### Décision contestée — délibération recommandée", "");
    lines.push(
      "Les propositions suivantes sont à moins de 5 centièmes de la gagnante. " +
        "Les chiffres ne tranchent pas : c'est le cas où un arbitrage humain apporte réellement quelque chose.",
      "",
    );
    for (const contested of arbitration.contested) {
      lines.push(`- **${contested.proposal.title}** (score ${contested.score}) — ${contested.proposal.rationale}`);
    }
    lines.push("");
  }

  lines.push("## Constat par Executive Brain", "");
  for (const report of reports) {
    lines.push(`- ${report.assessment}`);
  }
  lines.push("");

  if (gaps.length > 0) {
    lines.push("## Ce qui empêche d'y voir clair", "");
    lines.push(
      `${gaps.length} métrique(s) du catalogue ne sont alimentées par aucune source. ` +
        `Tant qu'elles restent vides, les Brains concernés ne peuvent produire aucun constat.`,
      "",
    );
    lines.push("| Métrique | Source attendue | Domaine |", "|---|---|---|");
    for (const gap of gaps.slice(0, 15)) {
      lines.push(`| ${gap.label} | \`${gap.source}\` | ${gap.domain} |`);
    }
    if (gaps.length > 15) lines.push(`| _… et ${gaps.length - 15} autres_ | | |`);
    lines.push("");
  }

  lines.push("---", "");
  lines.push(
    "*Briefing produit automatiquement par GC Executive Brain. Les notes marquées " +
      "« non mesuré » signalent une absence de données, pas un mauvais résultat — " +
      "aucun chiffre n'est estimé ni inventé.*",
  );

  return lines.join("\n");
}
