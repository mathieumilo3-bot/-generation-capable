import { expect, test, type Page } from "@playwright/test";

const COMPANY = {
  name: "Dupont Couverture",
  website: "https://dupont-couverture.fr/",
  sector: "Couvreur / toiture",
  city: "Rennes",
  summary: "Entreprise de couverture retrouvée à Rennes.",
  confidence: "high",
  insights: [
    {
      title: "Vos preuves doivent être visibles avant le premier appel",
      insight: "Les éléments publics retrouvés permettent d’identifier l’activité, mais les preuves doivent être immédiatement reliées à la demande de devis.",
      evidence: ["Site officiel retrouvé", "Activité de couverture identifiable"],
    },
    {
      title: "Votre zone d’intervention doit être évidente",
      insight: "La présence locale doit relier clairement le métier aux zones réellement couvertes.",
      evidence: ["Rennes est identifiable dans les sources publiques"],
    },
    {
      title: "Le chemin vers le devis doit rester direct",
      insight: "Un prospect prêt à agir doit pouvoir comprendre la prochaine étape sans chercher.",
      evidence: ["Parcours de contact visible sur le site"],
    },
  ],
};

async function startDiscovery(page: Page, name = "Dupont Couverture") {
  await page.getByLabel("Nom de votre entreprise").fill(name);
  await page.getByRole("button", { name: /Analyser mon entreprise/ }).click();
  await expect(page.getByText(COMPANY.name, { exact: true })).toBeVisible();
  await expect(page.getByText(COMPANY.insights[0].title, { exact: true })).toBeVisible();
}

async function reachContact(page: Page) {
  await startDiscovery(page);
  await page.getByRole("button", { name: /Personnaliser mon diagnostic/ }).click();
  await expect(page.getByRole("heading", { name: "Pourquoi faites-vous ce diagnostic ?" })).toBeVisible();
  await page.getByRole("button", { name: "Plus de chantiers", exact: true }).click();
  await page.getByRole("button", { name: /Analyser selon mes objectifs/ }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
}

test.describe("Capable Audit funnel", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/audit/discover", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ candidates: [COMPANY], webSources: [] }),
      })
    );
    await page.route("**/api/audit/quick", (route) => route.abort());
    await page.route("**/api/audit/analyze", (route) => route.abort());
    await page.route("**/api/audit", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "received", accepted: true, emailed: true }),
      })
    );
    await page.goto("/audit");
  });

  test("starts from a company name and submits the resolved company", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/api/audit")) requests.push(req.postData() ?? "");
    });

    await reachContact(page);
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByRole("button", { name: /Générer mon audit PDF/ }).click();

    await expect(page).toHaveURL(/\/audit\/merci$/);
    await expect(page.getByRole("heading", { name: "Votre audit est en préparation." })).toBeVisible();

    expect(requests).toHaveLength(1);
    const payload = JSON.parse(requests[0]);
    expect(payload).toMatchObject({
      entreprise: "Dupont Couverture",
      siteUrl: "https://dupont-couverture.fr/",
      secteur: "Couvreur / toiture",
      objectif: "Plus de chantiers",
      email: "marie@exemple.fr",
    });
  });

  test("does not ask for a website URL", async ({ page }) => {
    await expect(page.getByLabel("Nom de votre entreprise")).toBeVisible();
    await expect(page.getByLabel("Votre site")).toHaveCount(0);
    await expect(page.getByText(/Pas besoin de connaître l’adresse de votre site/)).toBeVisible();
  });

  test("lets a prospect select up to three qualification objectives", async ({ page }) => {
    await startDiscovery(page);
    await page.getByRole("button", { name: /Personnaliser mon diagnostic/ }).click();

    await page.getByRole("button", { name: "Plus de chantiers", exact: true }).click();
    await page.getByRole("button", { name: "Plus de visibilité", exact: true }).click();
    await page.getByRole("button", { name: "Recevoir plus de demandes de devis", exact: true }).click();

    await expect(page.getByText("3 / 3 sélectionnés")).toBeVisible();
    await expect(page.getByRole("button", { name: "Être mieux trouvé sur Google", exact: true })).toBeDisabled();

    await page.getByRole("button", { name: /Analyser selon mes objectifs/ }).click();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  });

  test("Enter launches company discovery without submitting a lead", async ({ page }) => {
    const leads: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/api/audit")) leads.push(req.url());
    });

    await page.getByLabel("Nom de votre entreprise").fill("Dupont Couverture");
    await page.getByLabel("Nom de votre entreprise").press("Enter");

    await expect(page.getByText(COMPANY.name, { exact: true })).toBeVisible();
    expect(leads).toHaveLength(0);
  });

  test("skips the trade question when the company sector is identified", async ({ page }) => {
    await startDiscovery(page);
    await page.getByRole("button", { name: /Personnaliser mon diagnostic/ }).click();
    await expect(page.getByRole("heading", { name: "Pourquoi faites-vous ce diagnostic ?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quel est votre métier principal ?" })).toHaveCount(0);
  });

  test("falls back to manual qualification when no company match is safe", async ({ page }) => {
    await page.unroute("**/api/audit/discover");
    await page.route("**/api/audit/discover", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ candidates: [], webSources: [] }),
      })
    );

    await page.getByLabel("Nom de votre entreprise").fill("Nom ambigu");
    await page.getByRole("button", { name: /Analyser mon entreprise/ }).click();
    await expect(page.getByRole("heading", { name: "Quel est votre métier principal ?" })).toBeVisible();
    await expect(page.getByText(/On a votre entreprise/)).toBeVisible();
  });

  test("preserves Google Ads attribution on the lead", async ({ page }) => {
    await page.goto(
      "/audit?utm_source=google&utm_medium=cpc&utm_campaign=gc_search_btp&utm_content=chantiers&gclid=test-click-id"
    );

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/api/audit")) requests.push(req.postData() ?? "");
    });

    await reachContact(page);
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByRole("button", { name: /Générer mon audit PDF/ }).click();
    await expect(page).toHaveURL(/\/audit\/merci$/);

    const payload = JSON.parse(requests[0]);
    expect(payload).toMatchObject({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "gc_search_btp",
      utmContent: "chantiers",
      gclid: "test-click-id",
    });
  });

  test("shows an actionable submission error and keeps the email", async ({ page }) => {
    await page.unroute("**/api/audit");
    await page.route("**/api/audit", (route) =>
      route.fulfill({ status: 502, body: JSON.stringify({ error: "lead_capture_failed" }) })
    );

    await reachContact(page);
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByRole("button", { name: /Générer mon audit PDF/ }).click();

    await expect(page.locator('form [role="alert"]')).toContainText("n'a pas pu être envoyée");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("marie@exemple.fr");
  });
});
