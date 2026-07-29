/**
 * Substrat de métriques (voir docs/gc-ai-os/14-executive-brain.md).
 *
 * C'est la fondation de tout l'étage exécutif, et la décision de design
 * la plus importante du package tient en une ligne :
 *
 *   `value: number | null` — `null` signifie « non mesuré », et c'est un
 *   état de premier ordre, jamais remplacé par 0 ni par une estimation.
 *
 * Raison : un tableau de bord qui affiche « Croissance : 92 » sans source
 * fabrique de la confiance injustifiée. Un dirigeant qui prend une
 * décision sur un chiffre inventé prend une pire décision que s'il
 * n'avait rien eu. Tout ce qui consomme des métriques dans GC AI OS doit
 * donc distinguer « mauvais » de « inconnu ».
 */

/** Domaine exécutif propriétaire d'une métrique. */
export type BrainDomain =
  | "ceo"
  | "coo"
  | "cto"
  | "cfo"
  | "cmo"
  | "cro"
  | "chro"
  | "strategy";

/**
 * Origine réelle d'une métrique. `unmeasured` n'est pas une source :
 * c'est l'aveu explicite qu'aucun connecteur ne l'alimente encore.
 */
export type MetricSource =
  | "stripe"
  | "supabase"
  | "github"
  | "social"
  | "manual"
  | "derived"
  | "unmeasured";

export interface MetricDefinition {
  id: string;
  label: string;
  unit: string;
  domain: BrainDomain;
  /** Connecteur qui l'alimentera. Décrit l'intention, pas l'état actuel. */
  source: MetricSource;
  higherIsBetter: boolean;
  /** Cible de référence, quand elle a un sens métier. */
  target?: number;
  /** Au-delà de cette ancienneté (heures), une lecture est considérée périmée. */
  freshnessHours: number;
}

export interface MetricReading {
  metricId: string;
  /** `null` = non mesuré. Jamais substitué par une valeur par défaut. */
  value: number | null;
  measuredAt: string | null;
  source: MetricSource;
}

export interface MetricRepository {
  latest(metricId: string): Promise<MetricReading | undefined>;
  record(reading: MetricReading): Promise<void>;
  listLatest(): Promise<MetricReading[]>;
}

/**
 * Catalogue des métriques de Génération Capable.
 *
 * Dérivé du modèle économique réel observé dans les fichiers de
 * production (abonnement Pro 67 €/mois, commissions vendeurs et
 * ambassadeurs, paiement Stripe, comptes Supabase — voir
 * GC_BUSINESS_CONTEXT). Presque toutes sont `unmeasured` aujourd'hui :
 * c'est volontaire et c'est la valeur du catalogue — il dit exactement
 * ce qu'il faut brancher, dans quel ordre, pour que l'étage exécutif
 * cesse de raisonner à vide.
 */
