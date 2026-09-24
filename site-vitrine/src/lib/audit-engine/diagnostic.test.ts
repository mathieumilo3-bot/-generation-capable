import { describe, expect, it } from "vitest";
import { classifyUrl, crawlSite, parseHomeLayout } from "./crawl";
import { buildEvidenceCards, extractFacts, pickTopCards, potentialForScore } from "./facts";
import {
  buildDossier,
  collectInvestigation,
  diagnoseDossier,
  dossierAnchors,
  dossierHaystack,
  mergeCards,
  researchQueries,
  signDossier,
  signJob,
  siteOnlyDiagnostic,
  startInvestigation,
  toAuditContext,
  validateCard,
  verifyDossier,
  verifyJob,
  type Dossier,
} from "./diagnostic";
import { verifyOfficialSite } from "./company-discovery";
import { ARTISAN_PAGES, fakeFetch } from "./fixtures/artisan-site";

const ROOT = "https://www.martin-couverture56.fr/";

async function crawlFixture() {
  return crawlSite(ROOT, { fetchPage: fakeFetch(ARTISAN_PAGES), cityHint: "Vannes" });
}

async function dossierFixture(): Promise<Dossier> {
  return buildDossier(
    { entreprise: "Martin Couverture", siteUrl: ROOT, secteur: "Couvreur / toiture", ville: "Vannes" },
    { crawl: (url, opts) => crawlSite(url, { ...opts, fetchPage: fakeFetch(ARTISAN_PAGES) }), apiKey: "" }
  );
}

function openAiReply(data: unknown) {
  return (async () =>
    new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(data) }] }] }), {
      status: 200,
    })) as unknown as typeof fetch;
}

describe("crawlSite", () => {
  it("reads the pages a prospect would visit, not just the homepage", async () => {
    const crawl = await crawlFixture();
    expect(crawl.reachable).toBe(true);
    expect(crawl.pages.length).toBe(8);
    expect(crawl.sitemapUrlCount).toBe(8);
    const kinds = Object.fromEntries(crawl.pages.map((p) => [p.path, p.kind]));
    expect(kinds["/contact"]).toBe("contact");
    expect(kinds["/nos-realisations"]).toBe("realisations");
    expect(kinds["/mentions-legales"]).toBe("legal");
    expect(kinds["/zinguerie"]).toBe("service");
    expect(crawl.socialLinks.facebook).toContain("martincouverture56");
  });

  it("extracts forms with their visible fields only", async () => {
    const crawl = await crawlFixture();
    const contact = crawl.pages.find((p) => p.path === "/contact")!;
    expect(contact.forms[0].fieldCount).toBe(9);
    expect(contact.forms[0].fields).toContain("Code postal");
    expect(contact.forms[0].fields).not.toContain("_wpcf7");
  });

  it("classifies URLs by what they are", () => {
    expect(classifyUrl("/", "")).toBe("home");
    expect(classifyUrl("/demande-de-devis", "")).toBe("devis");
    expect(classifyUrl("/politique-de-confidentialite", "")).toBe("other");
    expect(classifyUrl("/nos-chantiers", "")).toBe("realisations");
  });

  it("detects a phone in the header and the order CTA → proof on the homepage", () => {
    const layout = parseHomeLayout(
      `<body><header><a href="tel:0297000000">02 97 00 00 00</a></header><main><p>${"texte ".repeat(20)} Demandez votre devis ${"texte ".repeat(200)} Témoignages clients</p></main></body>`
    );
    expect(layout.phoneInHeader).toBe(true);
    expect(layout.firstCtaPct).toBeLessThan(layout.firstProofPct!);
  });

  it("never throws on an unreachable site", async () => {
    const crawl = await crawlSite("https://inexistant.example/", { fetchPage: fakeFetch({}) });
    expect(crawl.reachable).toBe(false);
    expect(crawl.pages).toEqual([]);
  });
});

