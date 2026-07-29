import type { DatabaseSync } from "node:sqlite";
import type { MetricReading, MetricRepository, MetricSource } from "@gc-ai-os/metrics";
import type {
  CommunicationPreferences,
  PeopleRepository,
  Person,
  PersonRole,
  PersonStatus,
  PreferredChannel,
  PreferredWindow,
} from "@gc-ai-os/people";

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const nullableNum = (v: unknown): number | null => (typeof v === "number" ? v : null);
const nullableStr = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Persistance de l'étage exécutif : lectures de métriques et registre
 * des personnes. Partage la connexion SQLite du socle (voir
 * SqliteRuntimeStore.connection).
 */
export class SqliteExecutiveStore implements MetricRepository, PeopleRepository {
  constructor(private readonly db: DatabaseSync) {}

  // ---- MetricRepository ------------------------------------------------

  async latest(metricId: string): Promise<MetricReading | undefined> {
    const row = this.db.prepare(`select * from metric_readings where metric_id = ?`).get(metricId) as
      | Row
      | undefined;
    if (!row) return undefined;
    return {
      metricId: str(row.metric_id),
      value: nullableNum(row.value),
      source: str(row.source, "unmeasured") as MetricSource,
      measuredAt: nullableStr(row.measured_at),
    };
  }

  async record(reading: MetricReading): Promise<void> {
    this.db
      .prepare(
        `insert into metric_readings (metric_id, value, source, measured_at)
         values (?, ?, ?, ?)
         on conflict (metric_id) do update set
           value = excluded.value, source = excluded.source, measured_at = excluded.measured_at`,
      )
      .run(reading.metricId, reading.value, reading.source, reading.measuredAt);
  }

  async listLatest(): Promise<MetricReading[]> {
    const rows = this.db.prepare(`select * from metric_readings`).all() as unknown as Row[];
    return rows.map((row) => ({
      metricId: str(row.metric_id),
      value: nullableNum(row.value),
      source: str(row.source, "unmeasured") as MetricSource,
      measuredAt: nullableStr(row.measured_at),
    }));
  }

  // ---- PeopleRepository ------------------------------------------------

  async upsert(person: Person): Promise<void> {
    this.db
      .prepare(
        `insert into people (id, display_name, role, status, joined_at, channel, window_pref,
           prefers_short, locale, activity_count, days_since_last_activity, revenue_generated,
           conversion_rate, consents_personalisation, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set
           display_name = excluded.display_name, role = excluded.role, status = excluded.status,
           channel = excluded.channel, window_pref = excluded.window_pref,
           prefers_short = excluded.prefers_short, locale = excluded.locale,
           activity_count = excluded.activity_count,
           days_since_last_activity = excluded.days_since_last_activity,
           revenue_generated = excluded.revenue_generated,
           conversion_rate = excluded.conversion_rate,
           consents_personalisation = excluded.consents_personalisation,
           updated_at = excluded.updated_at`,
      )
      .run(
        person.id,
        person.displayName,
        person.role,
        person.status,
        person.joinedAt,
        person.preferences.channel,
        person.preferences.window,
        person.preferences.prefersShortMessages ? 1 : 0,
        person.preferences.locale,
        person.performance.activityCount,
        person.performance.daysSinceLastActivity,
        person.performance.revenueGenerated,
        person.performance.conversionRate,
        person.consentsToPersonalisation ? 1 : 0,
        person.updatedAt,
      );
  }

  async get(personId: string): Promise<Person | undefined> {
    const row = this.db.prepare(`select * from people where id = ?`).get(personId) as Row | undefined;
    return row ? toPerson(row) : undefined;
  }

  async list(role?: PersonRole): Promise<Person[]> {
    const rows = (
      role
        ? this.db.prepare(`select * from people where role = ? order by display_name`).all(role)
        : this.db.prepare(`select * from people order by display_name`).all()
    ) as unknown as Row[];
    return rows.map(toPerson);
  }

  /** Suppression définitive (RGPD art. 17) — pas un simple marquage. */
  async erase(personId: string): Promise<void> {
    this.db.prepare(`delete from people where id = ?`).run(personId);
  }
}

function toPerson(row: Row): Person {
  const preferences: CommunicationPreferences = {
    channel: str(row.channel, "unknown") as PreferredChannel,
    window: str(row.window_pref, "unknown") as PreferredWindow,
    prefersShortMessages: num(row.prefers_short) === 1,
    locale: str(row.locale, "fr"),
  };

  return {
    id: str(row.id),
    displayName: str(row.display_name),
    role: str(row.role, "ambassador") as PersonRole,
    status: str(row.status, "active") as PersonStatus,
    joinedAt: str(row.joined_at),
    preferences,
    performance: {
      activityCount: num(row.activity_count),
      daysSinceLastActivity: nullableNum(row.days_since_last_activity),
      revenueGenerated: num(row.revenue_generated),
      conversionRate: nullableNum(row.conversion_rate),
    },
    consentsToPersonalisation: num(row.consents_personalisation) === 1,
    updatedAt: str(row.updated_at),
  };
}
