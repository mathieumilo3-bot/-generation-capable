import { adminClient, env, json, limited, log, optEnv, preflight, requireUser } from "../_shared/runtime.ts";
import { appleExchangeCode } from "../_shared/apple.ts";
import { encryptSecret } from "../_shared/crypto.ts";

/**
 * Sign in with Apple : conserve (chiffré AES-GCM) le refresh token Apple pour pouvoir le RÉVOQUER à la
 * suppression du compte. Reçoit soit l'authorizationCode natif (échangé ici), soit le refresh token OAuth.
 */
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const user = await requireUser(req);
  if (!user) return json(req, { ok: false, code: "not_authenticated" }, 401);
  if (user.provider !== "apple") return json(req, { ok: true, skipped: true });
  const sb = adminClient();
  if (!(await limited(sb, `applelink:${user.id}`, 10, 3600))) return json(req, { ok: false, code: "rate_limited" }, 429);
  const body = await req.json().catch(() => ({}));
  try {
    const cfg = { teamId: env("APPLE_TEAM_ID"), clientId: env("APPLE_CLIENT_ID"), keyId: env("APPLE_KEY_ID"), privateKeyPem: env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n") };
    const refresh = body.refreshToken ? String(body.refreshToken) : body.authorizationCode ? (await appleExchangeCode(cfg, String(body.authorizationCode))).refresh_token : null;
    if (!refresh) return json(req, { ok: false, code: "invalid_request" }, 400);
    await sb.from("apple_tokens").upsert({ user_id: user.id, refresh_token_enc: await encryptSecret(refresh, env("APPLE_TOKEN_ENC_KEY")), client_id: cfg.clientId });
    return json(req, { ok: true });
  } catch (e) {
    log("warn", "apple-link échoué", { user: user.id, error: (e as Error).message });
    return json(req, { ok: false, code: "apple_link_failed" }, 502);
  }
});
