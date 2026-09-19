import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";

/**
 * Funnel (dimension 9: découverte → fidélisation) and conversion
 * (dimension 10: headline, CTA, preuve, friction) — two entries in the
 * pipeline, one file, because both read the exact same observable signals
 * (action words, forms, contact links, proof, mobile-readiness) from two
 * angles: "is there a path?" (funnel) and "does each step remove friction
 * or add it?" (conversion). Splitting them would mean re-deriving the same
 * booleans twice.
 */

function analyzeFunnelStep(site: SiteSignals, sector: SectorProfile): Finding[] {
  const findings: Finding[] = [];

  const hasAction = (site.actionWords.value?.length ?? 0) > 0;
  const hasContactPath =
    (site.formCount.value ?? 0) > 0 || (site.telLinkCount.value ?? 0) > 0 || (site.mailtoLinkCount.value ?? 0) > 0;
  const isPriorityForSector = sector.priorityDimensions.includes("funnel");

  if (!hasAction || !hasContactPath) {
    findings.push({
      id: "funnel_no_next_step",
      dimension: "funnel",
      title: "Le prochain pas n'est pas évident pour le visiteur",
      statement: !hasContactPath
        ? "Aucun moyen concret de passer à l'étape suivante (formulaire, téléphone, email) n'a été détecté sur la page. Le parcours s'arrête à la découverte : rien ne relie l'intérêt du visiteur à une action."
        : "Un moyen de contact existe, mais aucun vocabulaire d'action ne l'accompagne clairement — le visiteur doit deviner ce qu'il est censé faire.",
      evidence: [
        `Vocabulaire d'action détecté : ${hasAction ? "oui" : "non"}.`,
        `Moyen de contact détecté : ${hasContactPath ? "oui" : "non"}.`,
      ],
      confidence: "observed",
      impact: isPriorityForSector ? 5 : 4,
      effort: 3,
      polarity: "negative",
      recommendation: "Faire apparaître une action explicite (bouton, lien) associée au moyen de contact disponible.",
    });
  } else {
    findings.push({
      id: "funnel_next_step_present",
      dimension: "funnel",
      title: "Un chemin vers l'action existe",
      statement: "La page combine un vocabulaire d'action et un moyen concret de passer à l'étape suivante.",
      evidence: ["Vocabulaire d'action et moyen de contact détectés simultanément."],
      confidence: "observed",
      impact: 1,
      effort: 5,
      polarity: "positive",
    });
  }

  return findings;
}

function analyzeConversionStep(input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  const findings: Finding[] = [];

  const hasMobileViewport = site.hasViewportMeta.value === true;
  if (!hasMobileViewport) {
    findings.push({
      id: "conversion_no_mobile_viewport",
      dimension: "conversion",
      title: "La page n'est pas configurée pour un affichage mobile correct",
      statement:
        "Aucune balise viewport n'a été détectée. Sans elle, la majorité des visiteurs — qui arrivent depuis un téléphone — voient une page mal adaptée : texte minuscule, éléments qui débordent. C'est une friction avant même d'avoir lu le contenu.",
      evidence: ["Balise <meta name=\"viewport\"> absente."],
      confidence: "observed",
      impact: 5,
      effort: 4,
      polarity: "negative",
      recommendation: "Ajouter la balise viewport standard et vérifier l'affichage sur téléphone.",
    });
  }

  const wordCount = site.wordCount.value ?? 0;
  if (wordCount > 0 && wordCount < 40) {
    findings.push({
      id: "conversion_thin_content",
      dimension: "conversion",
      title: "La page contient très peu de texte exploitable",
      statement:
        "Moins d'une cinquantaine de mots ont été détectés sur la page. Cela peut vouloir dire que l'essentiel du contenu est dans des images ou une vidéo (que notre analyse ne lit pas), ou que la page manque effectivement d'explications pour convaincre un visiteur hésitant.",
      evidence: [`${wordCount} mots détectés dans le texte de la page.`],
      confidence: "inferred",
      impact: 2,
      effort: 3,
      polarity: "negative",
      recommendation: "Vérifier que l'essentiel de l'argumentaire est bien lisible en texte, pas seulement en image.",
    });
  }

  if (input.objectif && site.formCount.value === 0 && input.objectif.toLowerCase().includes("demande")) {
    findings.push({
      id: "conversion_objective_needs_form",
      dimension: "conversion",
      title: "Aucun formulaire détecté malgré un objectif de demandes",
      statement: `L'objectif déclaré (« ${input.objectif} ») suppose généralement de collecter une demande, mais aucun formulaire n'a été détecté sur la page.`,
      evidence: ["Aucune balise <form> détectée."],
      confidence: "inferred",
      impact: sector.priorityDimensions.includes("conversion") ? 5 : 4,
      effort: 3,
      polarity: "negative",
      recommendation: "Ajouter un formulaire court et visible, cohérent avec l'objectif déclaré.",
    });
  }

  return findings;
}

export function analyzeFunnel(_input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  if (!site.reachable) return [];
  return analyzeFunnelStep(site, sector);
}

export function analyzeConversion(input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  if (!site.reachable) return [];
  return analyzeConversionStep(input, site, sector);
}
