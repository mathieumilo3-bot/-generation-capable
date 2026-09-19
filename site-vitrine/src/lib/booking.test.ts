import { describe, expect, it } from "vitest";
import { CALENDLY_URL, buildCalendlyUrl } from "./booking";

describe("buildCalendlyUrl", () => {
  it("points to the configured strategic consultation", () => {
    expect(buildCalendlyUrl()).toContain(CALENDLY_URL);
  });

  it("prefills known lead details and keeps attribution", () => {
    const url = new URL(buildCalendlyUrl({ nom: "Marie Dupont", email: "MARIE@EXEMPLE.FR" }));

    expect(url.searchParams.get("name")).toBe("Marie Dupont");
    expect(url.searchParams.get("email")).toBe("marie@exemple.fr");
    expect(url.searchParams.get("utm_source")).toBe("capable_audit");
    expect(url.searchParams.get("utm_medium")).toBe("website");
    expect(url.searchParams.get("utm_campaign")).toBe("audit_conversion");
  });

  it("does not fabricate missing identity fields", () => {
    const url = new URL(buildCalendlyUrl({}));
    expect(url.searchParams.has("name")).toBe(false);
    expect(url.searchParams.has("email")).toBe(false);
  });
});