describe("extractFacts + buildEvidenceCards", () => {
  it("finds services sold without a dedicated page, with a quote from the site", async () => {
    const facts = extractFacts(await crawlFixture(), { city: "Vannes" });
    const labels = facts.servicesWithoutPage.map((s) => s.label);
    expect(labels).toContain("isolation extérieure");
    expect(labels).toContain("démoussage de toiture");
    expect(labels).not.toContain("zinguerie et gouttières");
    expect(facts.services.find((s) => s.label === "charpente")?.dedicatedPage).toBe("/charpente");
  });

  it("sees the unclickable phone, the hidden RGE label and the long form", async () => {
    const facts = extractFacts(await crawlFixture(), { city: "Vannes" });
    expect(facts.contact.phone).toBe("02 97 12 34 56");
    expect(facts.contact.homeTelLinks).toBe(0);
    expect(facts.proof.certifications).toEqual(expect.arrayContaining(["RGE", "Qualibat", "Garantie décennale"]));
    expect(facts.proof.certificationsOnHome).toEqual([]);
    expect(facts.contact.mainForm?.fieldCount).toBe(9);
    expect(facts.homeTitleNamesCity).toBe(false);
    expect(facts.zoneQuote).toContain("Vannes");
    expect(facts.legal.siret).toContain("123 456 789");
  });

  it("writes cards that name what was seen on this site", async () => {
    const facts = extractFacts(await crawlFixture(), { city: "Vannes" });
    const cards = buildEvidenceCards(facts, { trade: "Couvreur / toiture" });
    const ids = cards.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(["found_service_without_page", "contact_no_click_to_call", "chosen_labels_hidden", "contact_long_form", "found_city_absent"])
    );
    const phone = cards.find((c) => c.id === "contact_no_click_to_call")!;
    expect(phone.finding).toContain("02 97 12 34 56");
    const service = cards.find((c) => c.id === "found_service_without_page")!;
    expect(service.fix).toMatch(/Vannes/);
    for (const card of cards) {
      expect(card.potential).toBe(potentialForScore(card.score));
      expect(`${card.finding} ${card.loss}`).not.toMatch(/\d+\s?%|€/);
    }
  });

  it("keeps the three biggest problems, across axes when impact is close", async () => {
    const facts = extractFacts(await crawlFixture(), { city: "Vannes" });
    const top = pickTopCards(buildEvidenceCards(facts, { trade: "Couvreur / toiture" }));
    expect(top).toHaveLength(3);
    expect(new Set(top.map((c) => c.axis)).size).toBeGreaterThanOrEqual(2);
  });

  it("maps scores to a coherent potential", () => {
    expect(potentialForScore(2)).toBe("très fort");
    expect(potentialForScore(4)).toBe("fort");
    expect(potentialForScore(6)).toBe("moyen");
    expect(potentialForScore(9)).toBe("faible");
  });
});

describe("research plan", () => {
  it("builds métier + ville, service + ville, devis, site: and avis queries", async () => {
    const dossier = await dossierFixture();
    const queries = researchQueries(dossier.company, dossier.facts);
    expect(queries).toContain("couvreur Vannes");
    expect(queries.some((q) => /^isolation extérieure Vannes$|^démoussage de toiture Vannes$/.test(q))).toBe(true);
    expect(queries.some((q) => q.startsWith("devis "))).toBe(true);
    expect(queries).toContain("site:martin-couverture56.fr");
    expect(queries).toContain("Martin Couverture avis");
  });
});

