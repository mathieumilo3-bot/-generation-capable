import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/audit",
  "/secteurs",
  "/secteurs/restaurants",
  "/cas-clients",
  "/ressources",
  "/ressources/pourquoi-un-beau-site-ne-suffit-plus",
  "/creation-site-internet",
  "/agence-web",
  "/acquisition",
  "/seo",
];

test.describe("pages", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders with one h1, a title and a canonical`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page).toHaveTitle(/.+/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /^https:\/\/generationcapable\.fr/
      );
      expect(errors).toEqual([]);
    });
  }

  test("unknown routes return a branded 404", async ({ page }) => {
    const response = await page.goto("/cette-page-nexiste-pas");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /Cette page n'existe pas/ })).toBeVisible();
    // The dead end still offers the primary action.
    await expect(
      page.getByRole("link", { name: /Analyser mon entreprise/ }).filter({ visible: true }).first()
    ).toBeVisible();
  });

  test("unknown sector and article slugs 404", async ({ page }) => {
    expect((await page.goto("/secteurs/inconnu"))?.status()).toBe(404);
    expect((await page.goto("/ressources/inconnu"))?.status()).toBe(404);
  });
});

test.describe("navigation", () => {
  test("every internal link resolves", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")!)
    );
    const unique = [...new Set(hrefs.map((h) => h.split("#")[0] || "/"))];

    for (const href of unique) {
      const response = await request.get(href);
      expect(response.status(), `${href} should resolve`).toBeLessThan(400);
    }
  });

  test("the primary CTA leads to the audit funnel", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /Analyser mon entreprise/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole("heading", { name: "Votre site" })).toBeVisible();
  });
});

test.describe("SEO endpoints", () => {
  test("sitemap lists the canonical pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("https://generationcapable.fr");
    expect(body).toContain("/secteurs/restaurants");
    expect(body).not.toContain("www.generationcapable.fr");
  });

  test("robots allows crawling and points at the sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: https://generationcapable.fr/sitemap.xml");
  });

  test("legal pages stay out of the index", async ({ page }) => {
    await page.goto("/mentions-legales");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("serves a branded icon and a manifest", async ({ request }) => {
    const icon = await request.get("/icon");
    expect(icon.status()).toBe(200);
    expect(icon.headers()["content-type"]).toContain("image/png");

    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toContain("Génération Capable");
    expect(manifest.theme_color).toBe("#050505");
  });
});

test.describe("accessibility", () => {
  test("a skip link is the first stop for keyboard users", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveText("Aller au contenu principal");
    await expect(focused).toBeVisible();
  });

  test("no page relies on colour alone for its focus ring", async ({ page }) => {
    await page.goto("/audit");
    await page.getByLabel("Votre site").focus();
    const outline = await page.getByLabel("Votre site").evaluate((el) => {
      const style = getComputedStyle(el);
      return { border: style.borderColor, shadow: style.boxShadow };
    });
    // Focus changes the border colour and adds a ring.
    expect(outline.shadow).not.toBe("none");
  });
});

test.describe("responsive", () => {
  for (const width of [360, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
    });
  }
});
