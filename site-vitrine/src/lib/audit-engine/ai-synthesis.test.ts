import { describe, expect, it } from "vitest";
import { synthesizeAuditWithOpenAI } from "./ai-synthesis";
import type { DeclaredInput, Report, SectorProfile, SiteSignals } from "./types";
import { observed, unknown } from "./types";

const input: DeclaredInput = {
  siteUrl: "https://artisan-exemple.fr",
  secteur: "Artisans",
  objectif: "Plus de demandes",
};

const site: SiteSignals = {
  reachable: true,
  finalUrl: "https://artisan-exemple.fr/",
  httpStatus: 200,
  responseTimeMs: 210,
  isHttps: true,
  title: observed("Artisan Exemple", "title"),
  metaDescription: observed("Rénovation et dépannage", "meta"),
  h1: observed(["Artisan Exemple"], "h1"),
  wordCount: observed(420, "texte"),
  hasViewportMeta: observed(true, "viewport"),
  hasHtmlLangAttr: observed(true, "lang"),
  hasStructuredData: observed(false, "jsonld"),
  telLinkCount: observed(0, "tel"),
  mailtoLinkCount: observed(0, "mailto"),
  formCount: observed(0, "form"),
  socialLinks: unknown("aucun réseau"),
  actionWords: observed(["devis"], "texte"),
  priceMentionCount: observed(0, "prix"),
  testimonialSignalCount: observed(0, "avis"),
  faqSignalPresent: observed(false, "faq"),
  guaranteeSignalPresent: observed(false, "garantie"),
  urgencySignalPresent: observed(false, "urgence"),
  legalNoticeLinkPresent: observed(true, "legal"),
  textExcerpt: observed(
    "Artisan Exemple. Rénovation, dépannage, peinture. Demandez votre devis.",
    "texte public"
  ),
};

const sector: SectorProfile = {
  id: "artisan",
  label: "Artisan",
  matches: ["artisan"],
  priorityDimensions: ["trust", "conversion"],
  trustSignals: ["avis", "réalisations"],
  channels: ["Google"],
  commonObjections: ["fiabilité"],
  conversionLevers: ["devis"],
  typicalOpportunities: ["preuves"],
  limits: "La qualité réelle des prestations n'est pas mesurable depuis le site.",
};

const report: Report = {
  header: {
    entreprise: input.siteUrl,
    secteur: input.secteur,
    sectorProfile: "artisan",
    objectif: input.objectif,
    siteUrl: input.siteUrl,
    generatedAt: new Date().toISOString(),
    siteReachable: true,
  },
  topLeaks: [
    {
      id: "trust_missing_proof",
      dimension: "trust",
      title: "Peu de preuves de confiance visibles",
      statement: "Aucun avis ou témoignage n'a été détecté sur la page.",
      evidence: ["0 marqueur d'avis détecté"],
      confidence: "observed",
      impact: 5,
      effort: 3,
      polarity: "negative",
      recommendation: "Ajouter des preuves réelles près du CTA.",
    },
  ],
  worksWell: [],
  otherFindings: [],
  actionPlan: [],
  degraded: false,
  sectorNote: sector.limits,
  engineVersion: "1.0.0",
};

function openAiResponse(payload: object) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(payload) }],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("OpenAI audit synthesis", () => {
  it("fails soft when no API key is configured", async () => {
    const result = await synthesizeAuditWithOpenAI(
      { input, site, sector, report },
      { apiKey: "" }
    );
    expect(result).toBeNull();
  });

  it("returns only opportunities tied to deterministic findings", async () => {
    let requestBody: Record<string, unknown> | null = null;

    const fetchFn: typeof fetch = async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return openAiResponse({
        executiveSummary: "Votre site explique l'activité, mais la confiance reste peu matérialisée.",
        attirer: "La visibilité hors marque reste à approfondir.",
        rassurer: "Les preuves visibles sont insuffisantes.",
        convertir: "Le devis est mentionné, mais le parcours mérite d'être clarifié.",
        opportunities: [
          {
            findingId: "trust_missing_proof",
            title: "La confiance arrive trop tard",
            diagnosis: "Le visiteur voit l'offre avant de voir des preuves qui réduisent son doute.",
            impact: "Rendre la décision de contact plus rassurante.",
            callQuestion: "Quelles preuves réelles peut-on placer avant la demande de devis ?",
          },
        ],
        callBridge: "Le bilan permettra de prioriser les preuves et leur emplacement dans le parcours.",
      });
    };

    const result = await synthesizeAuditWithOpenAI(
      { input, site, sector, report },
      { apiKey: "test-key", model: "gpt-5.6-sol", fetchFn }
    );

    expect(result?.opportunities).toHaveLength(1);
    expect(result?.opportunities[0].findingId).toBe("trust_missing_proof");
    expect(result?.model).toBe("gpt-5.6-sol");

    const body = requestBody as {
      model: string;
      input: string;
      text: { format: { type: string; strict: boolean } };
    };
    expect(body.model).toBe("gpt-5.6-sol");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(body.input).toContain("ATTIRER");
    expect(body.input).toContain("RASSURER");
    expect(body.input).toContain("CONVERTIR");
    expect(body.input).toContain("N'invente jamais");
    expect(body.input).toContain("DONNÉES NON FIABLES");
  });

  it("rejects hallucinated finding ids instead of surfacing them", async () => {
    const fetchFn: typeof fetch = async () =>
      openAiResponse({
        executiveSummary: "Résumé",
        attirer: "À approfondir",
        rassurer: "À renforcer",
        convertir: "À renforcer",
        opportunities: [
          {
            findingId: "invented_metric",
            title: "Votre conversion baisse de 40%",
            diagnosis: "Affirmation inventée",
            impact: "Impact inventé",
            callQuestion: "Question",
          },
        ],
        callBridge: "Bilan",
      });

    const result = await synthesizeAuditWithOpenAI(
      { input, site, sector, report },
      { apiKey: "test-key", fetchFn }
    );
    expect(result).toBeNull();
  });
});
