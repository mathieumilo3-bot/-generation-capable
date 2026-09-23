import { describe, expect, it } from "vitest";
import { verifyOfficialSite, type CompanyDiscoveryCandidate } from "./company-discovery";
import type { FetchHtmlResult } from "./probe";

describe("verifyOfficialSite", () => {
  it("recognizes a spaced legal acronym on the official site's legal notice", async () => {
    const candidate: CompanyDiscoveryCandidate = {
      name: "AATP",
      website: "https://www.plomberie-climatisation-ajaccio.fr/",
      sector: "Plombier / chauffagiste",
      city: "Bastelicaccia",
      summary: "Entreprise de plomberie en Corse-du-Sud.",
      confidence: "medium",
    };

    const fetchPage = async (url: string): Promise<FetchHtmlResult> => {
      if (url.includes("mentions-legales")) {
        return {
          ok: true,
          finalUrl: new URL("https://www.plomberie-climatisation-ajaccio.fr/mentions-legales.php"),
          status: 200,
          responseTimeMs: 20,
          html: `<html><body>
            <h1>Mentions légales</h1>
            <p>A A T P SARL</p>
            <p>Bastelicaccia</p>
            <p>SIRET 451 619 258 00010</p>
          </body></html>`,
        };
      }

      return {
        ok: true,
        finalUrl: new URL("https://www.plomberie-climatisation-ajaccio.fr/"),
        status: 200,
        responseTimeMs: 20,
        html: `<html><body>
          <h1>Trojani.P — Plomberie et climatisation</h1>
          <a href="/mentions-legales.php">Mentions légales</a>
        </body></html>`,
      };
    };

    const result = await verifyOfficialSite(candidate, { cityHint: "Bastelicaccia", fetchPage });

    expect(result.website).toBe("https://www.plomberie-climatisation-ajaccio.fr/");
    expect(result.confidence).toBe("high");
    expect(result.verification?.verified).toBe(true);
    expect(result.verification?.evidence.join(" ")).toContain("aatp");
    expect(result.verification?.evidence.join(" ")).toContain("Bastelicaccia");
  });
});
