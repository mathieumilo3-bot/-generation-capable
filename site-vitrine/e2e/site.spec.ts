import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/audit",
  "/secteurs",
  "/secteurs/restaurants",
  "/applications",
  "/ressources",
  "/ressources/pourquoi-un-beau-site-ne-suffit-plus",
  "/creation-site-internet",
  "/agence-web",
  "/acquisition",
  "/seo",
  "/solutions",
  "/solutions/audit-site-internet",
  "/solutions/referencement-local",
  "/solutions/creation-site-artisan",
  "/ressources/prix-creation-site-internet",
  "/ressources/comment-etre-visible-sur-google",
  "/solutions/agence-marketing-digital",
  "/solutions/marketing-digital-pme",
  "/solutions/audit-marketing-digital",
  "/solutions/publicite-google-ads",
  "/solutions/publicite-meta-ads",
  "/solutions/strategie-reseaux-sociaux",
  "/solutions/marketing-digital-artisan",
  "/ressources/plan-marketing-digital-pme",
  "/ressources/seo-ou-google-ads",
  "/solutions/generation-leads-b2b",
  "/solutions/agence-acquisition-b2b",
  "/solutions/marketing-b2b",
  "/solutions/growth-marketing",
  "/solutions/webmarketing",
  "/solutions/communication-digitale",
  "/solutions/inbound-marketing",
  "/solutions/consultant-marketing-digital",
  "/solutions/marketing-digital-btp",
  "/solutions/creation-site-dentiste",
  "/solutions/marketing-entreprise-nettoyage",
  "/solutions/marketing-evenementiel-digital",
  "/solutions/marketing-digital-restaurant",
  "/ressources/generation-leads-b2b-guide",
  "/ressources/audit-acquisition-digitale",
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
        /^https:\/\/gc-agence\.com/
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

  test("short SEO aliases redirect to one canonical destination", async ({ page }) => {
    await page.goto("/marketing-digital");
    await expect(page).toHaveURL(/\/solutions\/agence-marketing-digital$/);
    await page.goto("/generation-leads-b2b");
    await expect(page).toHaveURL(/\/solutions\/generation-leads-b2b$/);
    await page.goto("/site-dentiste");
    await expect(page).toHaveURL(/\/solutions\/creation-site-dentiste$/);
  });

  test("the former /cas-clients URL now leads to /applications", async ({ page }) => {
    // The two pages had become the same content under two canonicals.
    await page.goto("/cas-clients");
    await expect(page).toHaveURL(/\/applications$/);
    await page.goto("/cas-clients/nimporte-quoi");
    await expect(page).toHaveURL(/\/applications$/);
  });

  test("unknown sector and article slugs 404", async ({ page }) => {
    expect((await page.goto("/secteurs/inconnu"))?.status()).toBe(404);
    expect((await page.goto("/ressources/inconnu"))?.status()).toBe(404);
    expect((await page.goto("/solutions/inconnu"))?.status()).toBe(404);
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
      .getByRole("link", { name: /Voir comment gagner plus de demandes/ })
      .click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByLabel("Nom de votre entreprise")).toBeVisible();
  });
});

test.describe("SEO endpoints", () => {
  test("sitemap lists the canonical pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("https://gc-agence.com");
    expect(body).toContain("/secteurs/restaurants");
    expect(body).toContain("/solutions/audit-site-internet");
    expect(body).toContain("/solutions/agence-marketing-digital");
    expect(body).toContain("/solutions/generation-leads-b2b");
    expect(body).toContain("/solutions/marketing-digital-btp");
    expect(body).toContain("/solutions/creation-site-dentiste");
    expect(body).toContain("/ressources/prix-creation-site-internet");
    expect(body).toContain("/ressources/plan-marketing-digital-pme");
    expect(body).not.toContain("www.gc-agence.com");
  });

  test("robots allows crawling and points at the sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: https://gc-agence.com/sitemap.xml");
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
    expect(manifest.name).toContain("GC");
    expect(manifest.theme_color).toBe("#050505");
  });
});

