import { expect, test, type Page } from "@playwright/test";

async function events(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) => String((entry as { event?: unknown }).event))
  );
}

async function runInstantCheck(page: Page, url = "https://mon-restaurant.fr") {
  await page.fill("#instant-check-url", url);
  await page.getByRole("button", { name: /Voir ce que nous analysons/ }).click();
  await expect(page.getByText("Votre site est le point de départ.")).toBeVisible();
}

test.describe("homepage", () => {
  test("opens on the current commercial promise", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Votre visibilité attire des gens.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Votre système doit les convertir.");
    await expect(page.getByRole("link", { name: /Recevoir mon diagnostic/ }).first()).toHaveAttribute("href", "/audit");
    await expect(page.getByRole("link", { name: "Voir le système" })).toHaveAttribute("href", "#systeme");
  });

  test("keeps the commercial sections in the intended order", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2")].map((h) => h.textContent?.replace(/\s+/g, " ").trim())
    );
    const expected = [
      "Votre visibilité attire des gens.",
      "Votre proposition est",
      "Voyez où votre entreprise",
      "Voici ce que votre prospect",
      "Nous ne construisons pas",
      "Quatre systèmes.",
      "Avant de nous parler.",
      "commençait enfin",
    ];
    const positions = expected.map((needle) => order.findIndex((h) => h?.includes(needle)));
    expect(positions, `outline was: ${order.join(" | ")}`).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

test.describe("instant check", () => {
  test("stays inert until a site is given", async ({ page }) => {
    await page.goto("/");
    const launch = page.getByRole("button", { name: /Voir ce que nous analysons/ });
    await expect(launch).toBeDisabled();
    await page.fill("#instant-check-url", "https://mon-restaurant.fr");
    await expect(launch).toBeEnabled();
  });

  test("reveals the four diagnostic axes", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    const result = page.locator("#analyse");
    for (const axis of ["ATTIRER", "COMPRENDRE", "CONVAINCRE", "CONVERTIR"]) {
      await expect(result.getByText(axis, { exact: true }).first()).toBeVisible();
    }
  });

  test("hands the URL to the real audit funnel", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    await page.locator("#analyse").getByRole("link", { name: /Recevoir mon diagnostic/ }).click();
    await expect(page).toHaveURL(/\/audit\?site=/);
    await expect(page.getByLabel("Votre site")).toHaveValue("https://mon-restaurant.fr");
  });

  test("can be run again", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    await page.getByRole("button", { name: "Recommencer" }).click();
    await expect(page.getByText("Votre site est le point de départ.")).toBeHidden();
    await expect(page.getByRole("button", { name: /Voir ce que nous analysons/ })).toBeEnabled();
  });
});

test.describe("tracking", () => {
  test("records landing and hero intent", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => events(page)).toContain("landing_view");
    await page.getByRole("link", { name: /Recevoir mon diagnostic/ }).first().click();
    await expect(page).toHaveURL(/\/audit$/);
  });

  test("records the instant check", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    const fired = await events(page);
    expect(fired).toContain("instant_check_started");
  });

  test("records funnel steps", async ({ page }) => {
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
