import { expect, test } from "@playwright/test";

test.describe("review collection", () => {
  test("review page is shareable, honest and noindex", async ({ page }) => {
    const response = await page.goto("/avis");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Votre avis nous aide"
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
    await expect(page.getByText(/réellement travaillé avec GC Agence/)).toBeVisible();
    await expect(page.getByRole("button", { name: "5 étoiles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer mon avis" })).toBeVisible();
  });

  test("rating is required before submission", async ({ page }) => {
    await page.goto("/avis");

    await page.getByLabel("Nom *").fill("Client test");
    await page.getByLabel("Email *").fill("client@example.com");
    await page.getByLabel("Ce que vous avez fait avec GC *").selectOption("Audit / diagnostic");
    await page.getByLabel("Votre avis *").fill(
      "Retour de test suffisamment long pour vérifier la validation du formulaire."
    );
    await page.getByRole("button", { name: "Envoyer mon avis" }).click();

    await expect(page.getByText("Choisissez une note avant d'envoyer.")).toBeVisible();
  });
});
