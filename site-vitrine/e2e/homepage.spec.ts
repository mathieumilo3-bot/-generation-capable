import { expect, test, type Page } from "@playwright/test";

/** The dataLayer is the only place tracking lands, so it is the only place to assert. */
async function events(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) => String((entry as { event?: unknown }).event))
  );
}

async function runInstantCheck(page: Page, url = "https://mon-restaurant.fr") {
  await page.fill("#instant-check-url", url);
  await page.getByRole("button", { name: /Lancer l'analyse/ }).click();
  await expect(page.getByText("Démonstration.")).toBeVisible({ timeout: 15000 });
}

test.describe("homepage sequence", () => {
  test("opens on the promise and the two entry points", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("travailler plus dur.");
    await expect(
      page.getByRole("link", { name: /Analyser mon entreprise/ }).filter({ visible: true }).first()
    ).toHaveAttribute("href", "/audit");
    await expect(page.getByRole("link", { name: "Voir comment ça fonctionne" })).toHaveAttribute(
      "href",
      "#analyse"
    );
  });

  test("runs the seven sequences in order", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2")].map((h) => h.textContent?.replace(/\s+/g, " ").trim())
    );

    // Hero → outil/diagnostic → recommandation → système → méthode →
    // systèmes → applications → CTA. The argument only holds in this order.
    const expected = [
      "travailler plus dur",
      "Voyons ce que votre présence",
      "comprise trop tard",
      "Nous ne construisons pas",
      "Une méthode.",
      "Quatre systèmes.",
      "À quoi ressemble",
      "commençait enfin",
    ];
    const positions = expected.map((needle) => order.findIndex((h) => h?.includes(needle)));
    expect(positions, `outline was: ${order.join(" | ")}`).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions[0]).toBe(0);
    expect(positions.at(-1)).toBe(order.length - 1);
  });

  test("the nav is reduced to the four product entries", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const labels = await page
      .locator("header nav a")
      .filter({ visible: true })
      .allTextContents();
    expect(labels).toEqual(["Méthode", "Systèmes", "Secteurs", "Applications"]);
  });
});

test.describe("instant check", () => {
  test("stays inert until a site is given", async ({ page }) => {
    await page.goto("/");
    const launch = page.getByRole("button", { name: /Lancer l'analyse/ });
    await expect(launch).toBeDisabled();
    await page.fill("#instant-check-url", "https://mon-restaurant.fr");
    await expect(launch).toBeEnabled();
  });

  test("plays the analysis and restitutes four axes", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);

    for (const axis of ["Visibilité", "Clarté", "Confiance", "Conversion"]) {
      await expect(page.getByText(axis, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Le problème n'est pas toujours votre trafic.")).toBeVisible();
  });

  test("labels the restitution as a demonstration, never as a measurement", async ({ page }) => {
    // Section 18 of the brief: nothing on this site may read as a real result.
    await page.goto("/");
    await runInstantCheck(page);

    await expect(
      page.getByText("les valeurs ci-dessous sont un exemple, pas une mesure de votre site")
    ).toBeVisible();
    await expect(page.getByText("Nous ne publions aucun score automatique.")).toBeVisible();
  });

  test("hands the URL over to the real funnel", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page, "https://mon-restaurant.fr");

    await page.getByRole("link", { name: /Obtenir l'analyse de mon site/ }).click();
    await expect(page).toHaveURL(/\/audit\?site=/);
    await expect(page.getByLabel("Votre site")).toHaveValue("https://mon-restaurant.fr");
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeEnabled();
  });

  test("can be run again", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    await page.getByRole("button", { name: "Recommencer" }).click();
    await expect(page.getByText("Démonstration.")).toBeHidden();
    await expect(page.getByRole("button", { name: /Lancer l'analyse/ })).toBeEnabled();
  });
});

test.describe("tracking", () => {
  test("records the landing and the hero intent", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => events(page)).toContain("landing_view");

    await page
      .getByRole("link", { name: /Analyser mon entreprise/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/audit$/);
  });

  test("records the instant check from start to restitution", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    const fired = await events(page);
    expect(fired).toContain("instant_check_started");
    expect(fired).toContain("instant_check_completed");
  });

  test("records each step of the funnel", async ({ page }) => {
    await page.goto("/audit");
    await page.getByLabel("Votre site").fill("https://exemple.fr");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await page.getByRole("button", { name: "Restaurants", exact: true }).click();
    await page.getByRole("button", { name: /Continuer/ }).click();

    const fired = await events(page);
    expect(fired).toContain("audit_started");
    expect(fired).toContain("audit_step_2");
    expect(fired).toContain("audit_step_3");
  });
});
