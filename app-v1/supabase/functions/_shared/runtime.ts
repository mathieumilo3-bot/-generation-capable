// Code propre au runtime Edge (Deno). Tout le reste de _shared/ est du TypeScript pur, testé sous Node.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeJwtPayload } from "./jwt.ts";
import { safeEqual } from "./stripe-signature.ts";

export const env = (k: string, d?: string): string => {
  const v = Deno.env.get(k) ?? d;
  if (v === undefined || v === "") throw new Error(`missing_env:${k}`);
  return v;
};
export const optEnv = (k: string): string | undefined => Deno.env.get(k) || undefined;

export const SUPABASE_URL = () => env("SUPABASE_URL");
// Nouvelles clés (sb_secret_… / sb_publishable_…) avec repli sur les clés JWT historiques injectées par la plateforme.
export const SECRET_KEY = () => optEnv("SB_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
export const PUBLISHABLE_KEY = () => optEnv("SB_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");

export function adminClient() {
  return createClient(SUPABASE_URL(), SECRET_KEY(), { auth: { persistSession: false, autoRefreshToken: false } });
}

const allowed = () => (optEnv("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const list = allowed();
  const ok = list.includes("*") ? "*" : list.includes(origin) ? origin : list[0] ?? "";
  return {
    "access-control-allow-origin": ok,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...corsHeaders(req) } });
}

export const preflight = (req: Request): Response | null =>
  req.method === "OPTIONS" ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null;

export interface CallerUser { id: string; email: string | null; jwt: string; amr: { method: string; timestamp: number }[]; provider: string | null }

/** Vérifie le JWT utilisateur auprès de Supabase Auth (verify_jwt est désactivé côté plateforme pour les nouvelles clés). */
export async function requireUser(req: Request): Promise<CallerUser | null> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const sb = createClient(SUPABASE_URL(), PUBLISHABLE_KEY(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  const claims = decodeJwtPayload<{ amr?: { method: string; timestamp: number }[] }>(jwt);
  return { id: data.user.id, email: data.user.email ?? null, jwt, amr: claims.amr ?? [], provider: (data.user.app_metadata?.provider as string) ?? null };
}

/** Appels planifiés (cron / orchestrateur) : secret partagé, comparaison à temps constant. */
export function isCronCaller(req: Request): boolean {
  const secret = optEnv("CRON_SECRET");
  const got = req.headers.get("x-cron-secret") ?? "";
  return !!secret && safeEqual(secret, got);
}

export function log(level: "info" | "warn" | "error", msg: string, data: Record<string, unknown> = {}) {
  console[level === "error" ? "error" : "log"](JSON.stringify({ level, msg, ...data, ts: new Date().toISOString() }));
}

export function rpcOf(sb: ReturnType<typeof adminClient>) {
  return async <T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  };
}

export async function limited(sb: ReturnType<typeof adminClient>, key: string, max: number, windowSec: number): Promise<boolean> {
  const { data, error } = await sb.rpc("svc_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSec });
  if (error) throw new Error(error.message);
  return data === true;
}
