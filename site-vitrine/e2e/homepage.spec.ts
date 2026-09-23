import { expect, test, type Page } from "@playwright/test";

async function events(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) => String((entry as { event?: unknown }).event))
  );
}

async function runInstantCheck(page: Page, company = "Dupont Couverture") {
  await page.fill("#instant-check-company", company);
  await page.getByRole("button", { name: /Retrouver mon entreprise/ }).click();
  await expect(page.getByText("On retrouve d’abord votre entreprise.")).toBeVisible();
}

test.describe("homepage", () => {
  test("opens on the current artisan promise", async ({ page }) => {
    await page.goto("/");
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toContainText("Votre savoir-faire mérite");
    await expect(hero).toContainText("plus de demandes de devis.");
    await expect(page.getByRole("link", { name: /Voir comment gagner plus de demandes/ })).toHaveAttribute("href", "/audit");
    await expect(page.getByRole("link", { name: /Voir un avant \/ après/ })).toHaveAttribute("href", "#demonstration");
  });

  test("keeps the key commercial sections in order", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2")].map((h) => h.textContent?.replace(/\s+/g, " ").trim())
    );
    const expected = [
      "Votre savoir-faire mérite",
      "Même savoir-faire.",
      "Découvrez où gagner",
      "Un bon site artisan",
      "Faisons en sorte",
    ];
    const positions = expected.map((needle) => order.findIndex((h) => h?.includes(needle)));
    expect(positions, `outline was: ${order.join(" | ")}`).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("offers an accessible before and after comparison", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("group", { name: "Comparer avant et après" });
    await expect(group.getByRole("button", { name: "Après GC" })).toHaveAttribute("aria-pressed", "true");
    await group.getByRole("button", { name: "Avant" }).click();
    await expect(group.getByRole("button", { name: "Avant" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("instant check", () => {
  test("stays inert until a company name is given", async ({ page }) => {
    await page.goto("/");
    const launch = page.getByRole("button", { name: /Retrouver mon entreprise/ });
    await expect(launch).toBeDisabled();
    await page.fill("#instant-check-company", "Dupont Couverture");
    await expect(launch).toBeEnabled();
  });

  test("reveals the four artisan diagnostic axes", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    const result = page.locator("#analyse");
    for (const axis of ["ÊTRE TROUVÉ", "RASSURER", "DEVIS", "RELANCER"]) {
      await expect(result.getByText(axis, { exact: true })).toBeVisible();
    }
  });

  test("hands the company name to the audit funnel", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    await page.locator("#analyse").getByRole("link", { name: /Lancer mon diagnostic/ }).click();
    await expect(page).toHaveURL(/\/audit\?entreprise=/);
    await expect(page.getByLabel("Nom de votre entreprise")).toHaveValue("Dupont Couverture");
  });

  test("can be run again", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    await page.getByRole("button", { name: "Recommencer" }).click();
    await expect(page.getByText("On retrouve d’abord votre entreprise.")).toBeHidden();
    await expect(page.getByRole("button", { name: /Retrouver mon entreprise/ })).toBeEnabled();
  });
});

test.describe("tracking", () => {
  test("records landing and hero intent", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => events(page)).toContain("landing_view");
    await page.getByRole("link", { name: /Voir comment gagner plus de demandes/ }).click();
    await expect(page).toHaveURL(/\/audit$/);
  });

  test("records the instant check", async ({ page }) => {
    await page.goto("/");
    await runInstantCheck(page);
    expect(await events(page)).toContain("instant_check_started");
  });
});
