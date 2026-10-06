import { describe, expect, it } from "vitest";
import {
  canSendSupport, classifyDeleteFailure, describeInvitation, displayName, initials, isDeleteConfirmed, isValidEmail, isValidInviteToken, isValidOtp,
  normalizeBilling, sameBilling, supportContext, toBillingForm, validateBilling,
} from "../src/features/account/logic";
import { buildFaq } from "../src/features/account/faq";

describe("suppression de compte", () => {
  it("exige la phrase exacte SUPPRIMER", () => {
    expect(isDeleteConfirmed("SUPPRIMER")).toBe(true);
    expect(isDeleteConfirmed("  SUPPRIMER ")).toBe(true);
    expect(isDeleteConfirmed("supprimer")).toBe(false);
    expect(isDeleteConfirmed("SUPPRIM")).toBe(false);
    expect(isDeleteConfirmed("")).toBe(false);
  });
  it("classe les refus du serveur", () => {
    expect(classifyDeleteFailure("reauth_required")).toBe("reauth");
    expect(classifyDeleteFailure("transfer_ownership_first")).toBe("blocked");
    expect(classifyDeleteFailure("unknown")).toBe("error");
    expect(classifyDeleteFailure(undefined)).toBe("error");
  });
  it("code de réauthentification à 6 chiffres", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("12a456")).toBe(false);
  });
});

describe("facturation", () => {
  it("retire les champs vides et normalise la TVA", () => {
    const f = { ...toBillingForm(null), name: " Marie ", vat_number: "fr12 345678901", city: "" };
    expect(normalizeBilling(f)).toEqual({ name: "Marie", vat_number: "FR12 345678901" });
  });
  it("valide l'e-mail, le code postal et la TVA sans calcul fiscal", () => {
    expect(validateBilling({ ...toBillingForm(null), email: "pas-un-mail" }).email).toBeDefined();
    expect(validateBilling({ ...toBillingForm(null), email: "a@b.fr" })).toEqual({});
    expect(validateBilling({ ...toBillingForm(null), postal_code: "1".repeat(13) }).postal_code).toBeDefined();
  });
  it("détecte l'absence de modification", () => {
    expect(sameBilling({ name: "A" }, normalizeBilling({ ...toBillingForm({ name: "A" }) }))).toBe(true);
    expect(sameBilling({ name: "A" }, { name: "B" })).toBe(false);
    expect(sameBilling({}, normalizeBilling(toBillingForm(null)))).toBe(true);
  });
  it("validation d'e-mail", () => {
    expect(isValidEmail("a@b.fr")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("aide", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("joint le contexte depuis les paramètres de route (snake ou camel), uniquement des UUID", () => {
    expect(supportContext({ project_id: id, jobId: id, version_id: "n'importe quoi" })).toEqual({ projectId: id, jobId: id, versionId: undefined });
    expect(supportContext({})).toEqual({ projectId: undefined, jobId: undefined, versionId: undefined });
    expect(supportContext({ projectId: [id] }).projectId).toBe(id);
  });
  it("message minimal avant envoi", () => {
    expect(canSendSupport("court")).toBe(false);
    expect(canSendSupport("Ma vidéo ne se lit pas")).toBe(true);
  });
  it("FAQ : prix issus des règles chargées, jamais inventés", () => {
    const withPrices = buildFaq({ minPriceCents: 242, maxPriceCents: 950, supportEmail: "s@x.fr", retention: { raw: 12, renders: 12 }, revisionsEnabled: true });
    const price = withPrices.find((f) => f.id === "price")!;
    const ans = price.answer.replace(/\u00a0/g, " ");
    expect(ans).toContain("2,42 €");
    expect(ans).toContain("9,50 €");
    const without = buildFaq({ minPriceCents: null, maxPriceCents: null, supportEmail: "s@x.fr", retention: { raw: 12, renders: 12 }, revisionsEnabled: true });
    expect(without.find((f) => f.id === "price")!.answer).not.toMatch(/€/);
    expect(without.map((f) => f.id)).toEqual(expect.arrayContaining(["duration", "price", "failure", "revisions", "data"]));
    expect(without.some((f) => /bout en bout/i.test(f.answer))).toBe(false);
  });
  it("FAQ : modifications cachées si le réglage est faux ; conservation toujours expliquée avec les heures du réglage", () => {
    const off = buildFaq({ minPriceCents: null, maxPriceCents: null, supportEmail: "s@x.fr", retention: { raw: 12, renders: 36 }, revisionsEnabled: false });
    expect(off.some((f) => f.id === "revisions")).toBe(false);
    expect(off.some((f) => /modifier ma vidéo|Modifier »|nouvelle version/i.test(f.question + f.answer))).toBe(false);
    const ret = off.find((f) => f.id === "retention")!;
    expect(ret.question).toBe("Combien de temps mes fichiers sont-ils conservés ?");
    expect(ret.answer).toContain("12 h");
    expect(ret.answer).toContain("36 h");
    expect(ret.answer).toMatch(/justificatifs de paiement/);
    const dflt = buildFaq({ minPriceCents: null, maxPriceCents: null, supportEmail: "s@x.fr", retention: { raw: 12, renders: 12 } });
    expect(dflt.some((f) => f.id === "revisions")).toBe(false);
  });
});

describe("invitation", () => {
  it("jeton valide (même forme que les liens profonds)", () => {
    expect(isValidInviteToken("a".repeat(24))).toBe(true);
    expect(isValidInviteToken("court")).toBe(false);
    expect(isValidInviteToken("../etc/passwd")).toBe(false);
    expect(isValidInviteToken(undefined)).toBe(false);
  });
  it("décrit l'aperçu", () => {
    expect(describeInvitation({ valid: false })).toEqual({ kind: "invalid" });
    expect(describeInvitation({ valid: true, kind: "credit", credit_cents: 2000, name: "Marie" })).toEqual({ kind: "credit", creditCents: 2000, firstName: "Marie" });
    expect(describeInvitation({ valid: true, kind: "organization", company: "ACME" })).toEqual({ kind: "team", company: "ACME", firstName: null });
    expect(describeInvitation({ valid: true, kind: "credit", credit_cents: 0 })).toEqual({ kind: "plain", firstName: null });
  });
});

describe("profil", () => {
  it("initiales et nom affiché", () => {
    expect(initials({ first_name: "Marie", last_name: "Dupont" })).toBe("MD");
    expect(initials({ email: "zoe@x.fr" })).toBe("Z");
    expect(displayName({ first_name: "Marie", last_name: "Dupont" })).toBe("Marie Dupont");
    expect(displayName({ email: "zoe@x.fr" })).toBe("zoe@x.fr");
    expect(displayName({})).toBe("Mon compte");
  });
});