describe("card validation", () => {
  const good = {
    axis: "trouve",
    title: "Visibilité du service isolation extérieure",
    score: 4,
    finding: "Le service isolation extérieure est cité sur la page d’accueil mais n’a aucune page dédiée.",
    seen: "Aucune URL ni H1 consacré à l’isolation extérieure parmi les 8 pages du sitemap.",
    loss: "Des prospects qui cherchent ce service à Vannes peuvent trouver un concurrent avant vous.",
    potentialText: "Une page dédiée correspondrait mieux à ces recherches.",
    fix: "Créer une page « Isolation extérieure Vannes » avec 3 chantiers et un bouton devis.",
    basis: "site",
  };

  it("accepts a specific card and forces a coherent potential", async () => {
    const dossier = await dossierFixture();
    const ctx = { haystack: dossierHaystack(dossier), anchors: dossierAnchors(dossier) };
    const result = validateCard({ ...good, score: 2 }, ctx);
    expect("reason" in result).toBe(false);
    if (!("reason" in result)) expect(result.potential).toBe("très fort");
  });

  it("rejects generic advice, invented metrics and invented quotes", async () => {
    const dossier = await dossierFixture();
    const ctx = { haystack: dossierHaystack(dossier), anchors: dossierAnchors(dossier) };
    const generic = validateCard(
      { ...good, title: "SEO à améliorer", finding: "Votre SEO pourrait être meilleur.", seen: "Le site est peu visible.", fix: "Améliorez votre SEO." },
      dossier,
      ctx
    );
    expect(generic).toMatchObject({ reason: expect.any(String) });
    expect(validateCard({ ...good, loss: "Vous perdez environ 30 % de vos demandes." }, ctx)).toMatchObject({ reason: "chiffre non observé" });
    expect(validateCard({ ...good, loss: "Vous perdez 12 clients par mois." }, ctx)).toMatchObject({ reason: "chiffre non observé" });
    expect(validateCard({ ...good, finding: "Vous êtes en 7e position sur Google pour isolation extérieure." }, ctx)).toMatchObject({
      reason: "chiffre non observé",
    });
    expect(
      validateCard({ ...good, seen: "La page d’accueil dit « nous sommes les meilleurs couvreurs de Bretagne depuis toujours »." }, ctx)
    ).toMatchObject({ reason: "citation introuvable dans les sources" });
  });

  it("fills missing AI cards with site-verified ones on other topics", async () => {
    const dossier = await dossierFixture();
    const ai = { ...dossier.evidenceCards[0], id: "ai_1" };
    const merged = mergeCards([ai], dossier.evidenceCards);
    expect(merged).toHaveLength(3);
    expect(new Set(merged.map((c) => c.id)).size).toBe(3);
  });
});

describe("diagnoseDossier", () => {
  it("ships site-verified cards when the AI layer is unavailable", async () => {
    const dossier = await dossierFixture();
    const result = await diagnoseDossier(dossier, { apiKey: "" });
    expect(result.mode).toBe("site");
    expect(result.cards).toHaveLength(3);
    expect(result.pagesAnalyzed).toBe(8);
  });

  it("keeps valid AI cards and drops invalid ones", async () => {
    const dossier = await dossierFixture();
    const fetchFn = openAiReply({
      summary: "Couvreur à Vannes — 8 pages du site analysées.",
      cards: [
        {
          axis: "contacte",
          title: "Numéro 02 97 12 34 56 non cliquable",
          score: 3,
          finding: "Le numéro 02 97 12 34 56 est écrit sur la page d’accueil mais n’est pas cliquable.",
          seen: "« Contactez-nous au 02 97 12 34 56 pour un devis gratuit » sans lien tel:.",
          loss: "Sur mobile, un prospect pressé peut appeler un concurrent joignable en un geste.",
          potentialText: "Un appel direct capte les demandes les plus urgentes.",
          fix: "Rendre le 02 97 12 34 56 cliquable dans l’en-tête.",
          basis: "site",
        },
        { axis: "trouve", title: "SEO", score: 5, finding: "Améliorez votre SEO.", seen: "Site peu visible.", loss: "Moins de visites.", potentialText: "Plus de visites.", fix: "Améliorez votre SEO.", basis: "site" },
      ],
    });
    const result = await diagnoseDossier(dossier, { apiKey: "test", fetchFn });
    expect(result.mode).toBe("ai");
    expect(result.cards[0].title).toContain("02 97 12 34 56");
    expect(result.cards[0].potential).toBe("très fort");
    expect(result.cards.some((c) => c.title === "SEO")).toBe(false);
    expect(result.cards).toHaveLength(3);
    // The site-verified phone card is not repeated under another name.
    expect(result.cards.filter((c) => /cliquable/i.test(c.title))).toHaveLength(1);
  });
});

describe("dossier signature", () => {
  it("verifies an untouched dossier and rejects a tampered one", async () => {
    const dossier = await dossierFixture();
    const signature = signDossier(dossier);
    expect(verifyDossier(JSON.parse(JSON.stringify(dossier)), signature)).toBe(true);
    const tampered = { ...dossier, company: { ...dossier.company, name: "Autre" } };
    expect(verifyDossier(tampered, signature)).toBe(false);
    expect(verifyDossier(dossier, "nope")).toBe(false);
  });
});

