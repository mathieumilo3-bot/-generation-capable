import { describe, expect, it } from "vitest";
import {
  buildConfirmationEmail,
  buildNotificationEmail,
  FIELD_LIMITS,
  HONEYPOT_FIELD,
  parseAuditSubmission,
} from "./audit-submission";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    siteUrl: "https://exemple.fr",
    secteur: "Restaurants",
    objectif: "Plus de demandes",
    nom: "Marie Dupont",
    entreprise: "Le Bistrot",
    email: "marie@exemple.fr",
    telephone: "0600000000",
    ...overrides,
  };
}

describe("parseAuditSubmission", () => {
  it("accepts a complete submission", () => {
    const result = parseAuditSubmission(validPayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe("marie@exemple.fr");
      expect(result.value.entreprise).toBe("Le Bistrot");
    }
  });

  it("accepts a submission without the optional fields", () => {
    const result = parseAuditSubmission(
      validPayload({ nom: "", entreprise: "", telephone: "" })
    );
    expect(result.ok).toBe(true);
  });

  it.each([null, undefined, "a string", 42, []])("rejects %s as a payload", (payload) => {
    const result = parseAuditSubmission(payload);
    expect(result).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("reports every missing required field", () => {
    const result = parseAuditSubmission(
      validPayload({ siteUrl: "", secteur: "", objectif: "", email: "" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "missing_fields") {
      expect(result.missing.sort()).toEqual(["email", "objectif", "secteur", "siteUrl"].sort());
    }
  });

  it("treats whitespace-only values as missing", () => {
    const result = parseAuditSubmission(validPayload({ siteUrl: "    " }));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "missing_fields") {
      expect(result.missing).toContain("siteUrl");
    }
  });

  it("does not let a non-string value pass validation via toString()", () => {
    // An object used to become "[object Object]" and sail through.
    const result = parseAuditSubmission(validPayload({ siteUrl: { toString: () => "x" } }));
    expect(result.ok).toBe(false);
  });

  it.each(["not-an-email", "a@b", "a@b.", "@exemple.fr", "marie@", "marie exemple.fr"])(
    "rejects the invalid address %s",
    (email) => {
      const result = parseAuditSubmission(validPayload({ email }));
      expect(result).toEqual({ ok: false, error: "invalid_email" });
    }
  );

  it("normalises the email to lowercase", () => {
    const result = parseAuditSubmission(validPayload({ email: "Marie@Exemple.FR" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("marie@exemple.fr");
  });

  it("trims surrounding whitespace", () => {
    const result = parseAuditSubmission(validPayload({ nom: "  Marie  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.nom).toBe("Marie");
  });

  it("rejects a field longer than its limit", () => {
    const result = parseAuditSubmission(
      validPayload({ nom: "x".repeat(FIELD_LIMITS.nom + 1) })
    );
    expect(result).toEqual({ ok: false, error: "field_too_long", field: "nom" });
  });

  it("accepts a field exactly at its limit", () => {
    const result = parseAuditSubmission(
      validPayload({ nom: "x".repeat(FIELD_LIMITS.nom) })
    );
    expect(result.ok).toBe(true);
  });

  it("flags a filled honeypot as a bot", () => {
    const result = parseAuditSubmission(
      validPayload({ [HONEYPOT_FIELD]: "http://spam.example" })
    );
    expect(result).toEqual({ ok: false, error: "rejected_as_bot" });
  });

  it("ignores an empty honeypot", () => {
    const result = parseAuditSubmission(validPayload({ [HONEYPOT_FIELD]: "" }));
    expect(result.ok).toBe(true);
  });
});

describe("buildNotificationEmail", () => {
  const submission = {
    siteUrl: "https://exemple.fr",
    secteur: "Restaurants",
    objectif: "Plus de demandes",
    nom: "Marie",
    entreprise: "Le Bistrot",
    email: "marie@exemple.fr",
    telephone: "0600000000",
  };

  it("includes every submitted value in the text body", () => {
    const { text } = buildNotificationEmail(submission);
    for (const value of Object.values(submission)) {
      expect(text).toContain(value);
    }
  });

  it("escapes HTML so a submission cannot inject markup", () => {
    const { html } = buildNotificationEmail({
      ...submission,
      nom: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("strips newlines from the subject to prevent header injection", () => {
    const { subject } = buildNotificationEmail({
      ...submission,
      entreprise: "Acme\r\nBcc: victime@exemple.fr",
    });
    expect(subject).not.toContain("\n");
    expect(subject).not.toContain("\r");
  });

  it("falls back to the name then the email when there is no company", () => {
    expect(buildNotificationEmail({ ...submission, entreprise: "" }).subject).toContain("Marie");
    expect(
      buildNotificationEmail({ ...submission, entreprise: "", nom: "" }).subject
    ).toContain("marie@exemple.fr");
  });

  it("shows a dash for empty optional fields", () => {
    const { text } = buildNotificationEmail({ ...submission, telephone: "" });
    expect(text).toContain("Téléphone : —");
  });
});

describe("buildConfirmationEmail", () => {
  const submission = {
    siteUrl: "https://exemple.fr",
    secteur: "Restaurants",
    objectif: "Plus de demandes",
    nom: "Marie",
    entreprise: "Le Bistrot",
    email: "marie@exemple.fr",
    telephone: "",
  };

  it("greets the visitor by name when known", () => {
    expect(buildConfirmationEmail(submission).text).toContain("Bonjour Marie,");
  });

  it("falls back to a neutral greeting without a name", () => {
    expect(buildConfirmationEmail({ ...submission, nom: "" }).text).toContain("Bonjour,");
  });

  it("escapes HTML in the greeting and the site", () => {
    const { html } = buildConfirmationEmail({
      ...submission,
      nom: "<b>Marie</b>",
      siteUrl: "<img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<b>Marie</b>");
    expect(html).not.toContain("<img");
  });
});
