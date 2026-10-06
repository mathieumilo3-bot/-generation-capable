import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_SETTINGS as S } from "@app/config";
import { describeHistoryRow, suggestTopup, topupChoices, type PricingRule } from "@app/domain";
import {
  CONFIRM_TIMEOUT_MS, afterPaymentRoute, autoReloadConsent, confirmationState, explainLedger, groupByDay, initialTopupAmount, mapTopupResult,
  parseAmountParam, parsePaymentStatus, parsePendingTopup, perceivedValue, safeReturnTo, topupAmountState, validateAutoReload,
} from "../src/features/wallet/logic";

/** formatEuros met une espace insécable avant « € » : on compare sur des espaces normales. */
const n = (s: string | null): string | null => (s === null ? s : s.replace(/\u00a0/g, " "));

const rule = (over: Partial<PricingRule>): PricingRule => ({
  id: "r1", mode: "edit_rushes", bucket_key: "lt_30s", label: "Moins de 30 s", duration_min_sec: 0, duration_max_sec: 30, price_cents: 242, currency: "EUR",
  active: true, effective_from: "2020-01-01T00:00:00Z", effective_to: null, sort_order: 1, ...over,
});

describe("règle de retour après paiement", () => {
  it("n'accepte que des routes internes", () => {
    expect(safeReturnTo("/create/summary?projectId=abc")).toBe("/create/summary?projectId=abc");
    expect(safeReturnTo(encodeURIComponent("/create/summary?projectId=abc"))).toBe("/create/summary?projectId=abc");
    expect(safeReturnTo("https://evil.example/phish")).toBeNull();
    expect(safeReturnTo("//evil.example")).toBeNull();
    expect(safeReturnTo("javascript:alert(1)")).toBeNull();
    expect(safeReturnTo("/ok\\..\\evil")).toBeNull();
    expect(safeReturnTo("/payment-result?status=success")).toBeNull();
    expect(safeReturnTo("")).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
  });
  it("retourne au récapitulatif seulement après un succès", () => {
    const back = "/create/summary?projectId=p1";
    expect(afterPaymentRoute("completed", back)).toBe(back);
    expect(afterPaymentRoute("success", back)).toBe(back);
    expect(afterPaymentRoute("success", null)).toBeNull();
    expect(afterPaymentRoute("failed", back)).toBeNull();
    expect(afterPaymentRoute("cancelled", back)).toBeNull();
    expect(afterPaymentRoute("pending", back)).toBeNull();
  });
  it("lit le statut du retour navigateur", () => {
    expect(parsePaymentStatus("success")).toBe("success");
    expect(parsePaymentStatus("cancelled")).toBe("cancelled");
    expect(parsePaymentStatus("failed")).toBe("failed");
    expect(parsePaymentStatus("paid")).toBeNull();
    expect(parsePaymentStatus(undefined)).toBeNull();
  });
});

describe("mapping résultat fournisseur → UI", () => {
  it("couvre tous les statuts", () => {
    expect(mapTopupResult({ status: "redirect", url: "https://x.test" })).toEqual({ kind: "redirect", url: "https://x.test" });
    expect(mapTopupResult({ status: "completed", creditedCents: 1000, paymentId: "p" })).toEqual({ kind: "completed", creditedCents: 1000 });
    expect(mapTopupResult({ status: "pending" })).toEqual({ kind: "pending" });
    expect(mapTopupResult({ status: "cancelled" })).toEqual({ kind: "cancelled" });
    expect(mapTopupResult({ status: "failed", code: "payment_failed" })).toEqual({ kind: "failed", code: "payment_failed" });
  });
  it("un achat store en attente n'est pas un échec", () => {
    expect(mapTopupResult({ status: "failed", code: "purchase_pending" })).toEqual({ kind: "pending" });
  });
});

