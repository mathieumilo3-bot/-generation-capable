/**
 * GC Human Brain — direction humaine (voir docs/gc-ai-os/15-human-brain.md).
 *
 * Deux règles structurelles, posées ici parce qu'elles sont plus faciles
 * à tenir dans le modèle de données que dans les intentions :
 *
 * 1. **Aucun profilage psychologique.** On enregistre des faits
 *    observables (publie deux fois par semaine, répond le soir, préfère
 *    les messages courts), jamais des traits de caractère inférés
 *    (« anxieux », « peu motivé »). Un jugement de personnalité stocké
 *    sur une personne réelle est une donnée sensible au sens du RGPD,
 *    contestable, et durablement injuste si le modèle se trompe.
 *
 * 2. **Aucune usurpation d'identité.** Le style de communication est un
 *    profil de ton appliqué à des messages émis par Génération Capable,
 *    jamais une identité empruntée. Voir `CommunicationStyle`.
 */

export type PersonRole = "ambassador" | "seller" | "director" | "staff";

export type PersonStatus = "active" | "at_risk" | "inactive" | "left";

/** Canal préféré, observé par le taux de réponse — pas déclaré au jugé. */
export type PreferredChannel = "email" | "sms" | "voice" | "chat" | "unknown";

/** Créneau où la personne répond le plus, observé. */
export type PreferredWindow = "morning" | "afternoon" | "evening" | "unknown";

/**
 * Préférences de communication, **toutes observables**. Chaque champ
 * correspond à quelque chose de mesurable dans les logs d'échange, pas à
 * une appréciation subjective.
 */
export interface CommunicationPreferences {
  channel: PreferredChannel;
  window: PreferredWindow;
  /** Longueur moyenne des messages auxquels la personne a répondu. */
  prefersShortMessages: boolean;
  /** Langue observée dans ses échanges. */
  locale: string;
}

export interface PerformanceSnapshot {
  /** Publications, ventes ou actions, selon le rôle. */
  activityCount: number;
  /** Jours depuis la dernière activité observée. */
  daysSinceLastActivity: number | null;
  /** Revenu généré sur la période, en euros. */
  revenueGenerated: number;
  /** Taux de conversion observé, en %. `null` si non mesurable. */
  conversionRate: number | null;
}

export interface Person {
  id: string;
  /** Prénom ou pseudonyme d'affichage. Aucune donnée d'identité superflue. */
  displayName: string;
  role: PersonRole;
  status: PersonStatus;
  joinedAt: string;
  preferences: CommunicationPreferences;
  performance: PerformanceSnapshot;
  /**
   * Consentement explicite au suivi personnalisé. Sans consentement, la
   * personne existe dans le système mais aucune relance personnalisée
   * n'est produite — seulement des agrégats anonymes.
   */
  consentsToPersonalisation: boolean;
  updatedAt: string;
}

export interface PeopleRepository {
  upsert(person: Person): Promise<void>;
  get(personId: string): Promise<Person | undefined>;
  list(role?: PersonRole): Promise<Person[]>;
  /** Suppression définitive — droit à l'effacement (RGPD art. 17). */
  erase(personId: string): Promise<void>;
}

export type NudgeUrgency = "watch" | "reach_out" | "escalate";

/**
 * Relance proposée pour une personne. Ce n'est jamais un message envoyé
 * automatiquement : c'est une proposition, soumise aux mêmes règles de
 * validation que toute action sortante (voir 06-securite.md).
 */
export interface Nudge {
  personId: string;
  displayName: string;
  urgency: NudgeUrgency;
  reason: string;
  /** Canal et créneau recommandés, dérivés des préférences observées. */
  channel: PreferredChannel;
  window: PreferredWindow;
  /** Brouillon de message, à relire avant envoi. */
  draft: string;
}

const INACTIVITY_WATCH_DAYS = 3;
const INACTIVITY_REACH_OUT_DAYS = 7;
const INACTIVITY_ESCALATE_DAYS = 14;

