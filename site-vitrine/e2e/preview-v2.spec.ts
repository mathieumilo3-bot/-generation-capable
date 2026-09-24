import { expect, test, type Page } from "@playwright/test";

/**
 * GC Preview Engine V2 — isolated route, offline fixtures (see
 * src/lib/preview-engine/fixtures.ts): the real crawler, extractors,
 * validator and renderer run; only the network edges are simulated.
 */

test.describe.configure({ mode: "serial" });

async function acceptNothing(page: Page) {
  // Keep every dataLayer push across page loads so the whole funnel can be asserted.
  await page.addInitScript(() => {
    const layer: Record<string, unknown>[] = [];
    layer.push = (...items: Record<string, unknown>[]) => {
      const seen = JSON.parse(sessionStorage.getItem("e2e-events") || "[]");
      sessionStorage.setItem("e2e-events", JSON.stringify([...seen, ...items.map((i) => i.event)]));
      return Array.prototype.push.apply(layer, items);
    };
    (window as unknown as { dataLayer: unknown }).dataLayer = layer;
  });
  await page.goto("/audit/preview-v2?utm_source=google&utm_medium=cpc&utm_campaign=site_artisan&utm_content=preview_e2e&utm_term=couvreur");
  await page.evaluate(() => localStorage.setItem("gc-revenue-consent-v1", "refused"));
  await page.reload();
}

test("the V2 entry is private: noindex, single field, single h1", async ({ page }) => {
  const response = await page.goto("/audit/preview-v2");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Entrez le nom de votre entreprise" })).toBeVisible();
  await expect(page.locator("form input")).toHaveCount(1);
});

test("homonyms → city → honest wait → e-mail → preview → booking, then resume from the e-mail", async ({ page, request, browser }) => {
  test.setTimeout(120_000);
  await acceptNothing(page);
  await page.fill("#preview-company", "Toiture Martin");
  const submit = page.getByRole("button", { name: /Voir ce qu’on construirait/ });
  await submit.click();

  await expect(page.getByRole("heading", { name: "Dans quelle ville est votre entreprise ?" })).toBeVisible();
  await page.fill("#preview-city", "Vannes");
  await page.getByRole("button", { name: /Continuer/ }).click();

  await expect(page.getByRole("heading", { name: "On prépare votre nouvelle vitrine." })).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.fill("#preview-email", "artisan-e2e@example.com");
  await page.getByRole("button", { name: "Me l’envoyer" }).click();
  await expect(page.getByText("C’est noté. Vous pouvez fermer cette page.")).toBeVisible();

  const openPreview = page.getByRole("link", { name: "Voir ma nouvelle vitrine →" });
  await expect(openPreview).toBeVisible({ timeout: 90_000 });
  await openPreview.click();
  await page.waitForURL(/\/audit\/preview-v2\/vitrine#id=/, { timeout: 20_000 });
  const site = page.getByTestId("preview-site");
  await expect(site).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Voici ce que Toiture Martin pourrait devenir en ligne.");
  await expect(page.getByText("Voici comment nous ferions évoluer votre présence actuelle.")).toBeVisible();
  await expect(site.getByRole("heading", { name: "Couvreur à Vannes" })).toBeVisible();
  await expect(site.getByText("4,9/5")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);

  // Nothing invented reaches the page.
  const text = await site.innerText();
  expect(text).not.toMatch(/gratuit|24h|7j\/7|urgence|meilleur|n°\s?1/i);

  // CTAs inside the preview explain themselves instead of calling the artisan.
  await site.locator(".gcp-header .gcp-btn--primary").click();
  await expect(page.getByRole("status")).toContainText("Aperçu");

  const booking = page.getByTestId("preview-booking");
  await expect(booking).toHaveText("Construire cette version avec GC →");
  const href = (await booking.getAttribute("href")) ?? "";
  expect(href).toContain("calendly.com");
  expect(href).toContain("utm_source=google");
  expect(href).toContain("utm_campaign=site_artisan");
  expect(href).toContain("utm_content=preview_e2e");
  expect(href).toContain("utm_term=couvreur");

  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("e2e-events") || "[]") as string[]);
  expect(events).toEqual(expect.arrayContaining(["preview_generation_started", "preview_ready", "preview_viewed", "preview_cta_clicked"]));

  // The ready e-mail was sent once, with a link that reopens the preview directly.
  const outbox = await (await request.get("/api/preview/dev-outbox")).json();
  const mail = [...outbox.emails].reverse().find((e: { to: string }) => e.to === "artisan-e2e@example.com");
  expect(mail.subject).toBe("Votre nouvelle vitrine est prête — Toiture Martin");
  const link = new URL(mail.link);
  const fresh = await browser.newPage();
  await fresh.goto(`${link.pathname}${link.hash}`);
  await fresh.waitForURL(/\/audit\/preview-v2\/vitrine#id=/);
  await expect(fresh.getByTestId("preview-site")).toBeVisible();
  await fresh.close();
});