describe("montant suggéré et montant libre", () => {
  it("suggère le plus petit montant couvrant le manque (web : préréglages)", () => {
    const presets = topupChoices("web", S);
    expect(suggestTopup(124, S["wallet.min_topup_cents"], presets)).toBe(1000);
    expect(suggestTopup(1200, S["wallet.min_topup_cents"], presets)).toBe(2000);
    expect(suggestTopup(30000, S["wallet.min_topup_cents"], presets)).toBe(30000);
  });
  it("sur les stores, seul un pack est proposé", () => {
    const packs = topupChoices("ios", S);
    expect(packs).toEqual([1000, 2000, 5000, 10000]);
    expect(suggestTopup(2100, S["wallet.min_topup_cents"], packs)).toBe(5000);
  });
  it("valide une saisie libre contre le minimum et le maximum serveur", () => {
    expect(topupAmountState("", S)).toEqual({ cents: null, error: null });
    expect(topupAmountState("25", S).cents).toBe(2500);
    expect(topupAmountState("12,5", S).cents).toBe(1250);
    expect(topupAmountState("5", S).error).toMatch(/minimum/i);
    expect(topupAmountState("5000", S).error).toMatch(/maximum/i);
    expect(topupAmountState("abc", S).cents).toBeNull();
    expect(topupAmountState("10,999", S).cents).toBeNull();
  });
  it("présélectionne le montant demandé quand il est proposé", () => {
    const base = { choices: topupChoices("web", S), freeAmount: true, settings: S };
    expect(initialTopupAmount({ ...base, requested: 2500 })).toEqual({ selected: 2500, custom: false });
    expect(initialTopupAmount({ ...base, requested: 3300 })).toEqual({ selected: 3300, custom: true });
    expect(initialTopupAmount({ ...base, requested: null })).toEqual({ selected: 1000, custom: false });
    const store = { choices: topupChoices("ios", S), freeAmount: false, settings: S };
    expect(initialTopupAmount({ ...store, requested: 3300 })).toEqual({ selected: 5000, custom: false });
    expect(initialTopupAmount({ ...store, requested: 99999999 })).toEqual({ selected: 1000, custom: false });
  });
  it("lit le paramètre amount de façon stricte", () => {
    expect(parseAmountParam("1000")).toBe(1000);
    expect(parseAmountParam("-5")).toBeNull();
    expect(parseAmountParam("10.5")).toBeNull();
    expect(parseAmountParam("0")).toBeNull();
    expect(parseAmountParam(undefined)).toBeNull();
  });
});

describe("valeur perçue", () => {
  it("« 10 € = 4 montages ≤ 30 s » avec les règles chargées", () => {
    expect(n(perceivedValue(1000, [rule({})]))).toBe("10 € = 4 montages ≤ 30 s");
  });
  it("aucun prix inventé sans règle, ni montage impossible", () => {
    expect(perceivedValue(1000, [])).toBeNull();
    expect(perceivedValue(100, [rule({})])).toBeNull();
    expect(perceivedValue(1000, [rule({ active: false })])).toBeNull();
  });
  it("singulier et minutes", () => {
    expect(n(perceivedValue(300, [rule({})]))).toBe("3 € = 1 montage ≤ 30 s");
    expect(n(perceivedValue(5000, [rule({ duration_max_sec: 120, price_cents: 700 })]))).toBe("50 € = 7 montages ≤ 2 min");
  });
});

describe("confirmation du crédit", () => {
  it("confirmé dès que le solde change ou que le paiement est réussi", () => {
    expect(confirmationState({ elapsedMs: 1000, baselineCents: 2640, currentCents: 3640, paymentSucceeded: false })).toBe("confirmed");
    expect(confirmationState({ elapsedMs: 1000, baselineCents: 2640, currentCents: 2640, paymentSucceeded: true })).toBe("confirmed");
  });
  it("attend puis s'arrête honnêtement après ~30 s", () => {
    expect(confirmationState({ elapsedMs: 5000, baselineCents: 2640, currentCents: 2640, paymentSucceeded: false })).toBe("waiting");
    expect(confirmationState({ elapsedMs: CONFIRM_TIMEOUT_MS, baselineCents: 2640, currentCents: 2640, paymentSucceeded: false })).toBe("timeout");
    expect(confirmationState({ elapsedMs: 100, baselineCents: null, currentCents: 2640, paymentSucceeded: false })).toBe("waiting");
  });
});

