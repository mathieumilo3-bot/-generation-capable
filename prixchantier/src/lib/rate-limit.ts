import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { ActionError } from "@/lib/session";

type Rule = { windowSeconds: number; max: number };

export const RATE_RULES = {
  upload: { windowSeconds: 3600, max: 200 },
  analysis: { windowSeconds: 3600, max: 30 },
  send: { windowSeconds: 3600, max: 150 },
  export: { windowSeconds: 3600, max: 120 },
  oauth: { windowSeconds: 600, max: 20 },
  auth: { windowSeconds: 600, max: 15 },
  destructive: { windowSeconds: 3600, max: 10 },
} satisfies Record<string, Rule>;

/** Limite partagée entre instances serveur (stockée en base). */
export async function enforceRateLimit(bucket: keyof typeof RATE_RULES, subject: string) {
  const rule = RATE_RULES[bucket];
  const { data, error } = await adminClient().rpc("rate_limit_hit", {
    p_key: `${bucket}:${subject}`,
    p_window_seconds: rule.windowSeconds,
    p_max: rule.max,
  });
  if (error) {
    console.error("[rate-limit] indisponible:", error.message);
    throw new ActionError("Service momentanément indisponible. Réessayez dans un instant.");
  }
  if (data === false) {
    throw new ActionError("Trop de requêtes. Patientez quelques minutes avant de réessayer.");
  }
}
