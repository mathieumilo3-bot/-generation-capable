/**
 * analytics.track() (§46). Aucune donnée sensible n'est jamais transmise :
 * le sanitizer retire clés et valeurs à risque AVANT tout envoi, quel que soit le sink.
 */
export const EVENTS = [
  "app_opened", "signup_started", "signup_completed", "login_completed", "creation_started", "upload_started",
  "upload_completed", "pricing_viewed", "job_submitted", "job_completed", "job_failed", "video_played",
  "video_downloaded", "revision_started", "wallet_viewed", "topup_started", "topup_completed",
  "auto_reload_enabled", "payment_failed", "account_deleted",
] as const;
export type EventName = (typeof EVENTS)[number];
export type PropValue = string | number | boolean | null;
export type Props = Record<string, PropValue>;

export interface AnalyticsSink {
  name: string;
  track(event: EventName, props: Props, ctx: { anonId: string; userId: string | null; platform: string; appVersion: string }): void | Promise<void>;
}

const SENSITIVE_KEY = /(mail|phone|tel|token|password|passwd|secret|key|auth|name|address|adresse|card|iban|vat|tva|siret|instruction|brief|message|note|url|path|filename|ip)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const JWT = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const LONG_OPAQUE = /^[A-Za-z0-9_\-+/=]{32,}$/;

export function sanitizeProps(input: Record<string, unknown> | undefined): Props {
  const out: Props = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(k) && !/_(id|cents|count|sec|bytes)$/.test(k)) continue;
    if (v === null || typeof v === "boolean") { out[k] = v; continue; }
    if (typeof v === "number") { if (Number.isFinite(v)) out[k] = v; continue; }
    if (typeof v === "string") {
      if (EMAIL.test(v) || JWT.test(v) || LONG_OPAQUE.test(v)) continue;
      out[k] = v.slice(0, 100);
    }
  }
  return out;
}

export function createAnalytics(cfg: { sinks: AnalyticsSink[]; platform: string; appVersion: string; anonId: string; enabled?: () => boolean }) {
  let userId: string | null = null;
  return {
    setUser(id: string | null) { userId = id; },
    track(event: EventName, props?: Record<string, unknown>) {
      if (cfg.enabled && !cfg.enabled()) return;
      const clean = sanitizeProps(props);
      for (const s of cfg.sinks) {
        try {
          const r = s.track(event, clean, { anonId: cfg.anonId, userId, platform: cfg.platform, appVersion: cfg.appVersion });
          if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => undefined);
        } catch { /* l'analytique ne doit jamais casser l'app */ }
      }
    },
  };
}
export type Analytics = ReturnType<typeof createAnalytics>;

export const consoleSink: AnalyticsSink = {
  name: "console",
  track: (e, p) => { if (typeof console !== "undefined") console.debug(`[analytics] ${e}`, p); },
};

/** Sink de repli : écrit un événement structuré en base via une fonction fournie (pas de tiers requis). */
export function httpSink(post: (body: { event: EventName; props: Props; anon_id: string; user_id: string | null; platform: string; app_version: string }) => Promise<unknown>): AnalyticsSink {
  return { name: "http", track: async (event, props, ctx) => { await post({ event, props, anon_id: ctx.anonId, user_id: ctx.userId, platform: ctx.platform, app_version: ctx.appVersion }); } };
}
