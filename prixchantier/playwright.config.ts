import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Tests bout-en-bout sur le build de production, contre la stack Supabase
 * locale (npx supabase start). Boîte mail de test et faux serveur OpenAI.
 */
const env: Record<string, string> = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
}
export const MAILBOX_DIR = process.env.TEST_MAILBOX_DIR ?? join(tmpdir(), "prixchantier-e2e-mailbox");
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    launchOptions: existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx e2e/mock-openai.ts",
      url: "http://127.0.0.1:4010",
      reuseExistingServer: true,
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...env,
        APP_URL: `http://localhost:${PORT}`,
        ENABLE_TEST_MAILBOX: "1",
        PRIXCHANTIER_E2E: "1",
        TEST_MAILBOX_DIR: MAILBOX_DIR,
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "http://127.0.0.1:4010/v1",
      },
    },
  ],
});
