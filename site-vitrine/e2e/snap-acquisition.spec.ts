import { expect, test } from "@playwright/test";

test.describe("Snapchat acquisition landing", () => {
  test("keeps Snapchat attribution on audit and booking paths", async ({ page }) => {
    const response = await page.goto("/snap");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Votre présence en ligne doit produire"
    );

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/i);

    const auditLink = page
      .getByRole("link", { name: /Recevoir mon diagnostic|Analyser mon entreprise/ })
      .first();
    const auditHref = await auditLink.getAttribute("href");
    expect(auditHref).toContain("/audit?");
    expect(auditHref).toContain("utm_source=snapchat");
    expect(auditHref).toContain("utm_medium=paid_social");
    expect(auditHref).toContain("utm_campaign=snap_prospecting");

    const booking = page.getByRole("link", { name: /Réserver 30 min/ }).first();
    const bookingHref = await booking.getAttribute("href");
    expect(bookingHref).toContain(
      "calendly.com/ledorvenenzo50/consultation-strategique-acquisition-developpement"
    );
    expect(bookingHref).toContain("utm_source=snapchat");
    expect(bookingHref).toContain("utm_campaign=snap_prospecting");
  });
});
