import { expect, test, type Page } from "@playwright/test";

/**
 * The real /audit journey: company name → (city only if ambiguous) →
 * research stage → diagnosis stage → three cards → booking CTA.
 * Every API is mocked: these tests check the journey and the rendering,
 * the engine itself is covered by the unit tests.
 */

const COMPANY = {
  name: "Martin Couverture",
  website: "https://www.martin-couverture56.fr/",
  sector: "Couvreur / toiture",
  city: "Vannes",
  summary: "Couvreur à Vannes.",
  confidence: "high",
  insights: [],
};

const CARDS = [
  {
    id: "ai_1",
    axis: "trouve",
    title: "Visibilité du service isolation extérieure",
    score: 4,
    finding: "« Isolation extérieure » apparaît sur la page d’accueil, mais aucune page dédiée n’a été retrouvée parmi les 8 pages du site.",
    seen: "« démoussage de toiture et isolation extérieure des murs » — sans page propre à ce service.",
    loss: "Des prospects qui cherchent « isolation extérieure Vannes » peuvent trouver un concurrent plus explicite avant vous.",
    potential: "fort",
    potentialText: "Une page dédiée correspondrait aux recherches de prospects déjà intéressés par ce service.",
    fix: "Créer une page « Isolation extérieure Vannes » avec 3 chantiers et un bouton devis.",
    basis: "site + recherche",
  },
  {
    id: "ai_2",
    axis: "contacte",
    title: "Votre numéro n’est pas cliquable",
    score: 3,
    finding: "Le numéro 02 97 12 34 56 est écrit sur votre site, mais aucun lien d’appel direct n’a été détecté.",
    seen: "02 97 12 34 56 présent en texte ; 0 lien « tel: » sur la page d’accueil.",
    loss: "Sur mobile, un prospect pressé peut appeler le concurrent suivant.",
    potential: "très fort",
    potentialText: "Un appel en un geste capte les demandes les plus urgentes.",
    fix: "Rendre le 02 97 12 34 56 cliquable dans l’en-tête.",
    basis: "site",
  },
  {
    id: "ai_3",
    axis: "choisi",
    title: "Vos réalisations sont loin de la décision",
    score: 5,
    finding: "Vous avez une page /nos-realisations (6 images), mais l’accueil ne montre aucune preuve près du devis.",
    seen: "/nos-realisations contient 6 visuels ; l’accueil n’a aucun avis ni témoignage.",
    loss: "Un visiteur qui compare plusieurs artisans peut partir avant d’avoir vu vos chantiers.",
    potential: "fort",
    potentialText: "Rapprocher vos chantiers du bouton de devis rend votre sérieux visible au bon moment.",
    fix: "Afficher 3 réalisations avant/après au-dessus du bouton de devis de l’accueil.",
    basis: "site",
  },
];

const REPORT = {
  header: {
    entreprise: COMPANY.name,
    secteur: COMPANY.sector,
    sectorProfile: "artisan",
    objectif: "",
    siteUrl: COMPANY.website,
    generatedAt: new Date().toISOString(),
    siteReachable: true,
  },
  topLeaks: [],
  worksWell: [],
  otherFindings: [],
  actionPlan: [],
  degraded: false,
  sectorNote: "Heuristiques sectorielles.",
  engineVersion: "2.0.0",
  diagnostic: {
    company: { name: COMPANY.name, city: COMPANY.city, trade: COMPANY.sector, siteUrl: COMPANY.website, domain: "martin-couverture56.fr" },
    summary: "Couvreur · Vannes — 8 pages du site et 8 recherches web analysées.",
    cards: CARDS,
    pagesAnalyzed: 8,
    queriesRun: 8,
    sourcesConsulted: 14,
    mode: "ai",
  },
};

async function acceptConsentIfShown(page: Page) {
  const consent = page.getByRole("dialog", { name: "Préférences de confidentialité" });
  // The banner mounts after hydration; give it a moment rather than racing it.
  if (await consent.waitFor({ state: "visible", timeout: 4_000 }).then(() => true, () => false)) {
    await consent.getByRole("button", { name: "Refuser", exact: true }).click();
    await expect(consent).toBeHidden();
  }
}

async function mockApis(page: Page, candidates: unknown[] = [COMPANY]) {
  const calls: Record<string, string[]> = { discover: [], research: [], analyze: [] };

  // Discovery and the investigation run as background jobs: the client
  // starts one, then polls. The mocks mirror that contract exactly.
  await page.route("**/api/audit/discover", (route) => {
    const body = route.request().postData() ?? "";
    calls.discover.push(body);
    const polling = body.includes("jobId");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        polling
          ? { status: "done", candidates }
          : { status: "started", jobId: "resp_testdiscovery1", token: "t".repeat(64) }
      ),
    });
  });

  await page.route("**/api/audit/intent", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  await page.route("**/api/audit/research", (route) => {
    calls.research.push(route.request().postData() ?? "");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        context: { v: 1 },
        signature: "a".repeat(64),
        jobId: "resp_testinvestigation1",
        token: "b".repeat(64),
        stats: { pagesAnalyzed: 8, siteReachable: true, evidenceCards: 6, investigating: true },
      }),
    });
  });

  await page.route("**/api/audit/analyze", (route) => {
    calls.analyze.push(route.request().postData() ?? "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "done", report: REPORT }) });
  });

  return calls;
}

