import { createClient } from "@supabase/supabase-js";
import { createHttpEngineClient } from "@app/video-engine";
import { SupabaseBlobs } from "./blobs.ts";
import { loadConfig } from "./config.ts";
import { sendPendingEmails } from "./mail-loop.ts";
import { runRetention } from "./retention.ts";
import { Orchestrator, consoleLog } from "./orchestrator.ts";
import { SupabaseStore } from "./store.ts";

/**
 * Orchestrateur de production : à déployer À CÔTÉ du moteur vidéo (même réseau privé). C'est le seul composant
 * qui parle au moteur ; l'application mobile ne le connaît pas et ne peut pas l'atteindre.
 * Secrets : clé secrète Supabase + jeton serveur-à-serveur du moteur — jamais embarqués dans un client.
 */
const cfg = loadConfig();
const sb = createClient(cfg.SUPABASE_URL, cfg.SB_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const store = new SupabaseStore(sb);
const engine = createHttpEngineClient({ baseUrl: cfg.ENGINE_URL, token: cfg.ENGINE_TOKEN });
const blobs = new SupabaseBlobs(sb, { url: cfg.SUPABASE_URL, secretKey: cfg.SB_SECRET_KEY });

const extras: ConstructorParameters<typeof Orchestrator>[0]["extras"] = [];
if (cfg.CRON_SECRET) {
  const fn = `${cfg.FUNCTIONS_URL ?? `${cfg.SUPABASE_URL}/functions/v1`}/auto-reload-run`;
  extras.push({ name: "auto-reload", everyMs: 120_000, run: async () => {
    const r = await fetch(fn, { method: "POST", headers: { "x-cron-secret": cfg.CRON_SECRET! } });
    if (!r.ok) throw new Error(`auto-reload-run ${r.status}`);
  } });
}
if (cfg.RESEND_API_KEY && cfg.EMAIL_FROM) {
  extras.push({ name: "emails", everyMs: 15_000, run: () => sendPendingEmails(store, {
    mailer: { apiKey: cfg.RESEND_API_KEY!, from: cfg.EMAIL_FROM! }, brand: cfg.PRODUCT_NAME, retentionHours: cfg.RETENTION_HOURS, supportEmail: cfg.SUPPORT_EMAIL, webUrl: cfg.APP_WEB_URL, log: consoleLog,
  }) });
} else consoleLog("warn", "e-mails transactionnels désactivés (RESEND_API_KEY / EMAIL_FROM absents)");
extras.push({ name: "retention", everyMs: 5 * 60_000, run: () => runRetention(store, blobs, { log: consoleLog }) });

const orch = new Orchestrator({ store, engine, blobs, cfg, extras });
await orch.start();
for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => { void orch.stop().then(() => process.exit(0)); });
