import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";

/**
 * The prospect's psychological journey: what they need to believe before
 * acting, and what's likely standing in the way.
 *
 * Almost nothing here can be OBSERVED — a visitor's fear, desire or reason
 * for abandoning is never readable off a page. Every finding here is
 * INFERRED from the sector's known objection patterns crossed with what the
 * page does or doesn't address, and is written to read as a hypothesis, not
 * a verdict. Never claims a measured abandonment rate or conversion number.
 */
export function analyzePsychology(
  input: DeclaredInput,
  site: SiteSignals,
  sector: SectorProfile
): Finding[] {
  const findings: Finding[] = [];

  if (!site.reachable) {
    findings.push({
      id: "psychology_unreachable",
      dimension: "psychology",
      title: "Parcours psychologique non analysable automatiquement",
      statement:
        "Sans lecture du contenu de la page, les objections probables d'un visiteur ne peuvent être évaluées qu'à partir des schémas connus du secteur déclaré, pas de votre site en particulier.",
      evidence: [`Secteur déclaré : ${sector.label}`],
      confidence: "unknown",
      impact: 2,
      effort: 3,
      polarity: "negative",
      recommendation: `Vérifier avec vous les objections les plus courantes du secteur : ${sector.commonObjections[0]}.`,
    });
  }

  // Which of the sector's known objections look unaddressed, based on the
  // proxies we can read: guarantee language, testimonials, FAQ.
  const guaranteeAddressed = site.guaranteeSignalPresent.value === true;
  const proofAddressed = (site.testimonialSignalCount.value ?? 0) > 0;
  const faqAddressed = site.faqSignalPresent.value === true;

  if (site.reachable && !guaranteeAddressed && !proofAddressed && !faqAddressed) {
    findings.push({
      id: "psychology_objections_unaddressed",
      dimension: "psychology",
      title: "Les objections probables du secteur ne semblent pas traitées sur la page",
      statement: `Pour ${sector.label.toLowerCase()}, les freins les plus courants sont généralement : ${sector.commonObjections.join(", ")}. Nous n'avons trouvé sur la page ni garantie, ni témoignage, ni FAQ qui y répondrait directement — un visiteur hésitant n'a probablement pas de quoi se rassurer avant d'agir.`,
      evidence: [
        "Aucun marqueur de garantie détecté.",
        "Aucun témoignage ou avis détecté.",
        "Aucune FAQ détectée.",
      ],
      confidence: "inferred",
      impact: 4,
      effort: 2,
      polarity: "negative",
      recommendation: `Traiter explicitement au moins l'une de ces objections courantes : ${sector.commonObjections[0]}.`,
    });
  } else if (site.reachable) {
    const addressed = [
      guaranteeAddressed && "une garantie",
      proofAddressed && "des témoignages",
      faqAddressed && "une FAQ",
    ].filter(Boolean);
    findings.push({
      id: "psychology_some_reassurance",
      dimension: "psychology",
      title: "Des éléments de réassurance sont présents",
      statement: `La page contient ${addressed.join(" et ")}, ce qui contribue à répondre aux objections typiques du secteur avant qu'elles ne bloquent la décision.`,
      evidence: addressed.map((a) => `Élément détecté : ${a}`),
      confidence: "observed",
      impact: 2,
      effort: 5,
      polarity: "positive",
    });
  }

  // Effort required vs. what the page asks for, proxied by form count and
  // action-word richness — never a claim about actual friction measured.
  if (site.reachable && (site.formCount.value ?? 0) === 0 && (site.telLinkCount.value ?? 0) === 0 && (site.mailtoLinkCount.value ?? 0) === 0) {
    findings.push({
      id: "psychology_no_low_effort_entry",
      dimension: "psychology",
      title: "Aucun moyen de contact à faible effort n'est détecté",
      statement:
        "Ni formulaire, ni lien téléphonique, ni lien email n'ont été détectés. Pour un visiteur déjà convaincu mais pressé, l'absence d'un moyen d'action immédiat est une friction probable — pas nécessairement fatale, mais un pas de plus à franchir.",
      evidence: ["Aucun <form>, lien tel: ou lien mailto: détecté sur la page."],
      confidence: "inferred",
      impact: 4,
      effort: 2,
      polarity: "negative",
      recommendation: input.objectif
        ? `Ajouter une action à faible effort en lien avec « ${input.objectif} » (formulaire court, lien direct).`
        : "Ajouter une action à faible effort (formulaire court, lien téléphonique ou email visible).",
    });
  }

  return findings;
}
