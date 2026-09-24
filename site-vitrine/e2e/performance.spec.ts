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
  // CDP's CPU throttle is relative to whatever the host is actually doing at
  // that instant: on a shared CI runner (or a busy dev box) real background
  // load stacks with the emulated 4x rate and can push a perfectly stable
  // page over budget for one run. That's runner noise, not a layout-shift
  // regression, so this file gets a wider retry budget than the rest of the
  // suite; the 0.1 threshold itself is untouched; a real regression (the
  // 0.21 this test was written for) still fails every retry.
  //
  // A deliberately throttled full `load` navigation (4x CPU, 150ms latency,
  // ~1.6 Mbps) genuinely takes longer than the suite's default 30s budget
  // once the runner is also busy with the rest of the suite — that showed up
  // as a hard timeout on `waitForTimeout(4000)`, not a missed CLS number.
  // Doubled here; still well short of what a real hang would need.
  test.describe.configure({ retries: 3, timeout: 60_000 });

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
