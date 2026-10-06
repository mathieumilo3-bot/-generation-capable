import type { SupabaseClient } from "@supabase/supabase-js";
import { AdminError, codeFromError } from "../lib/errors";

/**
 * Surface minimale de la base utilisée par le back-office. Les modules `src/data/*`
 * ne dépendent que de cette interface : ils se testent avec un faux `AdminDb`.
 * Les implémentations LÈVENT une `AdminError` (code stable) en cas d'erreur serveur.
 */
export type Scalar = string | number | boolean;

export interface SelectQuery {
  table: string;
  columns?: string;
  eq?: Readonly<Record<string, Scalar>>;
  ilike?: ReadonlyArray<{ column: string; pattern: string }>;
  order?: ReadonlyArray<{ column: string; ascending?: boolean }>;
  limit?: number;
  offset?: number;
  /** Demande le total exact (count: 'exact'). */
  count?: boolean;
}

export interface SelectResult {
  rows: unknown[];
  count: number | null;
}

export interface AdminDb {
  rpc(fn: string, args?: Record<string, unknown>): Promise<unknown>;
  select(query: SelectQuery): Promise<SelectResult>;
}

/** Échappe `%`, `_` et `\` pour un motif ILIKE saisi par l'utilisateur. */
export function likePattern(term: string): string {
  const escaped = term.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

export function createSupabaseDb(client: SupabaseClient): AdminDb {
  return {
    async rpc(fn, args) {
      const { data, error } = await client.rpc(fn, args ?? {});
      if (error) throw new AdminError(codeFromError(error));
      return data as unknown;
    },
    async select(q) {
      let query = client.from(q.table).select(q.columns ?? "*", q.count ? { count: "exact" } : undefined);
      for (const [column, value] of Object.entries(q.eq ?? {})) query = query.eq(column, value);
      for (const f of q.ilike ?? []) query = query.ilike(f.column, f.pattern);
      for (const o of q.order ?? []) query = query.order(o.column, { ascending: o.ascending ?? true });
      if (q.limit !== undefined) {
        const from = q.offset ?? 0;
        query = query.range(from, from + q.limit - 1);
      }
      const { data, error, count } = await query;
      if (error) throw new AdminError(codeFromError(error));
      return { rows: Array.isArray(data) ? (data as unknown[]) : [], count: count ?? null };
    },
  };
}
