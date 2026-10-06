import { describe, expect, it } from "vitest";
import { centsHint, jsonKind, parseSettingJson, validateSettingValue } from "../src/lib/settings";

const others = {
  "wallet.min_topup_cents": 1000,
  "wallet.max_topup_cents": 100000,
  "upload.max_file_bytes": 2_147_483_648,
  "upload.max_total_bytes": 8_589_934_592,
};

const sp = (v: string | null): string | null => (v === null ? null : v.replace(/[\u00a0\u202f]/g, " "));

describe("parseSettingJson", () => {
  it("accepte du JSON valide, refuse le reste", () => {
    expect(parseSettingJson("1000")).toEqual({ ok: true, value: 1000 });
    expect(parseSettingJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseSettingJson("").ok).toBe(false);
    expect(parseSettingJson("{a:1}").ok).toBe(false);
    expect(parseSettingJson("x".repeat(30000)).ok).toBe(false);
  });
  it("jsonKind", () => {
    expect(jsonKind(null)).toBe("null");
    expect(jsonKind([1])).toBe("array");
    expect(jsonKind({})).toBe("object");
    expect(jsonKind(true)).toBe("boolean");
  });
});

describe("validateSettingValue : garde-fous", () => {
  it("refuse un changement de type", () => {
    const r = validateSettingValue("maintenance.enabled", '"oui"', { current: false, others });
    expect(r.ok).toBe(false);
  });
  it("maintenance : sensible + avertissement", () => {
    const r = validateSettingValue("maintenance.enabled", "true", { current: false, others });
    expect(r).toMatchObject({ ok: true, risk: "high" });
    if (r.ok) expect(r.warnings.join(" ")).toContain("bloque");
  });
  it("recharge minimale : plancher 0,50 €, et ≤ maximum", () => {
    expect(validateSettingValue("wallet.min_topup_cents", "10", { current: 1000, others }).ok).toBe(false);
    expect(validateSettingValue("wallet.min_topup_cents", "200000", { current: 1000, others }).ok).toBe(false);
    expect(validateSettingValue("wallet.min_topup_cents", "1500", { current: 1000, others }).ok).toBe(true);
    expect(validateSettingValue("wallet.max_topup_cents", "500", { current: 100000, others }).ok).toBe(false);
  });
  it("montants en centimes : entiers uniquement (pas de décimale)", () => {
    expect(validateSettingValue("wallet.low_balance_threshold_cents", "5.5", { current: 500, others }).ok).toBe(false);
    expect(validateSettingValue("wallet.low_balance_threshold_cents", "-1", { current: 500, others }).ok).toBe(false);
    expect(validateSettingValue("wallet.low_balance_threshold_cents", "700", { current: 500, others }).ok).toBe(true);
  });
  it("schéma public de l'app cliente", () => {
    expect(validateSettingValue("app.min_version", '{"ios":"1.0.0"}', { current: { ios: "1.0.0", android: "1.0.0", web: "1.0.0" }, others }).ok).toBe(false);
    expect(validateSettingValue("app.min_version", '{"ios":"1.2","android":"1.0.0","web":"1.0.0"}', { current: { ios: "1.0.0", android: "1.0.0", web: "1.0.0" }, others }).ok).toBe(false);
    expect(validateSettingValue("app.min_version", '{"ios":"1.2.0","android":"1.0.0","web":"1.0.0"}', { current: { ios: "1.0.0", android: "1.0.0", web: "1.0.0" }, others }).ok).toBe(true);
  });
  it("URL https obligatoires", () => {
    expect(validateSettingValue("urls.terms", '"http://x.fr"', { current: "https://a.fr", others }).ok).toBe(false);
    expect(validateSettingValue("urls.terms", '"https://x.fr/cgu"', { current: "https://a.fr", others }).ok).toBe(true);
  });
  it("rétention : null ou 1..3650 jours, clé privée de type null autorisée", () => {
    expect(validateSettingValue("retention.raw_days", "30", { current: null, others })).toMatchObject({ ok: true, risk: "high" });
    expect(validateSettingValue("retention.raw_days", "0", { current: null, others }).ok).toBe(false);
    expect(validateSettingValue("retention.raw_days", "null", { current: 30, others }).ok).toBe(true);
  });
  it("taux de change : nombre strictement entre 0 et 10", () => {
    expect(validateSettingValue("fx.usd_eur", "0.95", { current: 0.92, others }).ok).toBe(true);
    expect(validateSettingValue("fx.usd_eur", "0", { current: 0.92, others }).ok).toBe(false);
    expect(validateSettingValue("fx.usd_eur", "95", { current: 0.92, others }).ok).toBe(false);
  });
  it("taille par fichier ≤ taille par projet", () => {
    expect(validateSettingValue("upload.max_file_bytes", String(9_000_000_000), { current: 2_147_483_648, others }).ok).toBe(false);
  });
  it("aucun changement = refus", () => {
    expect(validateSettingValue("upload.max_files", "20", { current: 20, others }).ok).toBe(false);
  });
  it("clé inconnue : seul le type est contrôlé", () => {
    expect(validateSettingValue("custom.flag", "false", { current: true, others }).ok).toBe(true);
    expect(validateSettingValue("custom.flag", "1", { current: true, others }).ok).toBe(false);
  });
});

describe("centsHint", () => {
  it("convertit en euros pour les clés _cents", () => {
    expect(sp(centsHint("wallet.min_topup_cents", 1000))).toBe("10,00 €");
    expect(sp(centsHint("wallet.topup_presets_cents", [1000, 2500]))).toBe("10,00 €, 25,00 €");
    expect(centsHint("maintenance.enabled", true)).toBeNull();
  });
});
