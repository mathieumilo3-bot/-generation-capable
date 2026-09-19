import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";

/**
 * Offer, range and price/value. Covers dimensions 7, 8 and 14 of the
 * brief (offre, gamme, prix/valeur) — grouped because they all read off the
 * same signal (price mentions, action words) and splitting them into three
 * files would mean three copies of "we can see there is/isn't a price".
 */
export function analyzeOffer(
  _input: DeclaredInput,
  site: SiteSignals,
  sector: SectorProfile
): Finding[] {
  const findings: Finding[] = [];
  if (!site.reachable) return findings;

  const priceMentions = site.priceMentionCount.value ?? 0;
  const hasGuarantee = site.guaranteeSignalPresent.value === true;

  if (priceMentions === 0) {
    findings.push({
      id: "offer_no_price_visible",
      dimension: "price_value",
      title: "Aucun prix n'est visible sur la page",
      statement:
        "Nous n'avons détecté aucune mention de prix sur la page analysée. Ce n'est pas nécessairement un problème — certains secteurs préfèrent qualifier avant de chiffrer — mais cela signifie qu'un visiteur ne peut pas s'auto-qualifier sur le budget avant de vous contacter.",
      evidence: ["Aucune mention de prix (montant suivi ou précédé de €) détectée."],
      confidence: "observed",
      impact: 3,
      effort: 3,
      polarity: "negative",
      recommendation:
        "Afficher au moins un ordre de grandeur ou une fourchette indicative pour réduire les demandes non qualifiées.",
    });
  } else {
    findings.push({
      id: "offer_price_visible",
      dimension: "price_value",
      title: "Le prix est au moins partiellement visible",
      statement:
        "La page contient des mentions de prix, ce qui permet à un visiteur de se situer avant de vous contacter.",
      evidence: [`${priceMentions} mention(s) de prix détectée(s) sur la page.`],
      confidence: "observed",
      impact: 1,
      effort: 5,
      polarity: "positive",
    });

    // Never claim the price is too high or too low — only whether it's
    // accompanied by the reassurance that usually justifies it.
    if (!hasGuarantee && sector.priorityDimensions.includes("price_value")) {
      findings.push({
        id: "offer_price_without_reassurance",
        dimension: "price_value",
        title: "Le prix est affiché sans élément de réassurance associé",
        statement:
          "Un prix affiché sans garantie, preuve ou élément de réassurance à proximité peut être perçu comme un risque plus élevé, particulièrement dans ce secteur — pas parce que le prix est mauvais, mais parce que rien ne vient en justifier la valeur.",
        evidence: ["Prix détecté sans marqueur de garantie/remboursement/essai détecté à proximité."],
        confidence: "inferred",
        impact: 3,
        effort: 3,
        polarity: "negative",
        recommendation: "Associer le prix à une preuve de valeur (garantie, résultat concret, avis).",
      });
    }
  }

  // Gamme / cross-sell — only observable via the presence/absence of
  // multiple distinct action words suggesting more than one offer tier.
  const actionWordCount = site.actionWords.value?.length ?? 0;
  if (site.actionWords.confidence === "observed" && actionWordCount === 1) {
    findings.push({
      id: "offer_single_action_only",
      dimension: "offer",
      title: "Une seule action commerciale semble proposée",
      statement:
        "Un seul type d'action a été détecté sur la page (par exemple un seul verbe d'action répété). Si votre gamme comprend plusieurs offres (entrée de gamme, offre principale, premium), la page ne semble pas encore le refléter.",
      evidence: [`Action détectée : ${site.actionWords.value?.[0]}`],
      confidence: "inferred",
      impact: 2,
      effort: 3,
      polarity: "negative",
      recommendation: "Si plusieurs offres existent, les rendre visibles avec une action propre à chacune.",
    });
  }

  return findings;
}
