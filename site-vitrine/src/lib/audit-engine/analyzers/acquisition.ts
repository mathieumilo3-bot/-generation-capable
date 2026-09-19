import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";
import type { SocialNetwork } from "../types";

const NETWORK_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  twitter: "X / Twitter",
};

/**
 * Acquisition: which channels does the page itself point to? We only ever
 * read outbound links present on the page — never claim to measure actual
 * traffic, spend or performance on any channel, which would require access
 * this engine does not have (see brief §8: "Ne prétends jamais mesurer des
 * données privées auxquelles tu n'as pas accès").
 */
export function analyzeAcquisition(
  _input: DeclaredInput,
  site: SiteSignals,
  sector: SectorProfile
): Finding[] {
  const findings: Finding[] = [];
  if (!site.reachable) return findings;

  const linkedNetworks = Object.keys(site.socialLinks.value ?? {}) as SocialNetwork[];
  const relevantChannels = sector.channels.filter((c) =>
    (Object.keys(NETWORK_LABELS) as SocialNetwork[]).some(
      (n) => NETWORK_LABELS[n].toLowerCase() === c.toLowerCase()
    )
  );

  if (linkedNetworks.length === 0) {
    findings.push({
      id: "acquisition_no_social_links",
      dimension: "acquisition",
      title: "Aucun canal social n'est relié depuis le site",
      statement:
        "La page ne pointe vers aucun réseau social détecté. Si votre entreprise est active sur les réseaux, l'absence de lien depuis le site est une occasion manquée de faire circuler l'audience entre les deux ; si vous n'y êtes pas présent, ce n'est pas un problème en soi.",
      evidence: ["Aucun lien vers Instagram, Facebook, LinkedIn, TikTok, YouTube ou X détecté sur la page."],
      confidence: "observed",
      impact: sector.priorityDimensions.includes("acquisition") ? 3 : 2,
      effort: 5,
      polarity: "negative",
      recommendation:
        relevantChannels.length > 0
          ? `Relier les canaux pertinents pour votre secteur (${relevantChannels.join(", ")}) si vous y êtes déjà présent.`
          : "Relier vos canaux actifs depuis le site s'ils existent.",
    });
  } else {
    findings.push({
      id: "acquisition_social_links_present",
      dimension: "acquisition",
      title: "Le site relie au moins un canal social",
      statement: `Le site pointe vers ${linkedNetworks.map((n) => NETWORK_LABELS[n]).join(", ")}, ce qui permet de faire circuler l'audience entre les deux.`,
      evidence: linkedNetworks.map((n) => `Lien vers ${NETWORK_LABELS[n]} détecté.`),
      confidence: "observed",
      impact: 1,
      effort: 5,
      polarity: "positive",
    });
  }

  if (!site.hasStructuredData.value) {
    findings.push({
      id: "acquisition_no_structured_data",
      dimension: "acquisition",
      title: "Aucune donnée structurée (schema.org) détectée",
      statement:
        "Les données structurées (JSON-LD) aident les moteurs de recherche à comprendre le contenu de la page — coordonnées, avis, produits. Leur absence n'empêche pas d'être référencé, mais limite les formats enrichis (étoiles, horaires, prix) que Google peut afficher.",
      evidence: ["Aucune balise <script type=\"application/ld+json\"> détectée."],
      confidence: "observed",
      impact: 2,
      effort: 4,
      polarity: "negative",
      recommendation: "Ajouter un balisage schema.org adapté au secteur (LocalBusiness, Product, Review…).",
    });
  }

  return findings;
}
