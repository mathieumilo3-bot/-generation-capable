import { expect, test, type Page } from "@playwright/test";

async function fillStepOne(page: Page, url = "https://exemple-restaurant.fr") {
  await page.getByLabel("Votre site").fill(url);
}

async function completeToStepFour(page: Page) {
  await fillStepOne(page);
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Restaurants", exact: true }).click();
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Plus de rendez-vous" }).click();
  await page.getByRole("button", { name: /Continuer/ }).click();
  await expect(page.getByRole("heading", { name: "Vos coordonnées" })).toBeVisible();
}

test.describe("Capable Audit funnel", () => {
  test.beforeEach(async ({ page }) => {
    // These tests cover the funnel's behaviour, so the endpoint is stubbed:
    // hitting the real one would consume its rate-limit budget and make the
    // suite order-dependent. The endpoint itself is covered in audit-api.spec.
    await page.route("**/api/audit", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "received", emailed: true }),
      })
    );
    await page.goto("/audit");
  });

  test("walks through all four steps and confirms", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/audit")) requests.push(req.postData() ?? "");
    });

    await completeToStepFour(page);
    await page.getByLabel("Nom complet").fill("Marie Dupont");
    await page.getByLabel("Entreprise").fill("Le Bistrot");
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByLabel("Téléphone").fill("0600000000");

    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(
      page.getByRole("heading", { name: "Votre analyse est en préparation." })
    ).toBeVisible();

    // Exactly one submission, carrying every answer.
    expect(requests).toHaveLength(1);
    const payload = JSON.parse(requests[0]);
    expect(payload).toMatchObject({
      siteUrl: "https://exemple-restaurant.fr",
      secteur: "Restaurants",
      objectif: "Plus de rendez-vous",
      nom: "Marie Dupont",
      email: "marie@exemple.fr",
    });
  });

  test("does not submit while advancing between steps", async ({ page }) => {
    // Regression: the Continuer button used to reuse the submit button's DOM
    // node, firing a submit with empty fields on the way to step 4.
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/audit")) requests.push(req.url());
    });

    await completeToStepFour(page);
    expect(requests).toHaveLength(0);
  });

  test("Enter on the first step advances instead of submitting", async ({ page }) => {
    // Regression: a single-field form submits implicitly on Enter.
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/audit")) requests.push(req.url());
    });

    await fillStepOne(page);
    await page.getByLabel("Votre site").press("Enter");

    await expect(page.getByRole("heading", { name: "Votre activité" })).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("asks what \"Autre\" means and sends it with the answer", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/audit")) requests.push(req.postData() ?? "");
    });

    await fillStepOne(page);
    await page.getByRole("button", { name: /Continuer/ }).click();

    await page.getByRole("button", { name: "Autre", exact: true }).click();
    // "Autre" alone says nothing, so the step stays blocked until specified.
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeDisabled();
    await page.getByLabel("Précisez votre secteur").fill("Toiletteur canin");
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeEnabled();
    await page.getByRole("button", { name: /Continuer/ }).click();

    await page.getByRole("button", { name: "Autre", exact: true }).click();
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeDisabled();
    await page.getByLabel("Précisez votre objectif").fill("Recruter des franchisés");
    await page.getByRole("button", { name: /Continuer/ }).click();

    await page.getByLabel("Nom complet").fill("Marie");
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(
      page.getByRole("heading", { name: "Votre analyse est en préparation." })
    ).toBeVisible();

    const payload = JSON.parse(requests[0]);
    expect(payload.secteur).toBe("Autre — Toiletteur canin");
    expect(payload.objectif).toBe("Autre — Recruter des franchisés");
  });

  test("blocks advancing until the step is answered", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeDisabled();
    await fillStepOne(page);
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeEnabled();
  });

  test("keeps answers when navigating back", async ({ page }) => {
    await fillStepOne(page, "https://mon-site.fr");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await page.getByRole("button", { name: "Restaurants", exact: true }).click();
    await page.getByRole("button", { name: /Retour/ }).click();

    await expect(page.getByLabel("Votre site")).toHaveValue("https://mon-site.fr");
  });

  test("reports the step in an accessible progress bar", async ({ page }) => {
    const progress = page.getByRole("progressbar");
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
    await fillStepOne(page);
    await page.getByRole("button", { name: /Continuer/ }).click();
    await expect(progress).toHaveAttribute("aria-valuenow", "2");
  });

  test("shows an actionable error when the submission fails", async ({ page }) => {
    await page.route("**/api/audit", (route) =>
      route.fulfill({ status: 502, body: JSON.stringify({ error: "email_failed" }) })
    );

    await completeToStepFour(page);
    await page.getByLabel("Nom complet").fill("Marie");
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.locator('form [role="alert"]')).toContainText("n'a pas pu être envoyée");
    // The visitor keeps their answers and can retry.
    await expect(page.getByLabel("Nom complet")).toHaveValue("Marie");
    await expect(page.getByRole("button", { name: /Obtenir mon audit/ })).toBeEnabled();
  });

  test("explains a rate-limited submission differently", async ({ page }) => {
    await page.route("**/api/audit", (route) =>
      route.fulfill({ status: 429, body: JSON.stringify({ error: "rate_limited" }) })
    );

    await completeToStepFour(page);
    await page.getByLabel("Nom complet").fill("Marie");
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");
    await page.getByRole("button", { name: /Obtenir mon audit/ }).click();

    await expect(page.locator('form [role="alert"]')).toContainText("Trop de demandes");
  });

  test("submits only once when the button is clicked repeatedly", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/audit", async (route) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ status: 200, body: JSON.stringify({ status: "received" }) });
    });

    await completeToStepFour(page);
    await page.getByLabel("Nom complet").fill("Marie");
    await page.getByLabel("Email", { exact: true }).fill("marie@exemple.fr");

    // Fire the clicks together, the way an impatient visitor double-clicks.
    // The follow-ups are capped and allowed to fail: once the first submit
    // lands, the button is disabled and then replaced by the confirmation.
    const submit = page.getByRole("button", { name: /Obtenir mon audit/ });
    await Promise.allSettled([
      submit.click({ timeout: 5000 }),
      submit.click({ force: true, timeout: 1000 }),
      submit.click({ force: true, timeout: 1000 }),
    ]);

    await expect(
      page.getByRole("heading", { name: "Votre analyse est en préparation." })
    ).toBeVisible();
    expect(calls).toBe(1);
  });
});
