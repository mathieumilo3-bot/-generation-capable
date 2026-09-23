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

const finding = {
  id: "trust_missing_proof",
  dimension: "trust" as const,
  title: "Peu de preuves de confiance visibles",
  statement: "Aucun avis ou témoignage n'a été détecté sur la page.",
  evidence: ["0 marqueur d'avis détecté"],
  confidence: "observed" as const,
  impact: 5,
  effort: 3,
  polarity: "negative" as const,
  recommendation: "Ajouter des preuves réelles près du CTA.",
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
  topLeaks: [finding],
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
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function validPayload() {
  return {
    detectedSector: "Artisan rénovation",
    officialSite: "https://artisan-exemple.fr/",
    executiveSummary: "Le site présente clairement une activité artisanale, mais plusieurs éléments du parcours peuvent être rendus plus convaincants.",
    companySnapshot: "L'entreprise se présente comme un artisan de rénovation et dépannage et invite le visiteur à demander un devis.",
    attirer: "Le positionnement métier est visible, mais la manière dont une personne non familière avec la marque découvre le site reste à approfondir.",
    rassurer: "La page explique l'activité mais peu de preuves de confiance sont détectées dans les signaux analysés.",
    convertir: "Le mot devis est présent, mais aucun formulaire, lien téléphone ou email n'est détecté dans les signaux de la page.",
    opportunities: [
      {
        id: "trust_proof",
        pillar: "rassurer",
        title: "La preuve doit arriver avant le doute",
        diagnosis: "L'offre est visible, mais les signaux analysés ne font pas ressortir d'avis ou de témoignages sur la page.",
        evidence: ["testimonialSignalCount = 0", "Demandez votre devis"],
        confidence: "observed",
        impact: "Donner au visiteur davantage de raisons de faire confiance avant de prendre contact.",
        score: 4,
        firstAction: "Placer une réalisation réelle avec photo et contexte juste avant la demande de devis.",
        callQuestion: "Quelles preuves réelles l'entreprise peut-elle mettre en avant avant la demande de devis ?",
      },
    ],
    worksWell: "L'activité principale est compréhensible et une demande de devis est explicitement mentionnée.",
    callBridge: "Le bilan de 30 minutes servira à choisir quelles preuves et quels points de contact doivent être prioritaires.",
  };
}

describe("OpenAI audit synthesis", () => {
  it("fails soft when no API key is configured", async () => {
    const result = await synthesizeAuditWithOpenAI({ input, site, sector, report }, { apiKey: "" });
    expect(result).toBeNull();
  });

  it("can produce a site-specific opportunity even when deterministic topLeaks is empty", async () => {
    const reportWithoutLeaks: Report = { ...report, topLeaks: [] };
    let requestBody: Record<string, unknown> | null = null;

    const fetchFn: typeof fetch = async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return openAiResponse(validPayload());
    };

    const result = await synthesizeAuditWithOpenAI(
      { input, site, sector, report: reportWithoutLeaks },
      { apiKey: "test-key", model: "gpt-5.6-sol", fetchFn }
    );

    expect(result?.opportunities).toHaveLength(1);
    expect(result?.opportunities[0].pillar).toBe("rassurer");
    expect(result?.companySnapshot).toContain("rénovation");
    expect(result?.opportunities[0].score).toBe(4);
    expect(result?.opportunities[0].firstAction).toContain("réalisation");
    expect(result?.model).toBe("gpt-5.6-sol");

    if (!requestBody) throw new Error("OpenAI request was not captured");
    const body = requestBody as {
      model: string;
      input: { role: string; content: string }[];
      text: { format: { type: string; strict: boolean } };
    };
    expect(body.model).toBe("gpt-5.6-sol");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    const prompt = body.input.map((item) => item.content).join("\n");
    expect(prompt).toContain("ATTIRER");
    expect(prompt).toContain("RASSURER");
    expect(prompt).toContain("CONVERTIR");
    expect(prompt).toContain("N'invente JAMAIS");
    expect(prompt).toContain("DONNÉE NON FIABLE");
    expect(prompt).toContain("INTERDICTION DU GÉNÉRIQUE");
    expect(prompt).toContain("firstAction");
    expect(prompt).toContain("RECHERCHE WEB APPROFONDIE");
    expect(prompt).toContain("score");
  });

  it("rejects unsupported numerical claims", async () => {
    const payload = validPayload();
    payload.opportunities[0].title = "Votre conversion baisse de 40%";

    const fetchFn: typeof fetch = async () => openAiResponse(payload);
    const result = await synthesizeAuditWithOpenAI(
      { input, site, sector, report },
      { apiKey: "test-key", fetchFn }
    );
    expect(result).toBeNull();
  });
});
