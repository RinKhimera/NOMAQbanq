import { defineConfig, devices } from "@playwright/test"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { outputFolder: "./e2e/playwright-report" }], ["github"]]
    : [
        [
          "html",
          { outputFolder: "./e2e/playwright-report", open: "on-failure" },
        ],
      ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    // Global setup — runs first (serial)
    {
      name: "global-setup",
      testMatch: /global\.setup\.ts/,
      testDir: "./e2e",
      teardown: "global-teardown",
    },
    {
      name: "global-teardown",
      testMatch: /global\.teardown\.ts/,
      testDir: "./e2e",
    },
    // Unauthenticated tests (public marketing + auth pages)
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [
        /marketing\.spec\.ts/,
        /auth\.spec\.ts/,
        /evaluation-quiz\.spec\.ts/,
        /error-states\.spec\.ts/,
      ],
      dependencies: ["global-setup"],
    },
    // Authenticated student tests
    {
      name: "chromium-auth",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/user.json"),
      },
      testMatch: [
        /dashboard\.spec\.ts/,
        /entrainement\.spec\.ts/,
        /examen-blanc\.spec\.ts/,
        /examen-blanc-pause\.spec\.ts/,
        /examen-blanc-auto-submit\.spec\.ts/,
        /resultats-examen\.spec\.ts/,
        /resultats-entrainement\.spec\.ts/,
        /profil\.spec\.ts/,
        /payment-access\.spec\.ts/,
        /navigation-student\.spec\.ts/,
      ],
      dependencies: ["global-setup"],
    },
    // Authenticated admin tests
    {
      name: "chromium-admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/admin.json"),
      },
      testMatch: [
        /admin\.spec\.ts/,
        /admin-exams\.spec\.ts/,
        /admin-questions\.spec\.ts/,
        /admin-transactions\.spec\.ts/,
        /admin-users\.spec\.ts/,
        /navigation-admin\.spec\.ts/,
      ],
      dependencies: ["global-setup"],
    },
  ],
  webServer: {
    command: process.env.CI
      ? "bun run build && bun run start"
      : "bun dev --turbopack",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: process.env.CI ? "production" : "development",
    },
  },
})
