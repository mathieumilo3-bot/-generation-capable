import { adminClient, env, json, limited, log, optEnv, preflight, requireUser, rpcOf } from "../_shared/runtime.ts";
import { appleRevoke } from "../_shared/apple.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { renderEmail } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/mailer.ts";

const BUCKETS = ["raw", "processed", "renders", "thumbnails", "temporary"];
const FRESH_AUTH_SEC = 600;

/** Supprime récursivement tout ce qui se trouve sous `{uid}/` dans un bucket (le Storage ne supprime pas par préfixe). */
async function purgePrefix(sb: ReturnType<typeof adminClient>, bucket: string, prefix: string): Promise<number> {
  let removed = 0;
  const walk = async (dir: string) => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await sb.storage.from(bucket).list(dir, { limit: 100, offset });
      if (error) throw new Error(error.message);
      if (!data?.length) return;
      const files = data.filter((e) => e.id).map((e) => `${dir}/${e.name}`);
      for (const f of data.filter((e) => !e.id)) await walk(`${dir}/${f.name}`);
      if (files.length) { const r = await sb.storage.from(bucket).remove(files); if (r.error) throw new Error(r.error.message); removed += files.length; }
      if (data.length < 100) return;
    }
  };
  await walk(prefix);
  return removed;
}

/**
 * Suppression de compte in-app (§31, Apple 5.1.1(v), Google Play) : réauthentification récente exigée,
 * annulation + libération des jobs actifs, révocation du jeton Apple, purge du Storage, suppression Auth
 * (cascade des projets/assets/jobs ; ledger et paiements ANONYMISÉS et conservés pour la comptabilité).
 */
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json(req, { ok: false, code: "method_not_allowed" }, 405);
  const user = await requireUser(req);
  if (!user) return json(req, { ok: false, code: "not_authenticated" }, 401);
  const sb = adminClient(); const rpc = rpcOf(sb);
  if (!(await limited(sb, `delacct:${user.id}`, 5, 3600))) return json(req, { ok: false, code: "rate_limited" }, 429);

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "SUPPRIMER") return json(req, { ok: false, code: "confirmation_required" }, 400);

  // Authentification récente (amr : horodatage de la dernière méthode d'authentification).
  const last = Math.max(0, ...user.amr.map((a) => Number(a.timestamp) || 0));
  if (Math.floor(Date.now() / 1000) - last > FRESH_AUTH_SEC) return json(req, { ok: false, code: "reauth_required" }, 401);

  try {
    const prep = await rpc<any>("svc_prepare_account_deletion", { p_user_id: user.id });
    if (!prep.ok) return json(req, { ok: false, code: prep.code }, 409);

    // 1. Apple : révocation du jeton (échec bloquant seulement si un jeton existe et que la révocation échoue).
    const { data: at } = await sb.from("apple_tokens").select("refresh_token_enc,client_id").eq("user_id", user.id).maybeSingle();
    if (at && optEnv("APPLE_PRIVATE_KEY")) {
      const token = await decryptSecret(at.refresh_token_enc, env("APPLE_TOKEN_ENC_KEY"));
      await appleRevoke({ teamId: env("APPLE_TEAM_ID"), clientId: at.client_id, keyId: env("APPLE_KEY_ID"), privateKeyPem: env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n") }, token);
    }
    // 2. Fichiers.
    let files = 0;
    for (const b of BUCKETS) files += await purgePrefix(sb, b, user.id);
    // 3. Compte Auth (cascade SQL).
    const { error } = await sb.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    await rpc("svc_complete_account_deletion", { p_user_id: user.id });
    log("info", "compte supprimé", { user: user.id, files });

    // 4. E-mail de confirmation (best effort, après suppression).
    if (user.email && optEnv("RESEND_API_KEY")) {
      const mail = renderEmail("account_deleted", { brand: env("PRODUCT_NAME", "Montage"), supportEmail: env("SUPPORT_EMAIL", "support@example.com") });
      await sendEmail({ apiKey: env("RESEND_API_KEY"), from: env("EMAIL_FROM") }, { to: user.email, ...mail, idempotencyKey: `account-deleted:${user.id}` }).catch(() => undefined);
    }
    return json(req, { ok: true });
  } catch (e) {
    log("error", "suppression de compte échouée", { user: user.id, error: (e as Error).message });
    return json(req, { ok: false, code: "deletion_failed" }, 500);   // idempotent : l'utilisateur peut relancer
  }
});
