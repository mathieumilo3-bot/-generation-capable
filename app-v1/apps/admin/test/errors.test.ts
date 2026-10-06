import { describe, expect, it } from "vitest";
import { AdminError, codeFromError, errorMessage, humanizeAdminCode, isUnknownUserOtpError, otpErrorMessage } from "../src/lib/errors";

describe("codes d'erreur", () => {
  it("extrait le code du message PostgREST", () => {
    expect(codeFromError({ message: "reason_required" })).toBe("reason_required");
    expect(codeFromError({ message: "adjustment_below_held", code: "P0001" })).toBe("adjustment_below_held");
    expect(codeFromError({ message: "permission denied", code: "42501" })).toBe("forbidden");
    expect(codeFromError({ message: "JWT expired", status: 401 })).toBe("not_authenticated");
    expect(codeFromError(new TypeError("Failed to fetch"))).toBe("network_error");
    expect(codeFromError(null)).toBe("unknown");
    expect(codeFromError(new AdminError("rate_limited"))).toBe("rate_limited");
  });
  it("messages français sans détail technique", () => {
    expect(humanizeAdminCode("forbidden")).toContain("rôle");
    expect(humanizeAdminCode("insufficient_funds", { shortfallCents: 250 })).toContain("2,50");
    expect(errorMessage({ message: "relation \"x\" does not exist" })).not.toContain("relation");
  });
});

describe("OTP", () => {
  it("détecte l'adresse inconnue sans la révéler", () => {
    expect(isUnknownUserOtpError({ message: "Signups not allowed for otp" })).toBe(true);
    expect(isUnknownUserOtpError({ code: "otp_disabled", message: "x" })).toBe(true);
    expect(isUnknownUserOtpError({ message: "boom" })).toBe(false);
  });
  it("messages de limitation, expiration, code erroné", () => {
    expect(otpErrorMessage({ status: 429, message: "x" })).toContain("Patientez");
    expect(otpErrorMessage({ message: "Token has expired or is invalid" })).toContain("expiré");
    expect(otpErrorMessage({ message: "invalid token" })).toContain("incorrect");
  });
});
