import { expect, test, type Page } from "@playwright/test";

/**
 * A realistic Report payload matching src/lib/audit-engine/types.ts. Used to
 * mock POST /api/audit/analyze so these tests exercise the report UI and
 * its tracking deterministically, independent of real network access to an
 * external site (the engine itself is covered in engine.test.ts and
 * audit-analyze-api.spec.ts).
 */
const MOCK_REPORT = {
  header: {
    entreprise: "https://mon-restaurant.fr",
    secteur: "Restaurant / restauration",
    sectorProfile: "restaurant",
    objectif: "Plus de rendez-vous",
    siteUrl: "https://mon-restaurant.fr",
    generatedAt: new Date().toISOString(),
    siteReachable: true,
  },
  topLeaks: [
    {
      id: "conversion_no_mobile_viewport",
      dimension: "conversion",
      title: "La page n'est pas configurée pour un affichage mobile correct",
      statement: "Aucune balise viewport n'a été détectée.",
      evidence: ["Balise <meta name=\"viewport\"> absente."],
      confidence: "observed",
      impact: 5,
      effort: 4,
      polarity: "negative",
      recommendation: "Ajouter la balise viewport standard.",
    },
    {
      id: "trust_gap_high",
      dimension: "trust",
      title: "Écart important entre la confiance exigée et la preuve fournie",
      statement: "Ce secteur demande un niveau de confiance élevé.",
      evidence: ["Signaux de confiance présents : aucun détecté."],
      confidence: "inferred",
      impact: 5,
      effort: 2,
      polarity: "negative",
      recommendation: "Ajouter des avis clients récents.",
    },
    {
      id: "social_proof_absent",
      dimension: "social_proof",
      title: "Aucune preuve sociale détectée sur la page",
      statement: "Ni avis, ni témoignage n'ont été détectés.",
      evidence: ["Aucun marqueur de témoignage/avis détecté."],
      confidence: "observed",
      impact: 3,
      effort: 3,
      polarity: "negative",
      recommendation: "Intégrer 2 à 3 avis réels.",
    },
  ],
  worksWell: [
    {
      id: "positioning_clear_headline",
      dimension: "positioning",
      title: "Un titre principal identifiable existe",
      statement: "La page affiche un titre principal exploitable.",
      evidence: ["Titre principal (H1) : « Bienvenue »"],
      confidence: "observed",
      impact: 2,
      effort: 5,
      polarity: "positive",
    },
  ],
  otherFindings: [],
  actionPlan: [
    { order: 1, title: "La page n'est pas configurée pour un affichage mobile correct", recommendation: "Ajouter la balise viewport standard." },
    { order: 2, title: "Écart important entre la confiance exigée et la preuve fournie", recommendation: "Ajouter des avis clients récents." },
    { order: 3, title: "Aucune preuve sociale détectée sur la page", recommendation: "Intégrer 2 à 3 avis réels." },
  ],
  degraded: false,
  sectorNote: "La qualité de la cuisine elle-même n'est pas évaluable depuis le site.",
  engineVersion: "1.0.0",
};

async function mockAnalyze(page: Page, report: unknown = MOCK_REPORT, opts: { delayMs?: number } = {}) {
  await page.route("**/api/audit/analyze", async (route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ report }) });
  });
}

async function completeFunnel(page: Page) {
  // Consent is a real blocking UI. Funnel tests make the same legitimate
  // choice a visitor must make instead of bypassing pointer-event checks.
  const consent = page.getByRole("dialog", { name: "Préférences de confidentialité" });
  if (await consent.isVisible().catch(() => false)) {
    await consent.getByRole("button", { name: "Accepter", exact: true }).click();
    await expect(consent).toBeHidden();
  }

  await page.getByLabel("Votre site").fill("https://mon-restaurant.fr");
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Restaurants", exact: true }).click();
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Plus de rendez-vous" }).click();
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByLabel("Nom complet").fill("Marie Dupont");
  await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
}

