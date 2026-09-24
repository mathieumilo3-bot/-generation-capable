import { defineConfig, devices } from "@playwright/test";

/**
 * The sandboxed CI image ships Chromium at PLAYWRIGHT_BROWSERS_PATH instead of
 * downloading one, so the launcher is pointed at it explicitly when present.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // The audit funnel genuinely polls a background job, so a complete run is
  // seconds, not milliseconds. Assertions wait accordingly.
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Standard GitHub-hosted runners have 2 cores. Letting Playwright's default
  // (CPU count) spawn workers there starves CPU-throttled/timing-sensitive
  // specs (the CLS budget, the preview funnel's polling loop) of real CPU and
  // makes them flaky under load — not because the feature is broken, but
  // because 6+ browser workers were fighting over 2 cores. Capped explicitly;
  // the CI workflow also shards by project so each shard gets this budget
  // to itself rather than sharing it with the other project's run.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3000",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Offline fixtures for the preview engine V2 only (registry, search,
        // pages and model jobs at the network edge). Ignored in production.
        env: { GC_PREVIEW_FIXTURES: "1" },
      },
});
