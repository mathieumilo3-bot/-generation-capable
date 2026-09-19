import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";

/**
 * Positioning: does the page make clear, in a few seconds, what the
 * business does, for whom, and why it's different? This reads the title,
 * meta description and H1 — the three places a positioning statement has to
 * survive being read out of context (a search result, a shared link, the
 * top of the page itself).
 */
export function analyzePositioning(
  input: DeclaredInput,
  site: SiteSignals,
  sector: SectorProfile
): Finding[] {
  const findings: Finding[] = [];

  if (!site.reachable) {
    findings.push({
      id: "positioning_site_unreachable",
      dimension: "positioning",
      title: "Positionnement non vérifiable automatiquement",
      statement:
        "Nous n'avons pas pu lire le contenu de la page depuis notre outil d'analyse — le positionnement déclaré ne peut donc pas être confronté à ce que dit réellement le site.",
      evidence: [`Site déclaré : ${input.siteUrl || "non renseigné"}`],
      confidence: "unknown",
      impact: 3,
      effort: 3,
      polarity: "negative",
      recommendation:
        "Un premier échange permettra de vérifier ce point directement avec vous plutôt que sur la seule base d'une lecture automatique.",
    });
    return findings;
  }

  const title = site.title.value;
  const h1 = site.h1.value;
  const description = site.metaDescription.value;

  const hasClearHeadline = Boolean(h1 && h1[0] && h1[0].length > 8);
  const titleLooksGeneric =
    !title || /^accueil$|^home$|^bienvenue/i.test(title.trim()) || title.trim().length < 12;
  const isPriorityForSector = sector.priorityDimensions.includes("positioning");

  if (titleLooksGeneric && !hasClearHeadline) {
    findings.push({
      id: "positioning_unclear_promise",
      dimension: "positioning",
      title: "La proposition de valeur n'est pas identifiable en quelques secondes",
      statement:
        "Ni le titre de la page ni le titre principal ne formulent clairement ce que l'entreprise fait, pour qui, ou quelle transformation elle apporte. Un visiteur qui arrive sur la page doit deviner.",
      evidence: [
        title ? `Titre de la page : « ${title} »` : "Aucune balise <title> exploitable détectée.",
        h1 && h1.length > 0 ? `Titre principal (H1) : « ${h1[0]} »` : "Aucun titre principal (H1) détecté.",
      ],
      confidence: "observed",
      impact: 5,
      effort: 3,
      polarity: "negative",
      recommendation:
        "Formuler en une phrase : pour qui, quel problème, quelle transformation — visible dans le titre de la page et dans le premier titre affiché.",
    });
  } else {
    findings.push({
      id: "positioning_clear_headline",
      dimension: "positioning",
      title: "Un titre principal identifiable existe",
      statement: "La page affiche un titre principal exploitable, ce qui donne une base pour clarifier la promesse.",
      evidence: [h1 && h1[0] ? `Titre principal (H1) : « ${h1[0]} »` : `Titre de page : « ${title} »`],
      confidence: "observed",
      impact: 2,
      effort: 5,
      polarity: "positive",
    });
  }

  if (!description) {
    findings.push({
      id: "positioning_no_meta_description",
      dimension: "positioning",
      title: "Aucune description n'accompagne le lien partagé ou le résultat de recherche",
      statement:
        "La balise meta description est absente. C'est le texte qui apparaît sous le lien dans Google ou lors du partage — sans elle, le moteur de recherche choisit un extrait au hasard sur la page.",
      evidence: ["Balise <meta name=\"description\"> absente du code de la page."],
      confidence: "observed",
      impact: 2,
      effort: 5,
      polarity: "negative",
      recommendation:
        "Rédiger une description d'une à deux phrases reprenant l'offre, la cible et l'action attendue.",
    });
  }

  // Positioning vs. declared objective coherence — inferred, never presented
  // as a hard fact.
  if (input.objectif && site.actionWords.confidence === "unknown") {
    findings.push({
      id: "positioning_objective_mismatch",
      dimension: "positioning",
      title: "Aucune action ne semble reprendre l'objectif déclaré",
      statement: `L'objectif déclaré est « ${input.objectif} », mais aucun vocabulaire d'action correspondant (réserver, demander un devis, prendre rendez-vous…) n'a été détecté sur la page. Il est possible que la page ne soit pas structurée pour cet objectif précis.`,
      evidence: ["Aucun mot d'action détecté dans le texte visible de la page."],
      confidence: "inferred",
      impact: isPriorityForSector ? 5 : 4,
      effort: 3,
      polarity: "negative",
      recommendation: `Faire apparaître explicitement l'action liée à « ${input.objectif} » près du premier écran.`,
    });
  }

  return findings;
}
