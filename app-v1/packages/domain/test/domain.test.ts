import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_SETTINGS } from "@app/config";
import {
  centsToInput, computeQuote, currentRules, describeHistoryRow, describeJob, formatBytes, formatDuration,
  formatEuros, humanizeError, errorCodeOf, normalizeCapabilities, availableModes, parseDeepLink, paymentCapabilities,
  parseEurosInput, routeForDeepLink, ruleForDuration, suggestTopup, topupChoices, usableMethods, validateTopupAmount,
  videosForAmount, microToCentsCeil, type PricingRule, type EditingMethod,
} from "../src/index";

const nb = (s: string) => s.replace(/[  ]/g, " ");

const rule = (over: Partial<PricingRule>): PricingRule => ({
  id: "r", mode: "edit_rushes", bucket_key: "b", label: "L", duration_min_sec: 0, duration_max_sec: 30,
  price_cents: 242, currency: "EUR", active: true, effective_from: "2026-01-01T00:00:00Z", effective_to: null, sort_order: 1, ...over,
});

describe("money", () => {
  it("formate en euros français", () => {
    expect(nb(formatEuros(2640))).toBe("26,40 €");
    expect(nb(formatEuros(484))).toBe("4,84 €");
    expect(nb(formatEuros(1000, { compact: true }))).toBe("10 €");
    expect(nb(formatEuros(123456))).toBe("1 234,56 €");
    expect(nb(formatEuros(-484, { signed: true }))).toBe("−4,84 €");
    expect(nb(formatEuros(2500, { signed: true }))).toBe("+25,00 €");
  });
  it("refuse les flottants", () => { expect(() => formatEuros(4.84)).toThrow(); });
  it("parse la saisie", () => {
    expect(parseEurosInput("12,5")).toBe(1250);
    expect(parseEurosInput("12.50 €")).toBe(1250);
    expect(parseEurosInput("1 250")).toBe(125000);
    expect(parseEurosInput("0,99")).toBe(99);
    expect(parseEurosInput("12,345")).toBeNull();
    expect(parseEurosInput("-5")).toBeNull();
    expect(parseEurosInput("abc")).toBeNull();
    expect(parseEurosInput("")).toBeNull();
  });
  it("aller-retour champ de saisie", () => {
    expect(centsToInput(1000)).toBe("10");
    expect(centsToInput(1250)).toBe("12,50");
    expect(parseEurosInput(centsToInput(1250))).toBe(1250);
  });
  it("coût µ€ arrondi au centime supérieur", () => { expect(microToCentsCeil(230000)).toBe(23); expect(microToCentsCeil(1)).toBe(1); });
});

