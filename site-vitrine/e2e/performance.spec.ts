import { expect, test } from "@playwright/test";

/**
 * Guards the Core Web Vitals budget from the brief (CLS < 0.1).
 *
 * The regression this exists for: with `font-display: swap`, the oversized
 * hero headline re-wrapped when the brand font arrived and dragged the page
 * up — 0.21 CLS on a throttled phone. Layout stability does not depend on
 * bundle size, so this is meaningful against the dev server too.
 */
test.describe("Core Web Vitals", () => {
  for (const route of ["/", "/audit", "/secteurs"]) {
    test(`${route} stays within the CLS budget on a throttled phone`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.skip(browserName !== "chromium", "CDP throttling is Chromium-only");

      const client = await page.context().newCDPSession(page);
      await client.send("Network.enable");
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.setViewportSize({ width: 412, height: 915 });

      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) {
              (window as unknown as { __cls: number }).__cls += entry.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      });

      await page.goto(route, { waitUntil: "load" });
      // Long enough for fonts and any deferred work to settle.
      await page.waitForTimeout(4000);

      const cls = await page.evaluate(
        () => (window as unknown as { __cls: number }).__cls
      );
      testInfo.annotations.push({ type: "CLS", description: cls.toFixed(4) });
      expect(cls).toBeLessThan(0.1);
    });
  }
});