test("no site: a from-scratch storefront built only on verified identity", async ({ page }) => {
  test.setTimeout(120_000);
  await acceptNothing(page);
  await page.fill("#preview-company", "Atelier Sans Site");
  await page.getByRole("button", { name: /Voir ce qu’on construirait/ }).click();
  // First run asks for the missing site. A later browser/project may reuse the
  // verified cached preview and go straight to the explicit ready CTA.
  const siteQuestion = page.getByRole("heading", { name: "Quelle est l’adresse de votre site ?" });
  const readyLink = page.getByRole("link", { name: "Voir ma nouvelle vitrine →" });
  const questionOrReady = await Promise.race([
    siteQuestion.waitFor({ state: "visible", timeout: 30_000 }).then(() => "question" as const),
    readyLink.waitFor({ state: "visible", timeout: 30_000 }).then(() => "ready" as const),
  ]);
  if (questionOrReady === "question") {
    await page.getByRole("button", { name: "Je n’ai pas encore de site" }).click();
    await expect(readyLink).toBeVisible({ timeout: 90_000 });
  }
  await readyLink.click();
  await page.waitForURL(/vitrine#id=/, { timeout: 20_000 });
  await expect(page.getByText("Vous partez d’une page blanche. Voilà la base que nous construirions.")).toBeVisible();
  const site = page.getByTestId("preview-site");
  await expect(site.getByText("SIREN 222222222").first()).toBeVisible();
  await expect(site.locator("#gcp-realisations")).toHaveCount(0);
  await expect(site.getByText(/avis|étoiles/i)).toHaveCount(0);
});

for (const width of [375, 390, 430, 768, 1440]) {
  test(`visual QA at ${width}px: no overflow, no broken image, no empty section`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await acceptNothing(page);
    await page.fill("#preview-company", "Toiture Martin");
    await page.getByRole("button", { name: /Voir ce qu’on construirait/ }).click();
    await page.fill("#preview-city", "56000");
    await page.getByRole("button", { name: /Continuer/ }).click();
    const readyLink = page.getByRole("link", { name: "Voir ma nouvelle vitrine →" });
    await expect(readyLink).toBeVisible({ timeout: 90_000 });
    await readyLink.click();
    await page.waitForURL(/vitrine#id=/, { timeout: 20_000 });
    await expect(page.getByTestId("preview-site")).toBeVisible();
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForLoadState("networkidle");
    const report = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      broken: [...document.querySelectorAll<HTMLImageElement>(".gcp img")].filter((i) => i.complete && i.naturalWidth === 0).length,
      emptySections: [...document.querySelectorAll(".gcp section")].filter((s) => (s as HTMLElement).innerText.trim().length < 3).length,
      clipped: [...document.querySelectorAll(".gcp h2, .gcp h3, .gcp h4, .gcp .gcp-btn")].filter((el) => el.scrollWidth > el.clientWidth + 1).length,
      escaping: (() => {
        const root = document.querySelector(".gcp");
        if (!root) return 0;
        const edge = root.getBoundingClientRect();
        return [...root.querySelectorAll("*")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > edge.right + 1 || r.left < edge.left - 1);
        }).length;
      })(),
    }));
    expect(report).toEqual({ overflow: 0, broken: 0, emptySections: 0, clipped: 0, escaping: 0 });
    await info.attach(`preview-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}

test("a forged or unknown link never shows anyone's preview", async ({ page }) => {
  await page.goto(`/audit/preview-v2/vitrine#id=00000000-0000-4000-8000-000000000000&t=${"A".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Ce lien n’est plus valide." })).toBeVisible();
  const res = await page.request.post("/api/preview/result", { data: { id: "00000000-0000-4000-8000-000000000000", token: "x" } });
  expect(res.status()).toBe(400);
  const img = await page.request.get("/api/preview/image?u=aHR0cDovLzE2OS4yNTQuMTY5LjI1NA&s=" + "a".repeat(32));
  expect(img.status()).toBe(403);
});