export const GC_METRICS: MetricDefinition[] = [
  // ---- CFO ----
  { id: "mrr", label: "Revenu récurrent mensuel", unit: "€", domain: "cfo", source: "stripe", higherIsBetter: true, freshnessHours: 24 },
  { id: "active_subscriptions", label: "Abonnements Pro actifs", unit: "abonnés", domain: "cfo", source: "stripe", higherIsBetter: true, freshnessHours: 24 },
  { id: "churn_rate", label: "Taux de résiliation mensuel", unit: "%", domain: "cfo", source: "stripe", higherIsBetter: false, target: 5, freshnessHours: 168 },
  { id: "ai_cost", label: "Coût IA mensuel", unit: "€", domain: "cfo", source: "derived", higherIsBetter: false, freshnessHours: 24 },
  { id: "cash_runway", label: "Trésorerie disponible", unit: "mois", domain: "cfo", source: "manual", higherIsBetter: true, target: 12, freshnessHours: 720 },

  // ---- CRO ----
  { id: "active_ambassadors", label: "Ambassadeurs actifs", unit: "personnes", domain: "cro", source: "supabase", higherIsBetter: true, freshnessHours: 24 },
  { id: "active_sellers", label: "Vendeurs actifs", unit: "personnes", domain: "cro", source: "supabase", higherIsBetter: true, freshnessHours: 24 },
  { id: "ambassador_conversion", label: "Taux de conversion ambassadeurs", unit: "%", domain: "cro", source: "supabase", higherIsBetter: true, target: 3.4, freshnessHours: 168 },
  { id: "commissions_paid", label: "Commissions versées ce mois", unit: "€", domain: "cro", source: "stripe", higherIsBetter: true, freshnessHours: 168 },
  { id: "inactive_ambassadors", label: "Ambassadeurs inactifs (7 j)", unit: "personnes", domain: "cro", source: "supabase", higherIsBetter: false, target: 0, freshnessHours: 24 },

  // ---- CMO ----
  { id: "content_published", label: "Contenus publiés cette semaine", unit: "publications", domain: "cmo", source: "social", higherIsBetter: true, target: 5, freshnessHours: 168 },
  { id: "social_reach", label: "Portée réseaux sociaux", unit: "vues", domain: "cmo", source: "social", higherIsBetter: true, freshnessHours: 24 },
  { id: "visitor_to_signup", label: "Conversion visiteur → inscription", unit: "%", domain: "cmo", source: "supabase", higherIsBetter: true, target: 3, freshnessHours: 168 },
  { id: "cac", label: "Coût d'acquisition client", unit: "€", domain: "cmo", source: "derived", higherIsBetter: false, target: 67, freshnessHours: 168 },

  // ---- CTO ----
  { id: "open_bugs", label: "Bugs ouverts", unit: "tickets", domain: "cto", source: "github", higherIsBetter: false, target: 20, freshnessHours: 24 },
  { id: "deploy_frequency", label: "Déploiements par semaine", unit: "déploiements", domain: "cto", source: "github", higherIsBetter: true, freshnessHours: 168 },
  { id: "production_incidents", label: "Incidents en production", unit: "incidents", domain: "cto", source: "github", higherIsBetter: false, target: 0, freshnessHours: 168 },
  { id: "security_advisories", label: "Alertes de sécurité ouvertes", unit: "alertes", domain: "cto", source: "supabase", higherIsBetter: false, target: 0, freshnessHours: 24 },

  // ---- COO ----
  { id: "missions_completed", label: "Missions terminées (7 j)", unit: "missions", domain: "coo", source: "derived", higherIsBetter: true, freshnessHours: 24 },
  { id: "missions_blocked", label: "Missions bloquées ou échouées", unit: "missions", domain: "coo", source: "derived", higherIsBetter: false, target: 0, freshnessHours: 24 },
  { id: "agent_success_rate", label: "Taux de succès des agents", unit: "%", domain: "coo", source: "derived", higherIsBetter: true, target: 95, freshnessHours: 24 },
  { id: "pending_validations", label: "Validations humaines en attente", unit: "actions", domain: "coo", source: "derived", higherIsBetter: false, target: 0, freshnessHours: 1 },

  // ---- CHRO ----
  { id: "team_size", label: "Effectif humain", unit: "personnes", domain: "chro", source: "manual", higherIsBetter: true, freshnessHours: 720 },
  { id: "onboarding_completion", label: "Taux de complétion de l'onboarding", unit: "%", domain: "chro", source: "supabase", higherIsBetter: true, target: 80, freshnessHours: 168 },
  { id: "open_positions", label: "Postes à pourvoir", unit: "postes", domain: "chro", source: "manual", higherIsBetter: false, freshnessHours: 720 },

  // ---- CEO / Strategy ----
  { id: "total_customers", label: "Clients au total", unit: "clients", domain: "ceo", source: "stripe", higherIsBetter: true, freshnessHours: 24 },
  { id: "growth_rate", label: "Croissance mensuelle des clients", unit: "%", domain: "ceo", source: "derived", higherIsBetter: true, freshnessHours: 168 },
  { id: "market_position", label: "Position concurrentielle estimée", unit: "rang", domain: "strategy", source: "manual", higherIsBetter: false, freshnessHours: 720 },
];

/**
 * Registre de métriques. Fusionne les définitions du catalogue avec les
 * lectures réelles disponibles, en préservant l'absence de mesure.
 */
export class MetricRegistry {
  private readonly byId: Map<string, MetricDefinition>;

  constructor(
    private readonly repository: MetricRepository,
    definitions: MetricDefinition[] = GC_METRICS,
  ) {
    this.byId = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  definitions(domain?: BrainDomain): MetricDefinition[] {
    const all = [...this.byId.values()];
    return domain ? all.filter((definition) => definition.domain === domain) : all;
  }

  get(metricId: string): MetricDefinition | undefined {
    return this.byId.get(metricId);
  }

  /**
   * Lecture courante d'une métrique. Une métrique jamais alimentée
   * renvoie une lecture explicitement non mesurée plutôt qu'`undefined` :
   * l'appelant doit voir qu'elle existe et qu'elle est vide.
   */
  async read(metricId: string): Promise<MetricReading> {
    const definition = this.byId.get(metricId);
    const stored = await this.repository.latest(metricId);

    if (stored && stored.value !== null) return stored;

    return {
      metricId,
      value: null,
      measuredAt: null,
      source: definition?.source ?? "unmeasured",
    };
  }

  async readDomain(domain: BrainDomain): Promise<MetricReading[]> {
    return Promise.all(this.definitions(domain).map((d) => this.read(d.id)));
  }

  async record(metricId: string, value: number, source: MetricSource): Promise<void> {
    await this.repository.record({
      metricId,
      value,
      source,
      measuredAt: new Date().toISOString(),
    });
  }

  /** Métriques du catalogue qu'aucune source n'alimente encore. */
  async unmeasured(): Promise<MetricDefinition[]> {
    const readings = await Promise.all(
      this.definitions().map(async (definition) => ({
        definition,
        reading: await this.read(definition.id),
      })),
    );
    return readings.filter((entry) => entry.reading.value === null).map((entry) => entry.definition);
  }

  /** Proportion de métriques réellement alimentées, sur [0,1]. */
  async coverage(domain?: BrainDomain): Promise<number> {
    const definitions = this.definitions(domain);
    if (definitions.length === 0) return 0;
    const readings = await Promise.all(definitions.map((d) => this.read(d.id)));
    return readings.filter((r) => r.value !== null).length / definitions.length;
  }

  /** Une lecture est périmée si elle dépasse la fraîcheur attendue. */
  isStale(reading: MetricReading): boolean {
    const definition = this.byId.get(reading.metricId);
    if (!definition || !reading.measuredAt) return true;
    const ageHours = (Date.now() - Date.parse(reading.measuredAt)) / 3_600_000;
    return ageHours > definition.freshnessHours;
  }
}
