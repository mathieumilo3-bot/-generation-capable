import { expect, test, type Page } from "@playwright/test";

async function events(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) => String((entry as { event?: unknown }).event))
  );
}

test.describe("homepage", () => {
  test("opens on the simplified commercial promise", async ({ page }) => {
    await page.goto("/");
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toContainText("Un site clair.");
    await expect(hero).toContainText("Un parcours qui donne envie d’agir.");
    await expect(page.getByRole("link", { name: /Analyser mon site gratuitement/ }).first()).toHaveAttribute("href", "/audit");
    await expect(page.getByRole("link", { name: /Voir un exemple avant \/ après/ })).toHaveAttribute("href", "#demonstration");
  });

  test("keeps a normal commercial structure in order", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2")].map((h) => h.textContent?.replace(/\s+/g, " ").trim())
    );
    const expected = [
      "Un site clair.",
      "Trois choses.",
      "Une méthode normale",
      "Même savoir-faire.",
      "Du concret avant tout.",
      "Voyons ce qui bloque",
    ];
    const positions = expected.map((needle) => order.findIndex((h) => h?.includes(needle)));
    expect(positions, `outline was: ${order.join(" | ")}`).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("shows exactly three core service blocks", async ({ page }) => {
    await page.goto("/");
    const services = page.locator("#services article");
    await expect(services).toHaveCount(3);
    await expect(services.nth(0)).toContainText("Un site qui explique vite");
    await expect(services.nth(1)).toContainText("Être trouvé au bon moment");
    await expect(services.nth(2)).toContainText("Transformer en demandes");
  });

  test("offers an accessible before and after comparison", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("group", { name: "Comparer avant et après" });
    await expect(group.getByRole("button", { name: "Après GC" })).toHaveAttribute("aria-pressed", "true");
    await group.getByRole("button", { name: "Avant" }).click();
    await expect(group.getByRole("button", { name: "Avant" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("tracking", () => {
  test("records landing and hero intent", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => events(page)).toContain("landing_view");
    await page.getByRole("link", { name: /Analyser mon site gratuitement/ }).first().click();
    await expect(page).toHaveURL(/\/audit$/);
  });
});
