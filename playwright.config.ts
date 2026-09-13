import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { TEST_AUTH_SECRET } from "./scripts/lib/test-account";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CODEFIT_E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: "npm start",
        url: "http://127.0.0.1:3010",
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          PORT: "3010",
          HOSTNAME: "127.0.0.1",
          DATABASE_PATH: resolve("artifacts/e2e.sqlite"),
          DATABASE_URL: "",
          OPENAI_API_KEY: "",
          VERCEL: "",
          AUTH_BASE_URL: "http://127.0.0.1:3010",
          BETTER_AUTH_SECRET: TEST_AUTH_SECRET,
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
          GITHUB_CLIENT_ID: "",
          GITHUB_CLIENT_SECRET: "",
        },
      },
});