/**
 * Direction humaine : détecte les situations qui méritent une attention
 * et prépare une relance adaptée aux préférences **observées** de la
 * personne.
 *
 * Volontairement conservateur : sans consentement à la personnalisation,
 * aucune relance individuelle n'est produite. Sans activité mesurée,
 * aucune conclusion n'est tirée — « je ne sais pas » plutôt que « cette
 * personne décroche ».
 */
export class HumanBrain {
  constructor(private readonly repository: PeopleRepository) {}

  async roster(role?: PersonRole): Promise<Person[]> {
    return this.repository.list(role);
  }

  /**
   * Personnes nécessitant une attention, classées par urgence.
   *
   * L'inactivité est le seul signal utilisé en phase 1 parce que c'est
   * le seul réellement observable aujourd'hui — et c'est le plus
   * prédictif : un ambassadeur silencieux deux semaines ne revient
   * presque jamais.
   */
  async attentionList(role?: PersonRole): Promise<Nudge[]> {
    const people = await this.repository.list(role);
    const nudges: Nudge[] = [];

    for (const person of people) {
      if (person.status === "left") continue;

      const days = person.performance.daysSinceLastActivity;
      if (days === null) continue; // Activité non mesurée : aucune conclusion.

      const urgency = urgencyFor(days);
      if (!urgency) continue;

      if (!person.consentsToPersonalisation) {
        nudges.push({
          personId: person.id,
          displayName: person.displayName,
          urgency,
          reason: `${days} jours sans activité.`,
          channel: "unknown",
          window: "unknown",
          draft:
            "Aucun message personnalisé n'est proposé : cette personne n'a pas consenti au " +
            "suivi personnalisé. Une relance générique par un responsable reste possible.",
        });
        continue;
      }

      nudges.push({
        personId: person.id,
        displayName: person.displayName,
        urgency,
        reason: reasonFor(person, days),
        channel: person.preferences.channel,
        window: person.preferences.window,
        draft: draftFor(person, days),
      });
    }

    const order: Record<NudgeUrgency, number> = { escalate: 0, reach_out: 1, watch: 2 };
    return nudges.sort((a, b) => order[a.urgency] - order[b.urgency]);
  }

  /** Droit à l'effacement. Suppression définitive, pas un marquage. */
  async erase(personId: string): Promise<void> {
    await this.repository.erase(personId);
  }
}

function urgencyFor(days: number): NudgeUrgency | null {
  if (days >= INACTIVITY_ESCALATE_DAYS) return "escalate";
  if (days >= INACTIVITY_REACH_OUT_DAYS) return "reach_out";
  if (days >= INACTIVITY_WATCH_DAYS) return "watch";
  return null;
}

function reasonFor(person: Person, days: number): string {
  const revenue =
    person.performance.revenueGenerated > 0
      ? ` A généré ${person.performance.revenueGenerated} € — perte réelle si le décrochage se confirme.`
      : "";
  return `${days} jours sans activité observée.${revenue}`;
}

/**
 * Brouillon de relance adapté au canal et à la longueur observés.
 *
 * Le message est signé par Génération Capable, jamais présenté comme
 * écrit personnellement par un dirigeant : reproduire un style de
 * communication est légitime, se faire passer pour quelqu'un ne l'est
 * pas — y compris avec de bonnes intentions.
 */
function draftFor(person: Person, days: number): string {
  const name = person.displayName;

  if (person.preferences.prefersShortMessages) {
    return (
      `${name}, ça fait ${days} jours — tout va bien ?\n` +
      `Une action simple pour relancer : publie un contenu cette semaine, on regarde le résultat ensemble.\n` +
      `— L'équipe Génération Capable`
    );
  }

  return (
    `Bonjour ${name},\n\n` +
    `On a remarqué que tu n'as pas eu d'activité depuis ${days} jours. Ce n'est pas un reproche : ` +
    `on veut surtout savoir si quelque chose te bloque.\n\n` +
    `Si c'est le cas, dis-nous quoi — on adapte. Sinon, une action concrète pour repartir : ` +
    `publie un contenu cette semaine, et on analyse ensemble ce qu'il donne.\n\n` +
    `— L'équipe Génération Capable`
  );
}