describe("pricing", () => {
  const rules = [
    rule({ id: "a", bucket_key: "lt30", duration_max_sec: 30, price_cents: 242, sort_order: 1 }),
    rule({ id: "b", bucket_key: "30_60", duration_min_sec: 30, duration_max_sec: 60, price_cents: 484, sort_order: 2 }),
    rule({ id: "c", bucket_key: "old", duration_min_sec: 0, duration_max_sec: 30, price_cents: 100, active: false }),
    rule({ id: "d", mode: "autonomous", price_cents: 290 }),
  ];
  it("ne garde que les règles en vigueur du mode", () => {
    expect(currentRules(rules, "edit_rushes").map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("règle valide dans la fenêtre temporelle", () => {
    const future = rule({ id: "f", effective_from: "2999-01-01T00:00:00Z" });
    expect(currentRules([future], "edit_rushes")).toHaveLength(0);
    const ended = rule({ id: "e", effective_to: "2026-02-01T00:00:00Z" });
    expect(currentRules([ended], "edit_rushes", new Date("2026-03-01"))).toHaveLength(0);
  });
  it("bornes : min exclusif, max inclusif", () => {
    expect(ruleForDuration(rules, "edit_rushes", 30)?.id).toBe("a");
    expect(ruleForDuration(rules, "edit_rushes", 31)?.id).toBe("b");
    expect(ruleForDuration(rules, "edit_rushes", 61)).toBeUndefined();
  });
  it("devis : après création et manque", () => {
    expect(computeQuote(484, 2640)).toMatchObject({ afterCents: 2156, shortfallCents: 0, canAfford: true });
    expect(computeQuote(484, 360)).toMatchObject({ shortfallCents: 124, canAfford: false });
  });
  it("suggestion de recharge", () => {
    const p = DEFAULT_PUBLIC_SETTINGS["wallet.topup_presets_cents"];
    expect(suggestTopup(124, 1000, p)).toBe(1000);  // « Il manque 1,24 € » → « Ajouter 10 € »
    expect(suggestTopup(1500, 1000, p)).toBe(2000);
    expect(suggestTopup(30000, 1000, p)).toBe(30000);
    expect(suggestTopup(30001, 1000, p)).toBe(30500);
  });
  it("valeur perçue d'une recharge de 10 € (§59)", () => {
    const real = [rule({ id: "a", price_cents: 242 }), rule({ id: "b", bucket_key: "x", price_cents: 484, sort_order: 2 })];
    expect(videosForAmount(1000, real).map((v) => v.count)).toEqual([4, 2]);
  });
});

describe("états de job (§20)", () => {
  it("n'expose que des étapes humaines", () => {
    const v = describeJob("rendering", 70);
    expect(v.headline).toBe("Finalisation");
    expect(v.steps.map((s) => s.state)).toEqual(["done", "done", "done", "active", "todo"]);
    expect(v.percent).toBe(70);
  });
  it("pas de fausse barre quand le moteur n'a rien mesuré", () => {
    expect(describeJob("queued", 0).percent).toBeNull();
    expect(describeJob("queued", 0).headline).toBe("En file d'attente");
  });
  it("terminaux", () => {
    expect(describeJob("completed", 100).headline).toBe("Votre vidéo est prête");
    expect(describeJob("failed", 40).tone).toBe("error");
    expect(describeJob("cancelled", 0).isTerminal).toBe(true);
  });
  it("aucun terme technique dans les libellés", () => {
    const all = (["created", "uploading", "queued", "preparing", "analyzing", "editing", "rendering", "quality_check", "completed", "failed", "cancelled"] as const)
      .flatMap((s) => { const v = describeJob(s, 50); return [v.headline, ...v.steps.map((x) => x.label)]; }).join(" ").toLowerCase();
    for (const banned of ["ffmpeg", "deepgram", "llm", "worker", "queue", "encoding", "executor"]) expect(all).not.toContain(banned);
  });
});

describe("erreurs humaines (§43)", () => {
  it("solde faible : montant exact manquant", () => {
    const e = humanizeError("insufficient_funds", { shortfallCents: 124 });
    expect(nb(e.title)).toBe("Il manque 1,24 € pour créer cette vidéo.");
    expect(e.action).toBe("topup");
    expect(e.money).toContain("Aucun montant");
  });
  it("chaque erreur répond aux 3 questions", () => {
    for (const code of ["upload_interrupted", "payment_failed", "maintenance", "mode_unsupported", "unknown_code_xyz"]) {
      const e = humanizeError(code);
      expect(e.title.length).toBeGreaterThan(5);
      expect(e.detail.length).toBeGreaterThan(5);
      expect(e.action).toBeDefined();
    }
    expect(humanizeError("upload_interrupted").title).toBe("L'envoi s'est interrompu.");
    expect(humanizeError("upload_interrupted").detail).toBe("Votre vidéo est toujours sur votre appareil.");
    expect(humanizeError("payment_failed").money).toBe("Votre solde n'a pas été modifié.");
  });
  it("jamais de message technique brut", () => {
    const e = humanizeError("payment_intent requires_action 402");
    expect(`${e.title} ${e.detail}`).not.toMatch(/402|payment_intent|requires_action/);
  });
  it("extrait un code depuis une erreur Supabase/réseau", () => {
    expect(errorCodeOf({ message: "rate_limited" })).toBe("rate_limited");
    expect(errorCodeOf(new TypeError("Network request failed"))).toBe("network_error");
    expect(errorCodeOf({ status: 401, message: "x" })).toBe("not_authenticated");
    expect(errorCodeOf(null)).toBe("unknown");
  });
});

describe("historique (§29)", () => {
  it("formate comme dans la maquette produit", () => {
    const base = { id: "1", reference: null, created_at: "2026-10-06T10:00:00Z", amount_cents: 0 };
    const top = describeHistoryRow({ ...base, type: "topup", available_delta_cents: 2500, amount_cents: 2500 });
    expect([top.title, nb(top.amountLabel), top.tone]).toEqual(["Recharge", "+25,00 €", "positive"]);
    const hold = describeHistoryRow({ ...base, type: "hold", available_delta_cents: -484, amount_cents: 484, reference: "Montage vidéo" });
    expect([hold.title, nb(hold.amountLabel)]).toEqual(["Montage vidéo", "−4,84 €"]);
    const rel = describeHistoryRow({ ...base, type: "release", available_delta_cents: 484, amount_cents: 484 });
    expect([rel.title, rel.subtitle, nb(rel.amountLabel)]).toEqual(["Montant libéré", "Rendu annulé", "+4,84 €"]);
  });
});

describe("capacités moteur (§51)", () => {
  it("désactive tout en cas de donnée douteuse", () => {
    const c = normalizeCapabilities(undefined);
    expect(availableModes(c)).toEqual(["edit_rushes"]);
  });
  it("n'offre la création autonome que si le moteur la supporte", () => {
    expect(availableModes(normalizeCapabilities({ autonomous_creation: false }))).toEqual(["edit_rushes"]);
    expect(availableModes(normalizeCapabilities({ autonomous_creation: true }))).toEqual(["edit_rushes", "autonomous"]);
  });
  it("masque une méthode qui exige une fonction non supportée", () => {
    const m = (slug: string, req = false): EditingMethod => ({ id: slug, slug, name: slug, description: "", advanced: false, recommended: false, sort_order: 1, capabilities: { modes: ["edit_rushes"], requires_references: req }, configuration: {} });
    const off = normalizeCapabilities({ reference_mode: false });
    expect(usableMethods([m("auto"), m("ref", true)], "edit_rushes", off).map((x) => x.slug)).toEqual(["auto"]);
    const on = normalizeCapabilities({ reference_mode: true });
    expect(usableMethods([m("auto"), m("ref", true)], "edit_rushes", on)).toHaveLength(2);
  });
});

describe("matrice de paiement (§26-27)", () => {
  const s = DEFAULT_PUBLIC_SETTINGS;
  it("web : Stripe, montant libre, recharge auto", () => {
    expect(paymentCapabilities("web", s)).toMatchObject({ provider: "stripe", freeAmount: true, autoReload: true, lowBalanceNudge: false });
  });
  it("iOS : jamais de recharge auto simulée → notification + recharge en un geste", () => {
    expect(paymentCapabilities("ios", s)).toMatchObject({ provider: "apple", freeAmount: false, autoReload: false, lowBalanceNudge: true });
  });
  it("les stores proposent des packs fixes, le web des préréglages", () => {
    expect(topupChoices("ios", s)).toEqual([1000, 2000, 5000, 10000]);
    expect(topupChoices("web", s)).toEqual([1000, 2000, 2500, 5000, 10000, 25000]);
  });
  it("montant libre borné", () => {
    expect(validateTopupAmount(999, s)).toBe("too_low");
    expect(validateTopupAmount(1000, s)).toBe("ok");
    expect(validateTopupAmount(100001, s)).toBe("too_high");
  });
});

describe("deep links (§48)", () => {
  const id = "0b9b7a64-6e1c-4d7e-8d3f-1f6b5a9d2c11";
  it("invitation via schéma natif et via universal link", () => {
    const tok = "abcdefghijklmnopqrstuvwxyz012345";
    expect(parseDeepLink(`monapp://invite/${tok}`)).toEqual({ type: "invite", token: tok });
    expect(parseDeepLink(`https://example.com/invite/${tok}`)).toEqual({ type: "invite", token: tok });
  });
  it("projet, vidéo, paiement, wallet", () => {
    expect(parseDeepLink(`monapp://project/${id}`)).toEqual({ type: "project", projectId: id });
    expect(parseDeepLink(`https://example.com/video/${id}`)).toMatchObject({ type: "video", projectId: id });
    expect(parseDeepLink("https://example.com/payment/success?payment_id=p1")).toEqual({ type: "payment_result", status: "success", paymentId: "p1" });
    expect(parseDeepLink("monapp://account/wallet")).toEqual({ type: "wallet" });
  });
  it("callback d'auth : paramètres query ET fragment", () => {
    expect(parseDeepLink("monapp://auth/callback?code=abc")).toEqual({ type: "auth_callback", params: { code: "abc" } });
    expect(parseDeepLink("monapp://auth/callback#access_token=t&refresh_token=r")).toMatchObject({ type: "auth_callback", params: { access_token: "t" } });
  });
  it("rejette les liens malformés ou piégés", () => {
    expect(parseDeepLink("monapp://project/../../etc/passwd")).toEqual({ type: "unknown" });
    expect(parseDeepLink("monapp://invite/court")).toEqual({ type: "unknown" });
    expect(parseDeepLink("pas une url")).toEqual({ type: "unknown" });
    expect(routeForDeepLink({ type: "unknown" })).toBeNull();
  });
});

describe("format", () => {
  it("octets", () => {
    expect(formatBytes(428_000_000)).toBe("428 Mo");
    expect(formatBytes(1_200_000_000)).toBe("1,2 Go");
    expect(formatBytes(900)).toBe("900 o");
  });
  it("durées", () => { expect(formatDuration(83)).toBe("1:23"); expect(formatDuration(3725)).toBe("1:02:05"); });
});

import { planRevision } from "../src/revision";
describe("révisions (§23)", () => {
  const sup = ["shorter", "faster", "slower", "more_zooms", "less_zooms"];
  it("mappe le texte libre vers les commandes supportées", () => {
    expect(planRevision("Raccourcis l'intro", sup).commands).toEqual(["shorter"]);
    expect(planRevision("plus rapide et plus de zooms", sup).commands.sort()).toEqual(["faster", "more_zooms"]);
    expect(planRevision("moins de zooms svp", sup).commands).toEqual(["less_zooms"]);
  });
  it("« moins de zooms » n'active jamais « plus de zooms »", () => {
    expect(planRevision("moins de zooms", sup).commands).not.toContain("more_zooms");
  });
  it("signale ce qui n'est pas supporté, honnêtement", () => {
    const p = planRevision("Raccourcis l'intro et enlève le B-roll vers 00:18, change la musique en jazz", sup);
    expect(p.commands).toEqual(["shorter"]);
    expect(p.hasUnsupportedParts).toBe(true);
    expect(planRevision("change la musique", sup)).toEqual({ commands: [], hasUnsupportedParts: true });
  });
  it("respecte les capacités du moteur", () => {
    expect(planRevision("plus court", ["faster"]).commands).toEqual([]);
  });
  it("commandes contradictoires : une seule retenue", () => {
    expect(planRevision("plus rapide mais plus lent", sup).commands).toHaveLength(1);
  });
});