describe("historique", () => {
  const now = new Date(2026, 9, 6, 15, 0, 0);
  const row = (id: string, at: Date, delta: number, type: "topup" | "hold" | "release") =>
    describeHistoryRow({ id, type, available_delta_cents: delta, amount_cents: Math.abs(delta), reference: null, created_at: at.toISOString() });
  it("regroupe par jour dans l'ordre", () => {
    const items = [
      row("a", new Date(2026, 9, 6, 14, 0), 2500, "topup"),
      row("b", new Date(2026, 9, 6, 9, 0), -484, "hold"),
      row("c", new Date(2026, 9, 5, 20, 0), 484, "release"),
      row("d", new Date(2026, 9, 1, 8, 0), 1000, "topup"),
    ];
    const g = groupByDay(items, now);
    expect(g.map((s) => s.label)).toEqual(["Aujourd'hui", "Hier", expect.stringMatching(/1/)]);
    expect(g[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("libellés humains et explications", () => {
    expect(n(row("a", now, 2500, "topup").amountLabel)).toBe("+25,00 €");
    expect(n(row("b", now, -484, "hold").amountLabel)).toBe("−4,84 €");
    expect(explainLedger("release")).toMatch(/intact/);
    expect(explainLedger("hold")).toMatch(/libéré automatiquement/);
  });
});

describe("recharge automatique", () => {
  it("valide les trois réglages", () => {
    expect(validateAutoReload({ thresholdCents: 500, amountCents: 2000, monthlyCapCents: 10000 }, S)).toBeNull();
    expect(validateAutoReload({ thresholdCents: 500, amountCents: 500, monthlyCapCents: 10000 }, S)).toMatch(/au moins/);
    expect(validateAutoReload({ thresholdCents: 500, amountCents: 2000, monthlyCapCents: 1000 }, S)).toMatch(/plafond/i);
    expect(validateAutoReload({ thresholdCents: -1, amountCents: 2000, monthlyCapCents: 10000 }, S)).toMatch(/seuil/);
  });
  it("le consentement dit seuil, montant, plafond et comment annuler", () => {
    const t = n(autoReloadConsent({ thresholdCents: 500, amountCents: 2500, monthlyCapCents: 10000 })) as string;
    expect(t).toContain("25 €");
    expect(t).toContain("5 €");
    expect(t).toContain("100 €");
    expect(t).toMatch(/désactiver à tout moment/);
  });
});

describe("paiement navigateur mémorisé", () => {
  it("relit un enregistrement récent et valide", () => {
    const rec = JSON.stringify({ returnTo: "/create/summary?projectId=p1", amountCents: 1000, baselineCents: 100, startedAt: 1_000_000 });
    expect(parsePendingTopup(rec, 1_000_500)).toEqual({ returnTo: "/create/summary?projectId=p1", amountCents: 1000, baselineCents: 100, startedAt: 1_000_000 });
  });
  it("ignore un enregistrement ancien, corrompu ou une destination externe", () => {
    expect(parsePendingTopup(JSON.stringify({ startedAt: 1 }), 1 + 7 * 3600_000)).toBeNull();
    expect(parsePendingTopup("{oops", 1)).toBeNull();
    expect(parsePendingTopup(null)).toBeNull();
    expect(parsePendingTopup(JSON.stringify({ returnTo: "https://evil.test", startedAt: 5 }), 6)?.returnTo).toBeNull();
  });
});
