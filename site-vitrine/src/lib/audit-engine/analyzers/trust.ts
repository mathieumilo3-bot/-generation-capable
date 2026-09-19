import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";

/**
 * Trust (dimension 11) and social proof (dimension 12), plus the "Trust
 * Gap" concept from the brief: the level of confidence a purchase in this
 * sector typically requires, versus the proof actually present on the page.
 *
 * "Typically requires" is a sector heuristic (INFERRED), never a measured
 * fact about this specific visitor's threshold.
 */

/** How much trust a sector's purchase decision typically demands, 1 (low) – 5 (high). */
const SECTOR_TRUST_DEMAND: Record<string, number> = {
  dentiste_sante: 5,
  avocat_reglemente: 5,
  consultant: 4,
  agence: 3,
  coach: 4,
  formation: 4,
  saas_logiciel: 3,
  immobilier: 4,
  automobile: 4,
  salle_de_sport: 3,
  beaute_esthetique: 3,
  artisan: 4,
  restaurant: 2,
  ecommerce: 3,
  services_locaux: 3,
  autre: 3,
};

function trustSuppliedScore(site: SiteSignals): number {
  let score = 0;
  if (site.legalNoticeLinkPresent.value) score += 1;
  if ((site.testimonialSignalCount.value ?? 0) > 0) score += 1;
  if ((site.telLinkCount.value ?? 0) > 0 || (site.mailtoLinkCount.value ?? 0) > 0) score += 1;
  if (site.hasStructuredData.value) score += 1;
  if (site.isHttps) score += 1;
  return score; // 0–5
}

export function analyzeTrust(_input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  const findings: Finding[] = [];
  if (!site.reachable) return findings;

  const demand = SECTOR_TRUST_DEMAND[sector.id] ?? 3;
  const supplied = trustSuppliedScore(site);
  const gap = demand - supplied;

  const suppliedSignals = [
    site.legalNoticeLinkPresent.value && "mentions légales accessibles",
    (site.testimonialSignalCount.value ?? 0) > 0 && "témoignages ou avis",
    ((site.telLinkCount.value ?? 0) > 0 || (site.mailtoLinkCount.value ?? 0) > 0) && "coordonnées directes",
    site.hasStructuredData.value && "données structurées",
    site.isHttps && "connexion sécurisée (HTTPS)",
  ].filter(Boolean) as string[];

  const missingSignals = sector.trustSignals.filter((signal) => {
    const lower = signal.toLowerCase();
    if (lower.includes("avis") || lower.includes("témoignage") || lower.includes("résultat")) {
      return (site.testimonialSignalCount.value ?? 0) === 0;
    }
    if (lower.includes("identité") || lower.includes("coordonnées") || lower.includes("praticien")) {
      return (site.telLinkCount.value ?? 0) === 0 && (site.mailtoLinkCount.value ?? 0) === 0;
    }
    return false;
  });

  if (gap >= 2) {
    findings.push({
      id: "trust_gap_high",
      dimension: "trust",
      title: "Écart important entre la confiance exigée et la preuve fournie",
      statement: `Ce secteur (${sector.label.toLowerCase()}) demande généralement un niveau de confiance élevé avant l'achat, mais la page ne réunit que ${suppliedSignals.length} des signaux de confiance habituels. Cet écart — ce que nous appelons le "Trust Gap" — est souvent ce qui fait hésiter un visiteur par ailleurs intéressé.`,
      evidence: [
        `Signaux de confiance présents : ${suppliedSignals.length > 0 ? suppliedSignals.join(", ") : "aucun détecté"}.`,
        missingSignals.length > 0
          ? `Signaux attendus dans ce secteur mais non détectés : ${missingSignals.join(", ")}.`
          : `Signaux attendus dans ce secteur : ${sector.trustSignals.join(", ")}.`,
      ],
      confidence: "inferred",
      impact: 5,
      effort: 2,
      polarity: "negative",
      recommendation: `Ajouter en priorité : ${(missingSignals[0] ?? sector.trustSignals[0])}.`,
    });
  } else if (gap <= 0) {
    findings.push({
      id: "trust_gap_covered",
      dimension: "trust",
      title: "Le niveau de preuve semble cohérent avec les attentes du secteur",
      statement: "Les signaux de confiance détectés sur la page couvrent raisonnablement ce que ce secteur exige habituellement.",
      evidence: [`Signaux détectés : ${suppliedSignals.join(", ") || "aucun signal spécifique détecté, mais le seuil du secteur est bas"}.`],
      confidence: "inferred",
      impact: 1,
      effort: 5,
      polarity: "positive",
    });
  }

  if (!site.isHttps) {
    findings.push({
      id: "trust_no_https",
      dimension: "trust",
      title: "Le site n'est pas servi en connexion sécurisée (HTTPS)",
      statement:
        "La page finale a été chargée sans HTTPS. Les navigateurs modernes affichent un avertissement explicite dans ce cas, ce qui nuit à la confiance dès l'arrivée sur le site — avant même de lire le contenu.",
      evidence: [`URL finale observée : ${site.finalUrl ?? "non disponible"}`],
      confidence: "observed",
      impact: 5,
      effort: 4,
      polarity: "negative",
      recommendation: "Activer HTTPS — la plupart des hébergeurs le proposent gratuitement et automatiquement.",
    });
  }

  if (!site.legalNoticeLinkPresent.value) {
    findings.push({
      id: "trust_no_legal_notice",
      dimension: "trust",
      title: "Aucune mention légale détectée",
      statement:
        "Nous n'avons pas trouvé de lien vers des mentions légales ou une politique de confidentialité. Au-delà de l'obligation légale, leur absence peut être perçue comme un signal d'amateurisme par un visiteur qui vérifie le sérieux d'une entreprise avant de la contacter.",
      evidence: ["Aucun lien ou mention correspondant à « mentions légales », « CGV » ou « politique de confidentialité » détecté."],
      confidence: "observed",
      impact: 3,
      effort: 4,
      polarity: "negative",
      recommendation: "Ajouter des mentions légales et une politique de confidentialité conformes, accessibles depuis le pied de page.",
    });
  }

  return findings;
}

