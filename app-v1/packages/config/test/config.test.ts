import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_SETTINGS, compareVersions, isAppVersionSupported, parseClientEnv, parsePublicSettings } from "../src/index";

describe("parsePublicSettings", () => {
  it("garde les défauts sans lignes", () => {
    expect(parsePublicSettings([]).settings).toEqual(DEFAULT_PUBLIC_SETTINGS);
  });
  it("applique les valeurs serveur valides", () => {
    const { settings } = parsePublicSettings([{ key: "wallet.min_topup_cents", value: 1500 }]);
    expect(settings["wallet.min_topup_cents"]).toBe(1500);
  });
  it("ignore une valeur invalide sans casser l'app", () => {
    const { settings, issues } = parsePublicSettings([{ key: "wallet.min_topup_cents", value: "dix" }]);
    expect(settings["wallet.min_topup_cents"]).toBe(1000);
    expect(issues).toHaveLength(1);
  });
  it("ignore les clés inconnues", () => {
    expect(parsePublicSettings([{ key: "future.thing", value: 1 }]).issues).toHaveLength(0);
  });
});

describe("versions", () => {
  it("compare", () => {
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
  });
  it("version minimale", () => {
    const s = { ...DEFAULT_PUBLIC_SETTINGS, "app.min_version": { ios: "1.2.0", android: "1.0.0", web: "1.0.0" } };
    expect(isAppVersionSupported(s, "ios", "1.1.9")).toBe(false);
    expect(isAppVersionSupported(s, "android", "1.1.9")).toBe(true);
  });
});

describe("parseClientEnv", () => {
  it("refuse une config incomplète avec un message actionnable", () => {
    expect(() => parseClientEnv({})).toThrow(/SETUP_REQUIRED/);
  });
  it("accepte une config valide", () => {
    const env = parseClientEnv({ EXPO_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxx" });
    expect(env.appEnv).toBe("development");
  });
});
