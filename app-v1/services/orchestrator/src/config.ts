import { z } from "zod";

const num = (d: number) => z.coerce.number().default(d);

const Schema = z.object({
  SUPABASE_URL: z.url(),
  SB_SECRET_KEY: z.string().min(10),             // sb_secret_… ou service_role : SERVEUR UNIQUEMENT
  ENGINE_URL: z.url(),
  ENGINE_TOKEN: z.string().min(16),
  FUNCTIONS_URL: z.url().optional(),             // défaut : ${SUPABASE_URL}/functions/v1
  CRON_SECRET: z.string().min(16).optional(),
  WORKER_ID: z.string().default(`orch-${process.pid}`),
  CONCURRENCY: num(2),
  POLL_MS: num(1500),
  STATUS_POLL_MS: num(3000),
  LEASE_SECONDS: num(600),
  JOB_TIMEOUT_MS: num(60 * 60_000),
  ENGINE_FLAKY_TOLERANCE: num(20),               // échecs réseau consécutifs tolérés pendant le suivi d'un job
  ASSET_URL_TTL_SECONDS: num(6 * 3600),
  USD_EUR: num(0.92),
  RENDER_COST_MICRO_EUR_PER_SEC: num(0),         // coût de calcul estimé (à calibrer sur l'infra réelle)
  STORAGE_COST_MICRO_EUR_PER_GB_MONTH: num(0),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PRODUCT_NAME: z.string().default("Montage"),
  SUPPORT_EMAIL: z.string().default("support@example.com"),
  APP_WEB_URL: z.url().default("https://app.example.com"),
});
export type OrchestratorConfig = z.infer<typeof Schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): OrchestratorConfig {
  const r = Schema.safeParse(env);
  if (!r.success) {
    throw new Error("Configuration orchestrateur invalide (voir SETUP_REQUIRED.md) : " + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return r.data;
}
