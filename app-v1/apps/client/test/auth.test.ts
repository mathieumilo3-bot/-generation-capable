import { describe, expect, it } from "vitest";
import {
  authErrorKind, describeAuthError, hasCallbackPayload, isNewUser, isOtpComplete, isValidEmail, normalizeEmail,
  parseAuthCallbackUrl, resendLabel, resendSecondsLeft, sanitizeOtp, appleFirstName,
} from "../src/features/auth/logic";

describe("e-mail", () => {
  it("valide et normalise", () => {
    expect(isValidEmail(" Nom@Exemple.fr ")).toBe(true);
    expect(normalizeEmail(" Nom@Exemple.FR ")).toBe("nom@exemple.fr");
    expect(isValidEmail("nom@exemple")).toBe(false);
    expect(isValidEmail("nom exemple@x.fr")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("code à 6 chiffres", () => {
  it("ne garde que les chiffres, 6 maximum", () => {
    expect(sanitizeOtp("12a3 456789")).toBe("123456");
    expect(sanitizeOtp("")).toBe("");
  });
  it("détecte un code complet", () => {
    expect(isOtpComplete("123456")).toBe(true);
    expect(isOtpComplete("12345")).toBe(false);
    expect(isOtpComplete("12345a")).toBe(false);
  });
  it("compte à rebours de renvoi", () => {
    expect(resendSecondsLeft(31_000, 1_000)).toBe(30);
    expect(resendSecondsLeft(1_500, 1_000)).toBe(1);
    expect(resendSecondsLeft(1_000, 5_000)).toBe(0);
    expect(resendLabel(24)).toBe("Renvoyer le code dans 24 s");
    expect(resendLabel(0)).toBe("Renvoyer le code");
  });
});

describe("retour d'authentification", () => {
  it("lit le code PKCE dans la query", () => {
    expect(parseAuthCallbackUrl("montage://auth/callback?code=abc123").code).toBe("abc123");
    expect(parseAuthCallbackUrl("https://app.example.com/auth/callback?code=abc&x=1").code).toBe("abc");
  });
  it("lit les jetons dans le fragment", () => {
    const p = parseAuthCallbackUrl("montage://auth/callback#access_token=AT&refresh_token=RT&token_type=bearer");
    expect(p.accessToken).toBe("AT");
    expect(p.refreshToken).toBe("RT");
    expect(hasCallbackPayload(p)).toBe(true);
  });
  it("lit une erreur (query ou fragment) et la description décodée", () => {
    const p = parseAuthCallbackUrl("https://x/auth/callback?error=access_denied&error_description=User+denied%20access");
    expect(p.error).toBe("access_denied");
    expect(p.errorDescription).toBe("User denied access");
    expect(parseAuthCallbackUrl("https://x/auth/callback#error_code=otp_expired&error=access_denied").error).toBe("otp_expired");
  });
  it("combine query et fragment", () => {
    const p = parseAuthCallbackUrl("https://x/auth/callback?code=c1#foo=bar");
    expect(p.code).toBe("c1");
  });
  it("ignore un lien sans paramètre ou malformé", () => {
    expect(hasCallbackPayload(parseAuthCallbackUrl("montage://auth/callback"))).toBe(false);
    expect(hasCallbackPayload(parseAuthCallbackUrl("https://x/auth/callback?code=%E0%A4%A"))).toBe(false);
    expect(hasCallbackPayload({ accessToken: "a" })).toBe(false);
  });
});

describe("nouvel utilisateur", () => {
  it("created_at ≈ last_sign_in_at", () => {
    expect(isNewUser("2026-01-01T10:00:00.000Z", "2026-01-01T10:00:00.800Z")).toBe(true);
    expect(isNewUser("2026-01-01T10:00:00Z", "2026-01-05T09:00:00Z")).toBe(false);
    expect(isNewUser(undefined, "2026-01-05T09:00:00Z")).toBe(false);
    expect(isNewUser("n'importe quoi", "2026-01-05T09:00:00Z")).toBe(false);
  });
});

describe("erreurs de connexion", () => {
  it("classe les erreurs sans exposer le message brut", () => {
    expect(authErrorKind({ code: "otp_expired", message: "Token has expired or is invalid" })).toBe("otp_invalid");
    expect(authErrorKind(new Error("email rate limit exceeded"))).toBe("rate_limited");
    expect(authErrorKind({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(authErrorKind({ code: "email_address_invalid" })).toBe("invalid_email");
    expect(authErrorKind({ code: "ERR_REQUEST_CANCELED" })).toBe("cancelled");
    expect(authErrorKind(new TypeError("Failed to fetch"))).toBe("network");
    expect(authErrorKind(null)).toBe("other");
  });
  it("messages humains", () => {
    const d = describeAuthError({ code: "otp_expired", message: "JWT garbage xyz" });
    expect(d.title).toBe("Ce code n'est pas valide.");
    expect(JSON.stringify(d)).not.toMatch(/JWT|garbage/);
    expect(describeAuthError(new Error("boom: stack trace at foo.ts:12")).detail).not.toMatch(/boom|stack/);
  });
});

describe("Apple", () => {
  it("prénom fourni seulement à la première connexion", () => {
    expect(appleFirstName({ givenName: " Léa " })).toBe("Léa");
    expect(appleFirstName({ givenName: null })).toBeNull();
    expect(appleFirstName(null)).toBeNull();
  });
});