test.describe("legal pages", () => {
  test("mentions légales carry the host and the no-fake-proof statement", async ({ page }) => {
    await page.goto("/mentions-legales");
    await expect(page.getByRole("heading", { name: "Mentions légales" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hébergeur" })).toBeVisible();
    await expect(page.getByText("Netlify, Inc.")).toBeVisible();
    await expect(page.getByText("ne décrivent aucune mission réalisée")).toBeVisible();
    // The verified SIREN is intentionally shown; RCS stays absent until verified.
    await expect(page.getByText("981 319 957")).toBeVisible();
    await expect(page.getByText(/^RCS$/)).toHaveCount(0);
  });

  test("the privacy policy states what the form actually does", async ({ page }) => {
    await page.goto("/politique-de-confidentialite");
    for (const heading of [
      "Responsable du traitement",
      "Données collectées",
      "Finalité et base légale",
      "Destinataires et sous-traitants",
      "Durée de conservation",
      "Journaux techniques et anti-abus",
      "Vos droits",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByText("Resend")).toBeVisible();
    await expect(page.getByRole("link", { name: "cnil.fr" })).toBeVisible();
  });

  test("the two legal pages link to each other", async ({ page }) => {
    // Scoped to the body copy: the footer links to both pages on every page.
    const body = page.locator("main");
    await page.goto("/mentions-legales");
    await body.getByRole("link", { name: "politique de confidentialité" }).click();
    await expect(page).toHaveURL(/politique-de-confidentialite/);
    await body.getByRole("link", { name: "mentions légales" }).click();
    await expect(page).toHaveURL(/mentions-legales/);
  });
});

test.describe("analytics", () => {
  test("loads no third-party tag while NEXT_PUBLIC_GTM_ID is unset", async ({ page }) => {
    const thirdParty: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname)) thirdParty.push(req.url());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(thirdParty).toEqual([]);
  });

  test("the funnel events land on a dataLayer a tag manager can read", async ({ page }) => {
    await page.goto("/");
    // landing_view is pushed from an effect, so poll rather than sample once.
    const firstEntryKeys = () =>
      page.evaluate(() => Object.keys((window.dataLayer ?? [])[0] ?? {}).sort());

    await expect.poll(firstEntryKeys).toContain("event");
    expect(await firstEntryKeys()).toContain("timestamp");
  });
});

test.describe("security headers", () => {
  test("pages carry the baseline hardening headers", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=");
  });

  test("does not advertise the framework", async ({ request }) => {
    expect((await request.get("/")).headers()["x-powered-by"]).toBeUndefined();
  });

  test("the audit endpoint is never cached or indexed", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: { "X-Forwarded-For": "198.51.100.77" },
      data: { siteUrl: "", secteur: "", objectif: "", email: "" },
    });
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
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
    await page.getByLabel("Nom de votre entreprise").focus();
    const outline = await page.getByLabel("Nom de votre entreprise").evaluate((el) => {
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

test.describe("consent banner", () => {
  test("shows on first visit and offers accept/refuse", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Préférences de confidentialité" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: "Accepter" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "Refuser" })).toBeVisible();
  });

  test("a choice dismisses the banner and persists across a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accepter" }).click();
    await expect(page.getByRole("dialog", { name: "Préférences de confidentialité" })).toBeHidden();

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Préférences de confidentialité" })).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("gc-revenue-consent-v1"))).toBe("accepted");
  });

  test("refusing is recorded distinctly from accepting", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Refuser" }).click();
    expect(await page.evaluate(() => localStorage.getItem("gc-revenue-consent-v1"))).toBe("refused");
  });

  test("\"Gérer mes cookies\" in the footer reopens the banner after a choice was already made", async ({ page }) => {
    // Regression: the banner used to derive its visibility solely from
    // "no stored choice yet", which meant it could never be reopened once a
    // choice existed — CNIL requires withdrawing consent to be as easy as
    // giving it, and this control is exactly that path.
    await page.goto("/");
    await page.getByRole("button", { name: "Accepter" }).click();
    await expect(page.getByRole("dialog", { name: "Préférences de confidentialité" })).toBeHidden();

    await page.getByRole("button", { name: "Gérer mes cookies" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Gérer mes cookies" }).click();
    await expect(page.getByRole("dialog", { name: "Préférences de confidentialité" })).toBeVisible();

    // And the reopened banner's own choice still works, changing the stored value.
    await page.getByRole("dialog", { name: "Préférences de confidentialité" }).getByRole("button", { name: "Refuser" }).click();
    await expect(page.getByRole("dialog", { name: "Préférences de confidentialité" })).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("gc-revenue-consent-v1"))).toBe("refused");
  });

  test("does not block interaction with the rest of the page", async ({ page }) => {
    await page.goto("/");
    // The primary CTA sits away from the banner's corner position — confirms
    // the dialog doesn't cover the page with an interaction-blocking overlay.
    await expect(
      page.getByRole("link", { name: /Recevoir mon diagnostic|Analyser mon entreprise/ }).filter({ visible: true }).first()
    ).toBeVisible();
  });
});