async function start(page: Page, name = "Martin Couverture") {
  await page.goto("/audit");
  await acceptConsentIfShown(page);
  await page.getByLabel("Nom de votre entreprise").fill(name);
  await page.getByRole("button", { name: /Analyser mon entreprise/ }).click();
}

test.describe("Audit funnel — nom → diagnostic", () => {
  test("never asks for a website URL", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByLabel("Nom de votre entreprise")).toBeVisible();
    await expect(page.getByLabel(/Votre site/)).toHaveCount(0);
  });

  test("runs discovery → research → analysis and shows three precise cards", async ({ page }) => {
    const calls = await mockApis(page);
    await start(page);

    await expect(page).toHaveURL(/\/audit\/merci$/);
    const cards = page.getByTestId("diagnostic-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText("Visibilité du service isolation extérieure");
    await expect(cards.first()).toContainText("4/10");
    await expect(cards.first()).toContainText("Vu :");
    await expect(cards.first()).toContainText("L’opportunité à débloquer");
    await expect(cards.first()).toContainText(/Potentiel\s*:\s*fort/i);
    await expect(cards.first()).toContainText("Première action");
    await expect(page.getByRole("heading", { name: "Votre potentiel est clair. Passons au plan." })).toBeVisible();

    expect(JSON.parse(calls.research[0])).toMatchObject({ entreprise: "Martin Couverture", siteUrl: COMPANY.website, ville: "Vannes" });
    // Stage 2 polls the signed job, it never re-sends a bare company name.
    expect(JSON.parse(calls.analyze[0])).toMatchObject({
      signature: "a".repeat(64),
      context: { v: 1 },
      jobId: "resp_testinvestigation1",
    });
  });

  test("lets the visitor request an email notification without opting into marketing", async ({ page }) => {
    await mockApis(page);
    const contactCalls: Record<string, unknown>[] = [];
    await page.route("**/api/audit/contact", async (route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      contactCalls.push(payload);
      if (payload.action === "register") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "registered",
            id: "11111111-1111-4111-8111-111111111111",
            token: "22222222-2222-4222-8222-222222222222",
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: payload.action === "attach" ? "attached" : "ok" }),
      });
    });

    await page.unroute("**/api/audit/analyze");
    let polls = 0;
    await page.route("**/api/audit/analyze", (route) => {
      polls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(polls < 4 ? { status: "pending" } : { status: "done", report: REPORT }),
      });
    });

    await start(page);
    await expect(page.getByText("Recevez le résultat, sans attendre ici.")).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Votre email").fill("artisan@example.com");
    await page.getByRole("button", { name: /Me prévenir/ }).click();
    await expect(page.getByText(/Vous pouvez fermer cette page/)).toBeVisible();

    const registration = contactCalls.find((call) => call.action === "register");
    expect(registration).toMatchObject({
      email: "artisan@example.com",
      marketingConsent: false,
      phone: "",
    });
    expect(contactCalls.some((call) => call.action === "attach")).toBe(true);
  });

  test("the final button opens the booking page with attribution", async ({ page }) => {
    await mockApis(page);
    await page.goto("/audit?utm_source=google&utm_medium=cpc&utm_campaign=gc_search_btp");
    await acceptConsentIfShown(page);
    await page.getByLabel("Nom de votre entreprise").fill("Martin Couverture");
    await page.getByRole("button", { name: /Analyser mon entreprise/ }).click();

    const cta = page.getByRole("link", { name: /Construire mon plan d’action/ });
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toContain("calendly.com/");
    expect(href).toContain("utm_source=google");
    expect(href).toContain("utm_campaign=gc_search_btp");
    await expect(cta).toHaveAttribute("target", "_blank");
  });

  test("asks for the city immediately when the registry already knows there are homonyms, then resumes", async ({ page }) => {
    const calls = await mockApis(page);
    await page.unroute("**/api/audit/discover");
    let startCount = 0;
    await page.route("**/api/audit/discover", (route) => {
      const body = route.request().postData() ?? "{}";
      calls.discover.push(body);
      const payload = JSON.parse(body) as { cityHint?: string; jobId?: string };

      if (!payload.cityHint && !payload.jobId && startCount++ === 0) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "needs_city",
            candidates: [
              { ...COMPANY, website: "", confidence: "medium" },
              { ...COMPANY, city: "Lyon", website: "", confidence: "medium" },
            ],
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          payload.jobId
            ? { status: "done", candidates: [COMPANY] }
            : { status: "started", jobId: "resp_testdiscovery2", token: "t".repeat(64), resolvedCity: "Vannes" }
        ),
      });
    });

    await start(page, "Martin Couverture");

    const city = page.getByLabel("Ville ou code postal");
    await expect(city).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Plusieurs entreprises peuvent porter ce nom/)).toBeVisible();
    expect(calls.research).toHaveLength(0);

    await city.fill("56000");
    await page.getByRole("button", { name: /Continuer l’analyse/ }).click();
    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3);
    expect(JSON.parse(calls.discover[calls.discover.length - 1])).toMatchObject({ companyName: "Martin Couverture", cityHint: "Vannes" });
  });

  test("falls back to a site-only analysis when the research stage fails", async ({ page }) => {
    const calls = await mockApis(page);
    await page.unroute("**/api/audit/research");
    await page.route("**/api/audit/research", (route) => route.fulfill({ status: 502, body: "{}" }));
    await start(page);

    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3);
    expect(JSON.parse(calls.analyze[0])).toMatchObject({ entreprise: "Martin Couverture", siteUrl: COMPANY.website });
  });

  test("shows a retry message, not a fake diagnostic, when analysis fails", async ({ page }) => {
    await mockApis(page);
    await page.unroute("**/api/audit/analyze");
    await page.route("**/api/audit/analyze", (route) => route.fulfill({ status: 502, body: "{}" }));
    await start(page);

    await expect(page.getByText(/n’a pas pu être finalisée/)).toBeVisible();
    await expect(page).toHaveURL(/\/audit$/);
  });

  test("cards fit a phone screen without horizontal scroll", async ({ page }) => {
    await mockApis(page);
    await start(page);
    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("Audit funnel — resilience", () => {
  test("runs an automatic identity rescue before asking the visitor for the site", async ({ page }) => {
    const calls = await mockApis(page);
    await page.unroute("**/api/audit/discover");
    await page.route("**/api/audit/discover", (route) => {
      const body = route.request().postData() ?? "{}";
      calls.discover.push(body);
      const payload = JSON.parse(body) as { jobId?: string; rescue?: boolean };
      const weakCandidate = { ...COMPANY, website: "", confidence: "high" };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          payload.jobId
            ? { status: "done", candidates: payload.rescue ? [COMPANY] : [weakCandidate] }
            : {
                status: "started",
                jobId: payload.rescue ? "resp_testrescue0001" : "resp_testdiscovery1",
                token: "t".repeat(64),
              }
        ),
      });
    });

    await start(page, "AATP");

    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3, { timeout: 60_000 });
    expect(calls.discover.some((body) => JSON.parse(body).rescue === true)).toBe(true);
    expect(JSON.parse(calls.research[0])).toMatchObject({ siteUrl: COMPANY.website });
  });

  test("keeps polling while the investigation runs, then shows its cards", async ({ page }) => {
    const calls = await mockApis(page);
    await page.unroute("**/api/audit/analyze");
    let polls = 0;
    await page.route("**/api/audit/analyze", (route) => {
      const body = route.request().postData() ?? "";
      calls.analyze.push(body);
      polls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(polls < 3 ? { status: "pending" } : { status: "done", report: REPORT }),
      });
    });

    await start(page);
    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3, { timeout: 60_000 });
    expect(polls).toBeGreaterThanOrEqual(3);
  });

  test("ships the site-verified cards when no investigation could be started", async ({ page }) => {
    const calls = await mockApis(page);
    await page.unroute("**/api/audit/research");
    await page.route("**/api/audit/research", (route) => {
      calls.research.push(route.request().postData() ?? "");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          context: { v: 1 },
          signature: "a".repeat(64),
          stats: { pagesAnalyzed: 8, siteReachable: true, evidenceCards: 6, investigating: false },
        }),
      });
    });

    await start(page);
    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3, { timeout: 60_000 });
    // Straight to the site-verified diagnostic: no job to poll.
    expect(JSON.parse(calls.analyze[0])).toMatchObject({ context: { v: 1 }, signature: "a".repeat(64) });
    expect(calls.analyze[0]).not.toContain("jobId");
  });
});

