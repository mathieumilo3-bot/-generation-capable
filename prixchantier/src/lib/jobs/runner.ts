import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { JobType } from "./queue";

type Handler = {
  run: (payload: Record<string, unknown>) => Promise<void>;
  /** Appelé après le dernier échec : rend l'erreur visible dans l'interface. */
  onFailure?: (payload: Record<string, unknown>, error: unknown) => Promise<void>;
};

async function handlers(): Promise<Record<JobType, Handler>> {
  const analysis = await import("@/lib/workflows/analysis");
  const responses = await import("@/lib/workflows/responses");
  const followups = await import("@/lib/workflows/followups");
  return {
    analyze_project: {
      run: (p) => analysis.analyzeProject(String(p.projectId)),
      onFailure: (p, e) => analysis.markAnalysisFailed(String(p.projectId), e),
    },
    process_response: {
      run: (p) => responses.processResponse(String(p.responseId)),
      onFailure: (p, e) => responses.markResponseFailed(String(p.responseId), e),
    },
    poll_mailbox: { run: (p) => responses.pollMailbox(String(p.connectionId)) },
    send_followup: {
      run: (p) => followups.sendScheduledFollowup(String(p.followupId)),
      onFailure: (p, e) => followups.markFollowupFailed(String(p.followupId), e),
    },
  };
}

/** Erreur définitive : inutile de réessayer. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

let running = false;

/** Traite les tâches prêtes jusqu'à épuisement ou jusqu'à l'échéance. */
export async function runJobs({ deadlineMs = 50_000, batch = 3 } = {}) {
  if (running) return { processed: 0 };
  running = true;
  const start = Date.now();
  let processed = 0;
  try {
    const admin = adminClient();
    const registry = await handlers();
    while (Date.now() - start < deadlineMs) {
      const { data: jobs, error } = await admin.rpc("claim_jobs", { p_limit: batch });
      if (error) throw new Error(`claim_jobs: ${error.message}`);
      if (!jobs?.length) break;
      await Promise.all(
        jobs.map(async (job) => {
          const handler = registry[job.type as JobType];
          const payload = (job.payload ?? {}) as Record<string, unknown>;
          try {
            if (!handler) throw new PermanentJobError(`Type de tâche inconnu : ${job.type}`);
            await handler.run(payload);
            await admin.from("jobs").update({ status: "done", finished_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const final = err instanceof PermanentJobError || job.attempts >= job.max_attempts;
            console.error(`[jobs] ${job.type} ${job.id} tentative ${job.attempts}: ${message}`);
            await admin
              .from("jobs")
              .update({
                status: final ? "failed" : "queued",
                last_error: message.slice(0, 1000),
                run_after: new Date(Date.now() + 60_000 * 2 ** job.attempts).toISOString(),
                finished_at: final ? new Date().toISOString() : null,
              })
              .eq("id", job.id);
            if (final && handler?.onFailure) await handler.onFailure(payload, err).catch(() => undefined);
          }
          processed++;
        }),
      );
    }
  } finally {
    running = false;
  }
  return { processed };
}
