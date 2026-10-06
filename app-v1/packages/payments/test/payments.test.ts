import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PUBLIC_SETTINGS } from "@app/config";
import { ApplePaymentProvider, StripePaymentProvider, createPaymentProvider, type NativeStoreAdapter, type ServerPaymentApi, type StorePurchase } from "../src/index";

const S = DEFAULT_PUBLIC_SETTINGS;
const purchase: StorePurchase = { productId: "wallet_topup_10", transactionId: "tx1", signedTransaction: "jws" };
const mkApi = (over: Partial<ServerPaymentApi> = {}): ServerPaymentApi => ({
  createCheckout: vi.fn(async () => ({ ok: true as const, url: "https://checkout.stripe.test/s", payment_id: "p1" })),
  verifyStorePurchase: vi.fn(async () => ({ ok: true as const, credited_cents: 1000, payment_id: "p2" })),
  ...over,
});
const mkStore = (over: Partial<NativeStoreAdapter> = {}): NativeStoreAdapter => ({
  purchase: vi.fn(async () => ({ status: "purchased" as const, purchase })),
  finish: vi.fn(async () => undefined),
  pending: vi.fn(async () => []),
  ...over,
});

describe("sélection du fournisseur par build", () => {
  it("web → Stripe ; ios → Apple ; android → Google", () => {
    expect(createPaymentProvider("web", S, { api: mkApi() }).id).toBe("stripe");
    expect(createPaymentProvider("ios", S, { api: mkApi(), nativeStore: mkStore() }).id).toBe("apple");
    expect(createPaymentProvider("android", S, { api: mkApi(), nativeStore: mkStore() }).id).toBe("google");
  });
  it("un build store sans adaptateur natif échoue au démarrage (jamais un faux paiement)", () => {
    expect(() => createPaymentProvider("ios", S, { api: mkApi() })).toThrow(/StoreKit/);
  });
  it("la matrice serveur peut changer le fournisseur sans republier l'app", () => {
    const s = { ...S, "payments.providers": { ...S["payments.providers"], ios: { provider: "stripe" as const, free_amount: true, auto_reload: true, saved_cards: true } } };
    expect(createPaymentProvider("ios", s, { api: mkApi() }).id).toBe("stripe");
  });
});

describe("Stripe", () => {
  const p = () => createPaymentProvider("web", S, { api: mkApi() }) as StripePaymentProvider;
  it("redirige vers Checkout (le crédit viendra du webhook, pas d'ici)", async () => {
    expect(await p().topup({ amountCents: 2500, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "redirect", url: "https://checkout.stripe.test/s" });
  });
  it("refuse un montant sous le minimum avant tout appel serveur", async () => {
    const api = mkApi();
    const prov = new StripePaymentProvider(createPaymentProvider("web", S, { api }).capabilities, api, S);
    expect(await prov.topup({ amountCents: 500, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "failed", code: "amount_too_low" });
    expect(api.createCheckout).not.toHaveBeenCalled();
  });
  it("erreur réseau → échec propre", async () => {
    const api = mkApi({ createCheckout: async () => { throw new Error("offline"); } });
    const prov = new StripePaymentProvider(createPaymentProvider("web", S, { api }).capabilities, api, S);
    expect(await prov.topup({ amountCents: 1000, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "failed", code: "network_error" });
  });
});

describe("Apple / Google (achats consommables)", () => {
  const mk = (api: ServerPaymentApi, store: NativeStoreAdapter) => createPaymentProvider("ios", S, { api, nativeStore: store }) as ApplePaymentProvider;

  it("vérifie côté serveur AVANT de finaliser l'achat côté store", async () => {
    const order: string[] = [];
    const api = mkApi({ verifyStorePurchase: async () => { order.push("verify"); return { ok: true, credited_cents: 1000, payment_id: "p" }; } });
    const store = mkStore({ finish: async () => { order.push("finish"); } });
    const r = await mk(api, store).topup({ amountCents: 1000, idempotencyKey: "k", returnUrl: "x" });
    expect(r).toEqual({ status: "completed", creditedCents: 1000, paymentId: "p" });
    expect(order).toEqual(["verify", "finish"]);
  });
  it("si le serveur refuse, l'achat n'est PAS finalisé (récupérable)", async () => {
    const api = mkApi({ verifyStorePurchase: async () => ({ ok: false, code: "invalid_receipt" }) });
    const store = mkStore();
    expect(await mk(api, store).topup({ amountCents: 1000, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "failed", code: "invalid_receipt" });
    expect(store.finish).not.toHaveBeenCalled();
  });
  it("serveur injoignable : 'pending' puis récupération au prochain démarrage", async () => {
    let up = false;
    const api = mkApi({ verifyStorePurchase: async () => { if (!up) throw new Error("down"); return { ok: true, credited_cents: 1000, payment_id: "p" }; } });
    const store = mkStore({ pending: async () => [purchase] });
    const prov = mk(api, store);
    expect(await prov.topup({ amountCents: 1000, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "pending" });
    expect(store.finish).not.toHaveBeenCalled();
    up = true;
    const rec = await prov.recoverPending();
    expect(rec).toEqual([{ status: "completed", creditedCents: 1000, paymentId: "p" }]);
    expect(store.finish).toHaveBeenCalledTimes(1);
  });
  it("annulation par l'utilisateur", async () => {
    const store = mkStore({ purchase: async () => ({ status: "cancelled" as const }) });
    expect(await mk(mkApi(), store).topup({ amountCents: 1000, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "cancelled" });
  });
  it("montant hors packs → refusé (pas de montant libre sur les stores)", async () => {
    expect(await mk(mkApi(), mkStore()).topup({ amountCents: 1234, idempotencyKey: "k", returnUrl: "x" })).toEqual({ status: "failed", code: "unsupported" });
  });
});
