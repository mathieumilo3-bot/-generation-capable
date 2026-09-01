import { NextResponse, type NextRequest } from "next/server";

const OWNER_COOKIE = "jarvis_session";
const OWNER_TOKEN_SHA256 = "acfc0baca30f02edf7ee20743e7d283d0a47e5f3813978c78b570cd83128bab3";
const NETLIFY_PRIVATE_MODE = process.env.JARVIS_NETLIFY_PRIVATE_MODE === "1";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (NETLIFY_PRIVATE_MODE) {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/api/auth" || pathname === "/api/health" || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = request.cookies.get(OWNER_COOKIE)?.value;
  const candidate = bearer || session;
  const authorized = candidate ? (await sha256Hex(candidate)) === OWNER_TOKEN_SHA256 : false;

  if (authorized) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