describe("verifyOfficialSite", () => {
  const candidate = {
    name: "Martin Couverture",
    website: ROOT,
    sector: "Couvreur / toiture",
    city: "Vannes",
    summary: "",
    confidence: "medium" as const,
    insights: [],
  };

  it("confirms a domain carrying the company name and city", async () => {
    const result = await verifyOfficialSite(candidate, { fetchPage: fakeFetch(ARTISAN_PAGES) });
    expect(result.verification?.verified).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.verification?.evidence.join(" ")).toMatch(/Vannes/);
  });

  it("drops a domain that does not carry the company name", async () => {
    const result = await verifyOfficialSite({ ...candidate, name: "Dupont Plomberie" }, { fetchPage: fakeFetch(ARTISAN_PAGES) });
    expect(result.website).toBe("");
    expect(result.confidence).toBe("low");
  });

  it("downgrades when the site cannot be read", async () => {
    const result = await verifyOfficialSite({ ...candidate, confidence: "high" }, { fetchPage: fakeFetch({}) });
    expect(result.confidence).toBe("medium");
    expect(result.website).toBe(ROOT);
  });
});

describe("background investigation", () => {
  function reply(body: unknown, status = 200) {
    return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  }

  it("starts a job and returns only the id — no waiting", async () => {
    const dossier = await dossierFixture();
    const calls: RequestInit[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(JSON.stringify({ id: "resp_abc123456789", status: "queued" }), { status: 200 });
    }) as unknown as typeof fetch;

    const jobId = await startInvestigation(dossier, { apiKey: "test", fetchFn });
    expect(jobId).toBe("resp_abc123456789");
    const body = JSON.parse(String(calls[0].body));
    expect(body.background).toBe(true);
    expect(body.tools[0].type).toBe("web_search");
    // The prompt carries the verified facts, so the model never re-guesses them.
    expect(String(body.input[1].content)).toContain("isolation extérieure");
  });

  it("reports pending while the job runs, then validates the cards it returns", async () => {
    const dossier = await dossierFixture();
    const context = toAuditContext(dossier);

    const pending = await collectInvestigation("resp_abc123456789", context, {
      apiKey: "test",
      fetchFn: reply({ status: "in_progress" }),
    });
    expect(pending.status).toBe("pending");

    const done = await collectInvestigation("resp_abc123456789", context, {
      apiKey: "test",
      fetchFn: reply({
        status: "completed",
        output: [
          {
            type: "web_search_call",
            action: { queries: ["couvreur Vannes", "isolation extérieure Vannes"], sources: [{ url: "https://exemple.fr/a", title: "Annuaire" }] },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  research: {
                    identityCheck: "Le site correspond bien à Martin Couverture à Vannes.",
                    observations: [
                      {
                        axis: "trouve",
                        query: "isolation extérieure Vannes",
                        finding: "Des concurrents avec une page dédiée ressortent avant le site dans les résultats consultés.",
                        sourceUrl: "https://exemple.fr/a",
                      },
                    ],
                    profiles: [{ platform: "Facebook", url: "https://www.facebook.com/martincouverture56", note: "Chantiers récents publiés." }],
                    reviews: "non trouvé",
                    servicesOutsideSite: [],
                    inconsistencies: [],
                  },
                  summary: "Couvreur · Vannes — 8 pages du site et 2 recherches analysées.",
                  cards: [
                    {
                      axis: "trouve",
                      title: "Visibilité du service isolation extérieure",
                      score: 4,
                      finding: "Le service isolation extérieure est cité sur l’accueil mais n’a aucune page dédiée.",
                      seen: "Dans les résultats consultés pour « isolation extérieure Vannes », des concurrents avec une page dédiée ressortent.",
                      loss: "Des prospects qui cherchent ce service peuvent trouver un concurrent avant vous.",
                      potentialText: "Une page dédiée correspondrait à ces recherches.",
                      fix: "Créer une page « Isolation extérieure Vannes » avec 3 chantiers et un bouton devis.",
                      basis: "site + recherche",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    });

    expect(done.status).toBe("done");
    if (done.status !== "done") return;
    expect(done.diagnostic.mode).toBe("ai");
    expect(done.diagnostic.cards[0].potential).toBe("fort");
    expect(done.diagnostic.queriesRun).toBe(2);
    expect(done.diagnostic.cards).toHaveLength(3);
  });

  it("treats a terminal OpenAI status as failed, not as an endless wait", async () => {
    const dossier = await dossierFixture();
    const outcome = await collectInvestigation("resp_abc123456789", toAuditContext(dossier), {
      apiKey: "test",
      fetchFn: reply({ status: "failed" }),
    });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("only polls job ids this server issued", async () => {
    expect(verifyJob("investigation", "resp_abc123456789", signJob("investigation", "resp_abc123456789"))).toBe(true);
    expect(verifyJob("investigation", "resp_abc123456789", signJob("discovery", "resp_abc123456789"))).toBe(false);
    expect(verifyJob("investigation", "resp_forged987654321", signJob("investigation", "resp_abc123456789"))).toBe(false);
    expect(verifyJob("investigation", "not-an-id", "0".repeat(64))).toBe(false);
  });

  it("falls back to site-verified cards when the job never lands", async () => {
    const dossier = await dossierFixture();
    const result = siteOnlyDiagnostic(toAuditContext(dossier));
    expect(result.mode).toBe("site");
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].finding.toLowerCase()).toContain("isolation extérieure");
  });
});

describe("request budgets", () => {
  it("keeps the crawl inside the host's request limit even on a slow site", async () => {
    // Every page takes 2 s: the crawl must stop on its budget, not on the
    // page count, and still return what it managed to read.
    const slowFetch = async (url: string) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      return fakeFetch(ARTISAN_PAGES)(url);
    };
    const started = Date.now();
    const dossier = await buildDossier(
      { entreprise: "Martin Couverture", siteUrl: ROOT, secteur: "Couvreur / toiture", ville: "Vannes" },
      { crawl: (url, opts) => crawlSite(url, { ...opts, fetchPage: slowFetch }), apiKey: "", budgetMs: 5_000 }
    );
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(9_000);
    expect(dossier.site.pages.length).toBeGreaterThanOrEqual(1);
  }, 15_000);
});

describe("company without a readable site", () => {
  it("still ships research-based cards instead of rejecting everything", async () => {
    const dossier = await buildDossier(
      { entreprise: "Toiture Le Gall", siteUrl: "", secteur: "Couvreur / toiture", ville: "Lorient" },
      { apiKey: "" }
    );
    expect(dossier.site.reachable).toBe(false);
    const context = toAuditContext(dossier);

    const outcome = await collectInvestigation("resp_abc123456789", context, {
      apiKey: "test",
      fetchFn: (async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      research: {
                        identityCheck: "Aucun site officiel retrouvé pour Toiture Le Gall à Lorient.",
                        observations: [
                          {
                            axis: "trouve",
                            query: "couvreur Lorient",
                            finding: "Seule une fiche annuaire ressort dans les résultats consultés.",
                            sourceUrl: "https://www.pagesjaunes.fr/exemple",
                          },
                        ],
                        profiles: [{ platform: "PagesJaunes", url: "https://www.pagesjaunes.fr/exemple", note: "Fiche sans photos." }],
                        reviews: "non trouvé",
                        servicesOutsideSite: [],
                        inconsistencies: [],
                      },
                      summary: "Couvreur · Lorient — présence publique analysée.",
                      cards: [
                        {
                          axis: "trouve",
                          title: "Toiture Le Gall n’a pas de site officiel retrouvé",
                          score: 2,
                          finding: "Aucun site officiel n’a été retrouvé pour Toiture Le Gall : seule une fiche annuaire ressort.",
                          seen: "Dans les résultats consultés pour « couvreur Lorient », une fiche PagesJaunes ressort, sans site.",
                          loss: "Un prospect qui compare plusieurs artisans peut ne trouver aucune preuve de votre travail.",
                          potentialText: "Une page officielle donnerait un point d’arrivée à toutes vos recherches.",
                          fix: "Publier une page avec vos services, votre zone, 5 chantiers et un bouton d’appel.",
                          basis: "recherche",
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200 }
        )) as unknown as typeof fetch,
    });

    expect(outcome.status).toBe("done");
    if (outcome.status !== "done") return;
    expect(outcome.diagnostic.mode).toBe("ai");
    // One AI card plus the deterministic "no site found" floor filling the
    // remaining slots — a thin AI result is padded with real content
    // instead of leaving the visitor with a one-line report.
    expect(outcome.diagnostic.cards).toHaveLength(3);
    expect(outcome.diagnostic.cards[0].title).toBe("Toiture Le Gall n’a pas de site officiel retrouvé");
  });
});
