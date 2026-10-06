import { describe, expect, it } from "vitest";
import { loadEnv, looksLikeSecretKey } from "../src/env";

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (role: string) => `${b64url({ alg: "HS256" })}.${b64url({ role })}.signature`;

describe("environnement public", () => {
  const base = { VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijkl" };
  it("accepte la clé publishable et lit l'URL publique de l'app", () => {
    const r = loadEnv({ ...base, VITE_PUBLIC_APP_URL: "https://app.example.com" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.env.publicAppUrl).toBe("https://app.example.com");
  });
  it("repli sur VITE_WEB_BASE_URL, sinon undefined", () => {
    const r1 = loadEnv({ ...base, VITE_WEB_BASE_URL: "https://web.example.com" });
    expect(r1.ok && r1.env.publicAppUrl).toBe("https://web.example.com");
    const r2 = loadEnv(base);
    expect(r2.ok && r2.env.publicAppUrl).toBeUndefined();
  });
  it("erreur claire si l'URL Supabase manque ou est invalide", () => {
    expect(loadEnv({}).ok).toBe(false);
    expect(loadEnv({ ...base, VITE_SUPABASE_URL: "pas-une-url" }).ok).toBe(false);
  });
  it("refuse une clé secrète (sb_secret_… ou JWT du rôle serveur)", () => {
    expect(looksLikeSecretKey("sb_secret_abcdefghijkl")).toBe(true);
    expect(looksLikeSecretKey(jwt("service_role"))).toBe(true);
    expect(looksLikeSecretKey(jwt("anon"))).toBe(false);
    expect(looksLikeSecretKey("sb_publishable_abcdefghijkl")).toBe(false);
    const r = loadEnv({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") });
    expect(r.ok).toBe(false);
  });
});