test.describe("audit report", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/audit", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "received", emailed: true }) })
    );
    await page.goto("/audit");

    // A first-time visitor legitimately sees the privacy dialog. Resolve it
    // through the real UI before exercising the funnel so the suite mirrors
    // an actual visitor choice instead of attempting to click through an
    // interactive consent surface.
    await page.getByRole("button", { name: "Refuser", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Préférences de confidentialité" })).toHaveCount(0);
  });

  test("shows the real diagnostic instead of the generic confirmation once analysis succeeds", async ({ page }) => {
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();
    await expect(page.getByText("mon-restaurant.fr")).toBeVisible();
    await expect(page.getByText("Restaurant / restauration")).toBeVisible();
    // Finding titles are scoped to their <h3> — the same title also appears
    // as plain text in "Ce que nous changerions", so an unscoped getByText
    // would match twice.
    await expect(
      page.getByRole("heading", { name: "La page n'est pas configurée pour un affichage mobile correct" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Écart important entre la confiance exigée" })).toBeVisible();
    await expect(page.getByText(/constats concrets/, { exact: true })).toBeVisible();
  });

  test("labels each finding's reliability rather than presenting it as flat fact", async ({ page }) => {
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    await expect(page.getByText("Observé sur votre site").first()).toBeVisible();
    await expect(page.getByText("Déduit").first()).toBeVisible();
  });

  test("falls back to the plain confirmation when the analysis fails — the lead is never lost", async ({ page }) => {
    await page.route("**/api/audit/analyze", (route) => route.fulfill({ status: 502 }));
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.getByRole("heading", { name: "Votre analyse est en préparation." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toHaveCount(0);
  });

  test("falls back to the plain confirmation when the analysis is still running after the wait window", async ({ page }) => {
    await mockAnalyze(page, MOCK_REPORT, { delayMs: 10_000 }); // longer than REPORT_WAIT_MS
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.getByRole("heading", { name: "Votre analyse est en préparation." })).toBeVisible({ timeout: 10_000 });
  });

  test("shows a degraded notice when the site itself could not be probed", async ({ page }) => {
    await mockAnalyze(page, { ...MOCK_REPORT, degraded: true, degradedReason: "Nous n'avons pas pu analyser directement votre site." });
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.getByText("Analyse partielle.")).toBeVisible();
  });

  test("turns the report into a prefilled Calendly booking path and tracks intent", async ({ page }) => {
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    await expect(page.getByText("Audit GC")).toBeVisible();
    await expect(page.getByRole("heading", { name: /On vous montre quoi corriger en premier/ })).toBeVisible();

    const booking = page.getByRole("link", { name: /Réserver mon bilan de 30 min/ });
    const href = await booking.getAttribute("href");
    expect(href).toContain("calendly.com/ledorvenenzo50/consultation-strategique-acquisition-developpement");
    expect(href).toContain("name=Marie+Dupont");
    expect(href).toContain("email=marie%40exemple.fr");
    expect(href).toContain("utm_source=capable_audit");

    await booking.evaluate((node) => node.addEventListener("click", (event) => event.preventDefault(), { once: true }));
    await booking.click();
    const fired = await page.evaluate(() => (window.dataLayer ?? []).map((e) => e.event));
    expect(fired).toContain("booking_started");
    expect(fired).toContain("audit_cta_clicked");
    await expect(page.getByRole("link", { name: /Voir la méthode GC/ })).toHaveCount(0);
  });

  test("tracks the full analysis lifecycle in the dataLayer", async ({ page }) => {
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => (window.dataLayer ?? []).map((e) => e.event)))
      .toEqual(
        expect.arrayContaining([
          "audit_analysis_started",
          "audit_analysis_completed",
          "audit_report_viewed",
        ])
      );
  });

  test("tracks a finding as viewed once it is actually on screen", async ({ page }) => {
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    // The new report intentionally puts the GC summary before the detailed
    // opportunities. Scroll a real finding into view before asserting the
    // IntersectionObserver-driven event.
    await page
      .getByRole("heading", { name: "La page n'est pas configurée pour un affichage mobile correct" })
      .scrollIntoViewIfNeeded();

    await expect
      .poll(() => page.evaluate(() => (window.dataLayer ?? []).map((e) => e.event)))
      .toEqual(expect.arrayContaining(["audit_finding_viewed"]));
  });

  test("renders correctly on a phone viewport with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test("never lets the report claim a fabricated business metric", async ({ page }) => {
    await mockAnalyze(page);
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/taux de conversion de \d/i);
    expect(bodyText).not.toMatch(/chiffre d'affaires/i);
  });

  test("attaches a report digest to the lead submission once the analysis has landed", async ({ page }) => {
    let leadPostData: string | null = null;
    await page.route("**/api/audit", (route) => {
      leadPostData = route.request().postData();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "received", emailed: true }) });
    });
    await mockAnalyze(page);
    await completeFunnel(page);

    // Give the background analysis (mocked, instant) time to resolve into
    // lastReport before the visitor submits — the same real-world sequence
    // the funnel relies on (analysis starts at step 3→4, well before submit).
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();
    await expect(page.getByRole("heading", { name: "Ce qui bloque aujourd’hui" })).toBeVisible();

    expect(leadPostData).toBeTruthy();
    const payload = JSON.parse(leadPostData!);
    expect(payload.reportSummary).toBeTruthy();
    expect(payload.reportSummary.degraded).toBe(false);
    expect(payload.reportSummary.topLeaks).toHaveLength(3);
    expect(payload.reportSummary.topLeaks[0]).toMatchObject({
      title: "La page n'est pas configurée pour un affichage mobile correct",
      dimension: "Conversion",
    });
    // No PII leaks into the summary sent for the digest — only titles/dimensions.
    expect(JSON.stringify(payload.reportSummary)).not.toMatch(/marie@exemple\.fr/);
  });

  test("submits the lead normally, without a reportSummary, when the analysis has not resolved yet", async ({ page }) => {
    let leadPostData: string | null = null;
    await page.route("**/api/audit", (route) => {
      leadPostData = route.request().postData();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "received", emailed: true }) });
    });
    // Analysis never resolves within the test — the lead must still go through.
    await page.route("**/api/audit/analyze", () => {
      /* left hanging on purpose */
    });
    await completeFunnel(page);
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.getByRole("heading", { name: "Votre analyse est en préparation." })).toBeVisible({
      timeout: 10_000,
    });
    expect(leadPostData).toBeTruthy();
    const payload = JSON.parse(leadPostData!);
    expect(payload.reportSummary).toBeUndefined();
  });
});
