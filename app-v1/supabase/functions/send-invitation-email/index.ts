import { adminClient, env, json, limited, preflight, requireUser } from "../_shared/runtime.ts";
import { renderEmail } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/mailer.ts";

/** Envoie le lien d'invitation par e-mail. Réservé au rôle admin (vérifié en base, jamais dans le JWT utilisateur). */
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const user = await requireUser(req);
  if (!user) return json(req, { ok: false, code: "not_authenticated" }, 401);
  const sb = adminClient();
  const { data: role } = await sb.from("staff_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "admin") return json(req, { ok: false, code: "forbidden" }, 403);
  if (!(await limited(sb, `invmail:${user.id}`, 60, 3600))) return json(req, { ok: false, code: "rate_limited" }, 429);

  const b = await req.json().catch(() => ({}));
  const to = String(b.to ?? "").trim().toLowerCase();
  const token = String(b.token ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return json(req, { ok: false, code: "invalid_request" }, 400);
  const link = `${env("APP_WEB_URL").replace(/\/$/, "")}/invite/${token}`;
  const mail = renderEmail("invitation", { brand: env("PRODUCT_NAME", "Montage"), supportEmail: env("SUPPORT_EMAIL", "support@example.com"), firstName: b.firstName ? String(b.firstName).slice(0, 60) : null, ctaUrl: link });
  await sendEmail({ apiKey: env("RESEND_API_KEY"), from: env("EMAIL_FROM") }, { to, ...mail, idempotencyKey: `invite:${token.slice(0, 16)}:${to}` });
  return json(req, { ok: true });
});
