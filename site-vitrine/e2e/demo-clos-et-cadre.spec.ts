import { expect, test, type Page } from "@playwright/test";

const BASE = "/demonstrations/clos-et-cadre";

const ROUTES = [
  BASE,
  `${BASE}/realisations`,
  `${BASE}/realisations/extension-maison-meuliere-chatou`,
  `${BASE}/realisations/renovation-globale-pavillon-le-vesinet`,
  `${BASE}/realisations/restructuration-appartement-saint-germain-en-laye`,
  `${BASE}/realisations/surelevation-pavillon-rueil-malmaison`,
  `${BASE}/expertises`,
  `${BASE}/entreprise`,
  `${BASE}/projet`,
];

// The consent banner is GC's, shared by every page; answered once so it
// never sits on top of the demo's buttons.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("gc-revenue-consent-v1", "refused"));
});

test.describe("Clos & Cadre demonstration", () => {
  for (const route of ROUTES) {
    test(`${route} renders, is labelled as a demo and stays out of the index`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.getByText("Site de démonstration.", { exact: false }).first()).toBeVisible();
      // Never the GC chrome inside the client's site.
      await expect(page.getByRole("link", { name: "Analyser mon entreprise" })).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test("unknown project returns the demo's own 404", async ({ page }) => {
    const response = await page.goto(`${BASE}/realisations/inexistant`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /Cette page n'existe pas, ou plus/ })).toBeVisible();
  });

  test("strategy notes are hidden until the ribbon toggle reveals them", async ({ page }) => {
    await page.goto(BASE);
    const note = page.locator(".cc-note").first();
    await expect(note).toBeHidden();
    await page.getByRole("button", { name: "Lire la stratégie" }).click();
    await expect(note).toBeVisible();
  });

  test("before/after slider is keyboard operable", async ({ page }) => {
    await page.goto(`${BASE}/realisations/renovation-globale-pavillon-le-vesinet`);
    const slider = page.getByRole("slider", { name: /Comparer/ });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(slider).toHaveValue("0");
  });

  test("project filters narrow the portfolio", async ({ page }) => {
    await page.goto(`${BASE}/realisations`);
    await expect(page.locator("article")).toHaveCount(4);
    await page.getByRole("button", { name: /Surélévation/ }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Surélévation d'un pavillon" })).toBeVisible();
  });
});

/** Clicks the visible option card, as a visitor does — the input itself is visually hidden. */
async function choose(page: Page, text: string | RegExp) {
  const option = page.locator("label").filter({ hasText: text }).first();
  await option.click();
  await expect(option.locator("input")).toBeChecked();
}

async function fillProjectRequest(page: Page) {
  // Step 1 — pre-filled from the service page link
  await expect(page.getByRole("radio", { name: /Extension/ })).toBeChecked();
  await choose(page, "D'une maison");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 2
  await expect(page.getByRole("heading", { name: "Le bien" })).toBeFocused();
  await page.getByLabel("Commune du bien").selectOption("Chatou");
  await choose(page, "Avant 1948");
  await page.getByLabel("Surface actuelle").fill("118");
  await page.getByLabel("Surface à créer").fill("38");
  await choose(page, "Nous y habitons");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 3
  await choose(page, "Ouverture de mur porteur");
  await choose(page, "Dans 3 à 6 mois");
  await choose(page, "150 000 – 300 000 €");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 4
  await page.getByLabel("Nom et prénom").fill("Claire Martin");
  await page.getByLabel("Téléphone", { exact: true }).fill("06 12 34 56 78");
  await page.getByLabel("Email", { exact: true }).fill("claire@example.com");
  await choose(page, /Fin de journée/);
}

test.describe("Clos & Cadre project request", () => {
  test("validates each step before moving on", async ({ page }) => {
    await page.goto(`${BASE}/projet`);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Choisissez le type de projet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Votre projet", exact: true })).toBeVisible();
  });

  test("qualifies a complete request into a prioritised project brief", async ({ page }) => {
    await page.goto(`${BASE}/projet?type=extension`);
    await fillProjectRequest(page);

    // Consent is required
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText(/Votre accord est nécessaire/)).toBeVisible();
    await page.getByRole("checkbox", { name: /J'accepte/ }).check();

    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByRole("heading", { name: /Merci Claire/ })).toBeVisible();
    await expect(page.getByText("Dans la zone d'intervention")).toBeVisible();
    await expect(page.getByText("Permis de construire et architecte")).toBeVisible();
    await expect(page.getByText("Projet prioritaire — rappeler au créneau demandé")).toBeVisible();
  });

  test("shows a recoverable error when the request fails", async ({ page }) => {
    await page.route("**/api/demonstrations/clos-et-cadre", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.goto(`${BASE}/projet?type=extension`);
    await fillProjectRequest(page);
    await page.getByRole("checkbox", { name: /J'accepte/ }).check();
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Vos réponses sont conservées" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer l'envoi" })).toBeVisible();
    await expect(page.getByLabel("Nom et prénom")).toHaveValue("Claire Martin");
  });
});

test.describe("Clos & Cadre API", () => {
  test("rejects an invalid payload with field errors", async ({ request }) => {
    const response = await request.post("/api/demonstrations/clos-et-cadre", { data: { projectType: "piscine" } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors.projectType).toBeDefined();
  });
});

test("the GC case study states that the demo is a concept", async ({ page }) => {
  await page.goto("/etudes-de-cas/clos-et-cadre");
  await expect(page.getByText("Projet conceptuel").first()).toBeVisible();
  await expect(page.getByText(/entreprise fictive/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Les objectifs" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ouvrir la démonstration/ })).toHaveAttribute("href", BASE);
});
