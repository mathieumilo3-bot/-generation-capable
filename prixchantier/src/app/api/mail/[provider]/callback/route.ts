import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAuthUser } from "@/lib/session";
import { env } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/mail/crypto";
import { exchangeCode, hasRequiredScopes, mailboxIdentity, OAuthError, OAUTH_COOKIE, type OAuthProvider } from "@/lib/mail/oauth";

function sameString(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/mail/[provider]/callback">) {
  const { provider } = await ctx.params;
  const raw = request.cookies.get(OAUTH_COOKIE)?.value;
  let saved: { state: string; verifier: string; provider: string; returnTo: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  const returnTo = saved?.returnTo ?? "/parametres";
  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`${returnTo}?${query}`, env().APP_URL));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/mail" });
    return res;
  };

  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const code = params.get("code");
  if (params.get("error")) return done("mail_error=denied");
  if (!saved || saved.provider !== provider || !code || !sameString(state, saved.state)) return done("mail_error=state");

  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL("/login", env().APP_URL));
  const admin = adminClient();
  const { data: profile } = await admin.from("users").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile) return done("mail_error=no_org");

  try {
    const p = provider as OAuthProvider;
    const tokens = await exchangeCode(p, code, saved.verifier);
    if (!hasRequiredScopes(p, tokens.scope)) return done("mail_error=scopes");
    if (!tokens.refreshToken) return done("mail_error=offline");
    const identity = await mailboxIdentity(p, tokens.accessToken);
    if (!identity.email) return done("mail_error=identity");

    const { error } = await admin.from("mail_connections").upsert(
      {
        organization_id: profile.organization_id,
        user_id: user.id,
        provider: p,
        email: identity.email,
        display_name: identity.name,
        status: "active",
        access_token_enc: encryptSecret(tokens.accessToken),
        refresh_token_enc: encryptSecret(tokens.refreshToken),
        token_expires_at: tokens.expiresAt.toISOString(),
        scopes: tokens.scope,
        last_error: null,
        // Ne relève que les messages reçus à partir de maintenant.
        last_polled_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,email" },
    );
    if (error) throw new Error(error.message);
    await admin.from("activity_logs").insert({
      organization_id: profile.organization_id,
      type: "mail_connected",
      message: `Boîte mail ${identity.email} connectée.`,
    });
    return done("mail=connected");
  } catch (err) {
    console.error("[oauth] échec de connexion:", err instanceof Error ? err.message : err);
    if (err instanceof OAuthError) {
      if (err.code === "invalid_client") return done("mail_error=invalid_client");
      if (err.code === "invalid_grant") return done("mail_error=invalid_grant");
      if (err.code === "redirect_uri_mismatch") return done("mail_error=redirect_uri");
      if (err.message.includes("profil Gmail")) return done("mail_error=identity");
    }
    return done("mail_error=exchange");
  }
}
