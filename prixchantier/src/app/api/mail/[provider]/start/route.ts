import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/session";
import { env, googleConfigured, microsoftConfigured } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { authorizationUrl, newPkce, OAUTH_COOKIE, type OAuthProvider } from "@/lib/mail/oauth";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/mail/[provider]/start">) {
  const { provider } = await ctx.params;
  const back = request.nextUrl.searchParams.get("next");
  const returnTo = back && back.startsWith("/") && !back.startsWith("//") ? back : "/parametres";
  const fail = (code: string) => NextResponse.redirect(new URL(`${returnTo}?mail_error=${code}`, env().APP_URL));

  if (provider !== "google" && provider !== "microsoft") return fail("provider");
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL("/login", env().APP_URL));
  if ((provider === "google" && !googleConfigured()) || (provider === "microsoft" && !microsoftConfigured())) {
    return fail("not_configured");
  }
  try {
    await enforceRateLimit("oauth", user.id);
  } catch {
    return fail("rate_limited");
  }

  const pkce = newPkce();
  const res = NextResponse.redirect(authorizationUrl(provider as OAuthProvider, pkce.state, pkce.challenge, user.email ?? undefined));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state: pkce.state, verifier: pkce.verifier, provider, returnTo }), {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/api/mail",
    maxAge: 600,
  });
  return res;
}
