import type { ObjectiveHorizon } from "@gc-ai-os/shared-types";
import type { Plan, PlannedMission, Planner } from "./planner";

interface Playbook {
  id: string;
  matches: RegExp;
  keyResults: Plan["keyResults"];
  missions: PlannedMission[];
}

/**
 * Playbooks déterministes (voir docs/gc-ai-os/10-moteur-objectifs.md).
 *
 * Rôle : garantir qu'un objectif produit toujours un plan exploitable,
 * même sans clé de modèle et même si le modèle échoue. Ce ne sont pas
 * des plans « de remplissage » : chaque mission cible un domaine réel du
 * catalogue, produit un livrable, et porte un critère de réussite — ce
 * sont les décompositions qu'un opérateur expérimenté écrirait à la main
 * pour Génération Capable.
 *
 * Limite assumée : un playbook est générique par construction. Le
 * planificateur modèle (voir ModelPlanner) reste supérieur dès qu'une
 * clé est configurée, et `Plan.source` indique lequel a produit le plan
 * pour qu'on ne confonde jamais les deux.
 */
const PLAYBOOKS: Playbook[] = [
  {
    id: "acquisition",
    matches: /client|vendeur|ambassadeur|acqui|croissance|abonn|inscri|utilisateur/i,
    keyResults: [
      { metric: "Nouveaux clients acquis", unit: "clients", baseline: 0, target: 0 },
      { metric: "Taux de conversion visiteur → abonné", unit: "%", baseline: 0, target: 0 },
      { metric: "Coût d'acquisition par client", unit: "€", baseline: 0, target: 0 },
    ],
    missions: [
      {
        ref: "diag",
        title: "Diagnostic du tunnel d'acquisition actuel",
        brief:
          "Analyse le parcours actuel de Génération Capable, de la découverte à l'abonnement Pro " +
          "à 67 €/mois. Identifie les étapes du tunnel, les points de friction probables et les " +
          "données manquantes pour piloter la conversion. Produis un état des lieux structuré " +
          "avec les hypothèses à valider en priorité.",
        domain: "donnees",
        requiredSkill: "diagnostic-tunnel-acquisition",
        dependsOn: [],
        riskLevel: "low",
        acceptanceCriteria:
          "Le livrable liste les étapes du tunnel, au moins 3 points de friction et les métriques à instrumenter.",
      },
      {
        ref: "segments",
        title: "Définition des segments prioritaires",
        brief:
          "À partir du diagnostic, définis les segments d'audience à cibler en priorité pour " +
          "l'Académie gratuite et pour la conversion vers l'abonnement Pro. Pour chaque segment : " +
          "profil, motivation d'achat, objection principale, canal d'accès le plus efficace.",
        domain: "marketing",
        requiredSkill: "segmentation-audience",
        dependsOn: ["diag"],
        riskLevel: "low",
        acceptanceCriteria: "Au moins 3 segments décrits avec motivation, objection et canal.",
      },
      {
        ref: "acquisition",
        title: "Plan d'acquisition multi-canal",
        brief:
          "Construis le plan d'acquisition par canal (réseaux sociaux, SEO, bouche-à-oreille via " +
          "ambassadeurs, partenariats). Pour chaque canal : action concrète, effort estimé, " +
          "résultat attendu, indicateur de suivi. Priorise explicitement : quel canal en premier " +
          "et pourquoi.",
        domain: "marketing",
        requiredSkill: "plan-acquisition-multicanal",
        dependsOn: ["segments"],
        riskLevel: "low",
        acceptanceCriteria:
          "Chaque canal a une action, un indicateur et une priorité justifiée ; un canal est désigné comme premier.",
      },
      {
        ref: "scripts",
        title: "Scripts de conversion et traitement d'objections",
        brief:
          "Rédige les scripts destinés aux vendeurs et ambassadeurs pour convertir vers " +
          "l'abonnement Pro. Couvre les objections de prix, de confiance et d'urgence. Reste " +
          "aligné avec le standard du GC Cognitive Engine : réduction du risque perçu et " +
          "création de valeur réelle, jamais de manipulation.",
        domain: "commercial",
        requiredSkill: "script-conversion-objections",
        dependsOn: ["segments"],
        riskLevel: "low",
        acceptanceCriteria:
          "Scripts couvrant au minimum les objections prix, confiance et urgence, sans technique manipulatoire.",
      },
      {
        ref: "recrutement",
        title: "Plan de recrutement des vendeurs et ambassadeurs",
        brief:
          "Définis comment recruter et onboarder les vendeurs/ambassadeurs nécessaires pour " +
          "atteindre l'objectif. Inclus le profil recherché, les canaux de sourcing, le parcours " +
          "d'onboarding et le critère de « vendeur actif ».",
        domain: "recrutement",
        requiredSkill: "plan-recrutement-vendeurs",
        dependsOn: ["acquisition"],
        riskLevel: "low",
        acceptanceCriteria:
          "Le livrable définit le profil, les canaux de sourcing, l'onboarding et une définition chiffrée de « vendeur actif ».",
      },
      {
        ref: "retention",
        title: "Dispositif de rétention et mesure",
        brief:
          "Définis le dispositif de rétention des abonnés Pro et le tableau de bord de suivi : " +
          "quelles métriques suivre, à quelle fréquence, quel seuil déclenche une alerte. " +
          "Acquérir sans retenir ne fait qu'augmenter le coût — traite ce point explicitement.",
        domain: "succes-client",
        requiredSkill: "dispositif-retention",
        dependsOn: ["acquisition", "scripts"],
        riskLevel: "low",
        acceptanceCriteria:
          "Métriques de rétention définies avec fréquence de suivi et seuils d'alerte.",
      },
    ],
  },
  {
    id: "revenue",
    matches: /chiffre d'affaires|revenu|\bca\b|\bmrr\b|marge|rentab|monétis/i,
    keyResults: [
      { metric: "Revenu récurrent mensuel", unit: "€", baseline: 0, target: 0 },
      { metric: "Revenu moyen par client", unit: "€", baseline: 0, target: 0 },
    ],
    missions: [
      {
        ref: "audit",
        title: "Audit des flux de revenus actuels",
        brief:
          "Recense les sources de revenus de Génération Capable (abonnement Pro 67 €/mois, " +
          "offres Essentiel/Business/Premium, commissions) et leur poids relatif. Identifie où " +
          "la valeur se crée réellement et où elle fuit.",
        domain: "finance",
        requiredSkill: "audit-flux-revenus",
        dependsOn: [],
        riskLevel: "low",
        acceptanceCriteria: "Toutes les sources de revenus listées avec leur poids relatif estimé.",
      },
      {
        ref: "pricing",
        title: "Analyse de la structure tarifaire",
        brief:
          "Évalue la cohérence de la grille tarifaire actuelle par rapport à la valeur délivrée " +
          "et aux segments. Propose des ajustements argumentés, en indiquant explicitement le " +
          "risque associé à chaque changement de prix.",
        domain: "finance",
        requiredSkill: "analyse-pricing",
        dependsOn: ["audit"],
        riskLevel: "medium",
        acceptanceCriteria: "Chaque proposition d'ajustement tarifaire est argumentée et son risque évalué.",
      },
      {
        ref: "leviers",
        title: "Leviers de croissance du revenu",
        brief:
          "Identifie les leviers de croissance : montée en gamme, réduction du churn, " +
          "augmentation du volume, nouvelles offres. Classe-les par rapport effort/impact et " +
          "recommande UNE priorité.",
        domain: "strategie",
        requiredSkill: "leviers-croissance-revenu",
        dependsOn: ["audit", "pricing"],
        riskLevel: "low",
        acceptanceCriteria: "Leviers classés par effort/impact avec une priorité unique recommandée.",
      },
      {
        ref: "suivi",
        title: "Tableau de bord financier de pilotage",
        brief:
          "Définis le tableau de bord de suivi : métriques, fréquence, seuils d'alerte, " +
          "responsable de chaque indicateur.",
        domain: "donnees",
        requiredSkill: "tableau-bord-financier",
        dependsOn: ["leviers"],
        riskLevel: "low",
        acceptanceCriteria: "Chaque métrique a une fréquence, un seuil et un responsable.",
      },
    ],
  },
  {
    id: "produit",
    matches: /produit|fonctionnalit|plateforme|applicat|refonte|technique|d[ée]velopp/i,
    keyResults: [
      { metric: "Fonctionnalités livrées", unit: "livraisons", baseline: 0, target: 0 },
      { metric: "Incidents en production", unit: "incidents", baseline: 0, target: 0 },
    ],
    missions: [
      {
        ref: "besoin",
        title: "Cadrage du besoin et des contraintes",
        brief:
          "Clarifie le besoin réel derrière l'objectif : qui en bénéficie, quel problème est " +
          "résolu, quelles contraintes techniques et réglementaires s'appliquent. Distingue " +
          "explicitement ce qui est dans le périmètre de ce qui n'y est pas.",
        domain: "strategie",
        requiredSkill: "cadrage-besoin",
        dependsOn: [],
        riskLevel: "low",
        acceptanceCriteria: "Le livrable distingue explicitement le périmètre inclus et exclu.",
      },
      {
        ref: "archi",
        title: "Décision d'architecture",
        brief:
          "Propose l'architecture technique : options envisagées, avantages et inconvénients de " +
          "chacune, recommandation argumentée. Respecte les principes du projet (Clean " +
          "Architecture, SOLID, TypeScript strict, modularité).",
        domain: "architecture-technique",
        requiredSkill: "decision-architecture",
        dependsOn: ["besoin"],
        riskLevel: "medium",
        acceptanceCriteria:
          "Au moins deux options comparées avec avantages/inconvénients et une recommandation tranchée.",
      },
      {
        ref: "decoupe",
        title: "Découpage en lots livrables",
        brief:
          "Découpe la réalisation en lots livrables indépendamment, avec leurs dépendances et " +
          "un ordre d'exécution. Chaque lot doit apporter de la valeur seul.",
        domain: "backend",
        requiredSkill: "decoupage-lots",
        dependsOn: ["archi"],
        riskLevel: "low",
        acceptanceCriteria: "Chaque lot est livrable indépendamment et apporte de la valeur seul.",
      },
      {
        ref: "tests",
        title: "Stratégie de test et de non-régression",
        brief:
          "Définis la stratégie de test : quoi tester unitairement, en intégration, en bout en " +
          "bout ; quel critère bloque une mise en production.",
        domain: "qualite",
        requiredSkill: "strategie-test",
        dependsOn: ["decoupe"],
        riskLevel: "low",
        acceptanceCriteria: "Les trois niveaux de test sont couverts et un critère bloquant est défini.",
      },
      {
        ref: "secu",
        title: "Revue de sécurité et conformité",
        brief:
          "Identifie les risques de sécurité et de conformité (RGPD, secrets, permissions) " +
          "introduits par ce chantier, et les mesures de réduction associées.",
        domain: "securite",
        requiredSkill: "revue-securite",
        dependsOn: ["archi"],
        riskLevel: "medium",
        acceptanceCriteria: "Chaque risque identifié est associé à une mesure de réduction.",
      },
    ],
  },
];

