import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { TEST_AUTH_SECRET } from "./scripts/lib/test-account";
import { E2E_BASE_URL, E2E_PORT, E2E_HOST } from "./scripts/lib/e2e-environment";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: process.env.CODEFIT_E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: "npm start",
        url: E2E_BASE_URL,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          PORT: E2E_PORT,
          HOSTNAME: E2E_HOST,
          DATABASE_PATH: resolve("artifacts/e2e.sqlite"),
          DATABASE_URL: "",
          OPENAI_API_KEY: "",
          VERCEL: "",
          AUTH_BASE_URL: E2E_BASE_URL,
          BETTER_AUTH_SECRET: TEST_AUTH_SECRET,
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
          GITHUB_CLIENT_ID: "",
          GITHUB_CLIENT_SECRET: "",
        },
      },
});
