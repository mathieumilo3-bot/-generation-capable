import { expect, test } from "@playwright/test";

const COMMERCIAL_PAGES = [
  {
    route: "/creation-site-internet",
    h1: /Création de site internet pour artisans et PME/,
  },
  {
    route: "/seo",
    h1: /Agence SEO pour PME/,
  },
  {
    route: "/solutions/referencement-local",
    h1: /Agence SEO local/,
  },
  {
    route: "/solutions/marketing-digital-btp",
    h1: /Agence marketing digital BTP/,
  },
  {
    route: "/solutions/audit-seo",
    h1: /Audit SEO : savoir quoi corriger en premier/,
  },
  {
    route: "/solutions/google-business-profile",
    h1: /Google Business Profile : transformer votre présence locale/,
  },
  {
    route: "/solutions/generation-de-leads",
    h1: /Agence de génération de leads : transformer l'acquisition/,
  },
  {
    route: "/solutions/publicite-google-ads",
    h1: /Agence Google Ads pour PME/,
  },
  {
    route: "/solutions/generation-leads-b2b",
    h1: /Agence de génération de leads B2B/,
  },
];

test.describe("commercial SEO landing pages", () => {
  for (const item of COMMERCIAL_PAGES) {
    test(`${item.route} connects search intent to a real conversion path`, async ({ page }) => {
      const response = await page.goto(item.route);
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.h1);
      expect(await page.title()).not.toMatch(/GC Agence.*GC Agence/);

      const booking = page
        .getByRole("link", { name: /Réserver (un échange de )?30 min/ })
        .first();
      await expect(booking).toBeVisible();
      await expect(booking).toHaveAttribute(
        "href",
        /calendly\.com\/ledorvenenzo50\/consultation-strategique-acquisition-developpement/
      );

      await expect(
        page.getByRole("link", { name: /Recevoir mon diagnostic|Analyser mon entreprise/ }).first()
      ).toBeVisible();
    });
  }

  test("targeted commercial landings state the verification-before-results rule", async ({ page }) => {
    for (const route of [
      "/solutions/referencement-local",
      "/solutions/marketing-digital-btp",
      "/solutions/audit-seo",
      "/solutions/google-business-profile",
      "/solutions/generation-de-leads",
      "/solutions/publicite-google-ads",
      "/solutions/generation-leads-b2b",
    ]) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Une méthode vérifiable avant de parler de résultats" })
      ).toBeVisible();
    }
  });

  test("Google Search Console verification remains present", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator('meta[name="google-site-verification"]').first()
    ).toHaveAttribute(
      "content",
      "kmVznlRy43naB6-mRbECpbiug4IUY521LzKGd2Mnb_g"
    );
  });
});
