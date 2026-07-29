/**
 * Router de l'Orchestrateur, sous-composant "quel domaine" (voir
 * docs/gc-ai-os/02-architecture-globale.md). Phase 1 : classification par
 * mots-clés — suffisant tant que le nombre d'agents reste petit et
 * chacun a un domaine clairement distinct. Ce sera un chantier de phase 2
 * (voir docs/gc-ai-os/09-roadmap.md) de remplacer ceci par une
 * classification portée par un modèle une fois le catalogue d'agents
 * élargi et les cas d'ambiguïté réels observés.
 */
export interface DomainClassifier {
  classify(message: string, availableDomains: string[]): string;
}

export interface KeywordRule {
  domain: string;
  pattern: RegExp;
}

export class KeywordDomainClassifier implements DomainClassifier {
  constructor(private readonly rules: KeywordRule[]) {}

  classify(message: string, availableDomains: string[]): string {
    for (const rule of this.rules) {
      if (availableDomains.includes(rule.domain) && rule.pattern.test(message)) {
        return rule.domain;
      }
    }
    if (availableDomains.length === 0) {
      throw new Error("Aucun agent enregistré — impossible de router le message.");
    }
    // Défaut : premier domaine enregistré, traité comme généraliste.
    return availableDomains[0]!;
  }
}