/**
 * Social proof (dimension 12): quantity/presence of reviews or testimonials
 * only — we never invent a rating, a review count or a specific quote that
 * wasn't actually matched on the page (brief §12: "Ne jamais inventer un
 * avis ou un chiffre").
 */
export function analyzeSocialProof(_input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  const findings: Finding[] = [];
  if (!site.reachable) return findings;

  const signalCount = site.testimonialSignalCount.value ?? 0;

  if (signalCount === 0) {
    findings.push({
      id: "social_proof_absent",
      dimension: "social_proof",
      title: "Aucune preuve sociale détectée sur la page",
      statement:
        "Ni avis, ni témoignage, ni mention de clients n'ont été détectés. Nous ne pouvons pas savoir si vous en avez ailleurs (Google, réseaux) — seulement que rien n'apparaît sur cette page pour rassurer un visiteur qui ne vous connaît pas encore.",
      evidence: ["Aucun marqueur de témoignage/avis détecté (mentions « avis », « témoignage », notation par étoiles…)."],
      confidence: "observed",
      impact: sector.priorityDimensions.includes("trust") ? 4 : 3,
      effort: 3,
      polarity: "negative",
      recommendation: "Intégrer 2 à 3 avis ou témoignages réels, si possible datés et attribués à une personne identifiable.",
    });
  } else {
    findings.push({
      id: "social_proof_present",
      dimension: "social_proof",
      title: "De la preuve sociale est présente sur la page",
      statement: "Des marqueurs de témoignages ou d'avis ont été détectés, ce qui contribue à rassurer un visiteur qui ne vous connaît pas encore.",
      evidence: [`${signalCount} marqueur(s) de témoignage/avis détecté(s).`],
      confidence: "observed",
      impact: 1,
      effort: 5,
      polarity: "positive",
    });
  }

  return findings;
}
