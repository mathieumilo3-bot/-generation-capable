import "server-only";
import { after } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import type { JsonValue } from "@/lib/supabase/json";

export type JobType = "analyze_project" | "process_response" | "poll_mailbox" | "send_followup";

/**
 * Ajoute une tâche à la file persistante. Une tâche identique déjà en attente
 * (même dedupeKey) n'est pas dupliquée. La tâche survit à un redémarrage :
 * elle sera reprise par /api/cron/tick (Supabase Cron, chaque minute).
 */
export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { organizationId: string | null; dedupeKey?: string; runAfter?: Date; maxAttempts?: number },
) {
  const { error } = await adminClient()
    .from("jobs")
    .insert({
      type,
      payload: payload as JsonValue,
      organization_id: opts.organizationId,
      dedupe_key: opts.dedupeKey ?? null,
      run_after: (opts.runAfter ?? new Date()).toISOString(),
      max_attempts: opts.maxAttempts ?? 3,
    });
  // 23505 : une tâche identique est déjà en file — comportement voulu.
  if (error && error.code !== "23505") throw new Error(`Impossible de planifier la tâche : ${error.message}`);
}

/**
 * Démarre le traitement juste après la réponse HTTP, pour que l'utilisateur
 * voie le résultat sans attendre le prochain passage du cron. Si le process
 * s'arrête, le cron reprendra la tâche : rien ne dépend du navigateur.
 */
export function kickWorker() {
  after(async () => {
    const { runJobs } = await import("./runner");
    await runJobs({ deadlineMs: 250_000 }).catch((e) => console.error("[jobs] kick:", e instanceof Error ? e.message : e));
  });
}
