import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { setUsageRecorder } from "./llm";

/**
 * Journal de consommation IA : écrit en arrière-plan, sans jamais faire
 * échouer l'analyse qui l'a produit (l'échec est journalisé, pas propagé).
 */
setUsageRecorder((entry) => {
  void adminClient()
    .from("ai_usage")
    .insert({
      organization_id: entry.context?.organizationId ?? null,
      project_id: entry.context?.projectId ?? null,
      task: entry.task,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      duration_ms: entry.durationMs,
      ok: entry.ok,
    })
    .then(({ error }) => {
      if (error) console.warn(JSON.stringify({ event: "ai_usage_write_skipped", task: entry.task, reason: error.message }));
    });
});