const GENERIC_MISSIONS: PlannedMission[] = [
  {
    ref: "analyse",
    title: "Analyse de la situation",
    brief:
      "Établis l'état des lieux factuel relatif à cet objectif : ce qui est connu, ce qui est " +
      "supposé, ce qui manque. Sépare explicitement les faits des interprétations.",
    domain: "recherche",
    requiredSkill: "analyse-situation",
    dependsOn: [],
    riskLevel: "low",
    acceptanceCriteria: "Le livrable sépare explicitement faits, hypothèses et inconnues.",
  },
  {
    ref: "options",
    title: "Options et recommandation",
    brief:
      "Propose au moins deux approches possibles pour atteindre l'objectif, compare-les " +
      "(avantages, inconvénients, risques) et recommande la meilleure en justifiant.",
    domain: "strategie",
    requiredSkill: "comparaison-options",
    dependsOn: ["analyse"],
    riskLevel: "low",
    acceptanceCriteria: "Au moins deux options comparées et une recommandation argumentée.",
  },
  {
    ref: "plan",
    title: "Plan d'exécution",
    brief:
      "Transforme la recommandation en plan d'exécution : étapes ordonnées, responsable par " +
      "étape, critère de réussite mesurable et première action concrète.",
    domain: "strategie",
    requiredSkill: "plan-execution",
    dependsOn: ["options"],
    riskLevel: "low",
    acceptanceCriteria: "Le plan a des étapes ordonnées, des critères mesurables et une première action claire.",
  },
  {
    ref: "mesure",
    title: "Dispositif de mesure",
    brief:
      "Définis comment on saura que l'objectif progresse : métriques, fréquence de relevé, " +
      "seuil déclenchant une correction de trajectoire.",
    domain: "donnees",
    requiredSkill: "dispositif-mesure",
    dependsOn: ["plan"],
    riskLevel: "low",
    acceptanceCriteria: "Métriques, fréquence et seuils de correction définis.",
  },
];

export class PlaybookPlanner implements Planner {
  async plan(input: {
    title: string;
    statement: string;
    horizon: ObjectiveHorizon;
  }): Promise<Plan> {
    const haystack = `${input.title} ${input.statement}`;
    const playbook = PLAYBOOKS.find((p) => p.matches.test(haystack));

    const target = extractTarget(haystack);

    if (!playbook) {
      return { missions: GENERIC_MISSIONS, keyResults: [], source: "template" };
    }

    return {
      missions: playbook.missions,
      keyResults: playbook.keyResults.map((kr, index) =>
        index === 0 && target !== null ? { ...kr, target } : kr,
      ),
      source: "template",
    };
  }
}

/**
 * Extrait un objectif chiffré de l'énoncé (« 10 000 clients », « 1000
 * vendeurs »). Sans cible chiffrée, le premier résultat-clé reste à 0 et
 * l'objectif devra être complété à la main plutôt que de se voir
 * attribuer une cible inventée.
 */
function extractTarget(text: string): number | null {
  const match = text.match(/(\d[\d\s.,]*)\s*(?:clients?|vendeurs?|ambassadeurs?|abonn|utilisateurs?)/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/[\s.,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