test.describe("Audit funnel — quand l'entreprise n'est pas retrouvée", () => {
  test("asks for the site address instead of ending on an empty diagnostic", async ({ page }) => {
    const calls = await mockApis(page, []);
    await start(page, "Entreprise Introuvable");

    // No company could be resolved: the funnel asks rather than guessing.
    const site = page.getByLabel("Adresse de votre site");
    await expect(site).toBeVisible();
    expect(calls.research).toHaveLength(0);

    await site.fill("entreprise-introuvable.fr");
    await page.getByRole("button", { name: /Analyser mon site/ }).click();

    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3);
    expect(JSON.parse(calls.research[0])).toMatchObject({
      entreprise: "Entreprise Introuvable",
      siteUrl: "entreprise-introuvable.fr",
    });
  });

  test("lets a company with no site continue anyway", async ({ page }) => {
    const calls = await mockApis(page, []);
    await start(page, "Entreprise Sans Site");

    await expect(page.getByLabel("Adresse de votre site")).toBeVisible();
    await page.getByRole("button", { name: /Je n’ai pas encore de site/ }).click();

    await expect(page.getByTestId("diagnostic-card")).toHaveCount(3);
    expect(JSON.parse(calls.research[0])).toMatchObject({ entreprise: "Entreprise Sans Site", siteUrl: "" });
  });
});
