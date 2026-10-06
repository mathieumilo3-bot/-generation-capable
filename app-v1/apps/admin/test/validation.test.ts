import { describe, expect, it } from "vitest";
import {
  buildInviteLink, EMPTY_INVITATION_FORM, isEmail, isUuid, isValidOtp, normalizeOtp, parseAmount,
  validateAdjustment, validateInvitationForm, validateNote, validatePriceChange, validateReason,
  describeAdjustment, MAX_AMOUNT_CENTS,
} from "../src/lib/validation";

const sp = (v: string | null): string | null => (v === null ? null : v.replace(/[\u00a0\u202f]/g, " "));

describe("motif", () => {
  it("exige au moins 5 caractères (espaces ignorés)", () => {
    expect(validateReason("   ab  ")).not.toBeNull();
    expect(validateReason("abcd")).not.toBeNull();
    expect(validateReason("abcde")).toBeNull();
    expect(validateReason("a".repeat(501))).not.toBeNull();
  });
  it("note : 1 à 4000 caractères", () => {
    expect(validateNote("  ")).not.toBeNull();
    expect(validateNote("ok")).toBeNull();
    expect(validateNote("x".repeat(4001))).not.toBeNull();
  });
});

describe("montants (centimes entiers)", () => {
  it("convertit la saisie en centimes", () => {
    expect(parseAmount("25")).toEqual({ ok: true, cents: 2500 });
    expect(parseAmount("12,5")).toEqual({ ok: true, cents: 1250 });
    expect(parseAmount("1 250,00 €")).toEqual({ ok: true, cents: 125000 });
  });
  it("refuse vide, 0, négatif, 3 décimales, texte et dépassement", () => {
    expect(parseAmount("").ok).toBe(false);
    expect(parseAmount("0").ok).toBe(false);
    expect(parseAmount("-5").ok).toBe(false);
    expect(parseAmount("1,234").ok).toBe(false);
    expect(parseAmount("abc").ok).toBe(false);
    expect(parseAmount(String(MAX_AMOUNT_CENTS / 100 + 1)).ok).toBe(false);
  });
  it("autorise vide / zéro si demandé", () => {
    expect(parseAmount("", { allowEmpty: true, allowZero: true })).toEqual({ ok: true, cents: 0 });
    expect(parseAmount("0", { allowZero: true })).toEqual({ ok: true, cents: 0 });
  });
});

describe("ajustement de portefeuille", () => {
  const base = { kind: "bonus" as const, direction: "credit" as const, amountInput: "10", reason: "geste commercial", balanceCents: 5000, heldCents: 1000 };
  it("crédit : montant positif et nouveau solde", () => {
    const r = validateAdjustment(base);
    expect(r).toMatchObject({ ok: true, amountCents: 1000, balanceAfterCents: 6000, kind: "bonus" });
  });
  it("correction négative signée ; limitée au disponible", () => {
    const ok = validateAdjustment({ ...base, kind: "manual_adjustment", direction: "debit", amountInput: "40" });
    expect(ok).toMatchObject({ ok: true, amountCents: -4000, balanceAfterCents: 1000 });
    const ko = validateAdjustment({ ...base, kind: "manual_adjustment", direction: "debit", amountInput: "41" });
    expect(ko.ok).toBe(false);
  });
  it("la direction « débit » est ignorée hors correction manuelle", () => {
    expect(validateAdjustment({ ...base, direction: "debit" })).toMatchObject({ ok: true, amountCents: 1000 });
  });
  it("motif obligatoire", () => {
    const r = validateAdjustment({ ...base, reason: "ok" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.reason).toBeDefined();
  });
  it("libellés de confirmation avec montant en euros", () => {
    expect(sp(describeAdjustment("bonus", 2500))).toBe("Ajouter 25,00 € de bonus");
    expect(sp(describeAdjustment("manual_adjustment", -1050))).toBe("Retirer 10,50 € (correction de solde)");
  });
});

describe("formulaire de vente directe", () => {
  const valid = { ...EMPTY_INVITATION_FORM, clientName: " Jeanne Martin ", email: "Jeanne@Example.COM", paid: "100", gifted: "20,50", expiresDays: "14" };
  it("normalise et calcule le crédit total", () => {
    const r = validateInvitationForm(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.clientName).toBe("Jeanne Martin");
      expect(r.payload.email).toBe("jeanne@example.com");
      expect(r.payload.paidCents).toBe(10000);
      expect(r.payload.giftedCents).toBe(2050);
      expect(r.totalCreditCents).toBe(12050);
      expect(r.payload.company).toBeNull();
    }
  });
  it("champs vides de montant = 0", () => {
    const r = validateInvitationForm({ ...valid, paid: "", gifted: "" });
    expect(r.ok && r.totalCreditCents).toBe(0);
  });
  it("erreurs : nom, e-mail, montants, expiration, deal, source", () => {
    const r = validateInvitationForm({ ...EMPTY_INVITATION_FORM, paid: "-1", gifted: "x", expiresDays: "0", dealRef: "***", campaign: "été" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["clientName", "dealRef", "email", "expiresDays", "gifted", "paid", "source"]);
    }
  });
});

describe("lien d'invitation", () => {
  it("construit ${URL}/invite/${token}", () => {
    expect(buildInviteLink("https://app.example.com", "abc_DEF-123")).toBe("https://app.example.com/invite/abc_DEF-123");
    expect(buildInviteLink("https://app.example.com/", "tok")).toBe("https://app.example.com/invite/tok");
    expect(buildInviteLink("https://example.com/app/", "tok")).toBe("https://example.com/app/invite/tok");
  });
  it("null si URL absente ou invalide", () => {
    expect(buildInviteLink(undefined, "t")).toBeNull();
    expect(buildInviteLink("pas une url", "t")).toBeNull();
    expect(buildInviteLink("javascript:alert(1)", "t")).toBeNull();
  });
});

describe("changement de prix", () => {
  it("refuse prix identique, négatif, absurde", () => {
    expect(validatePriceChange(484, "4,84").ok).toBe(false);
    expect(validatePriceChange(484, "-1").ok).toBe(false);
    expect(validatePriceChange(484, "5000").ok).toBe(false);
  });
  it("accepte et avertit sur forte variation ou gratuité", () => {
    expect(validatePriceChange(484, "5")).toEqual({ ok: true, cents: 500, warning: null });
    const big = validatePriceChange(484, "20");
    expect(big.ok && big.warning).toContain("100 %");
    const zero = validatePriceChange(484, "0");
    expect(zero.ok && zero.warning).toContain("gratuites");
  });
});

describe("identifiants et code", () => {
  it("uuid, e-mail, OTP", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("123")).toBe(false);
    expect(isEmail("a@b.fr")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(normalizeOtp("12 34-56789")).toBe("123456");
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
  });
});
