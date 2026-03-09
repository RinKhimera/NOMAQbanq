import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { expect, test } from "@playwright/test"

test.describe("Pages d'authentification", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page })
  })

  test("la page de connexion charge correctement", async ({ page }) => {
    await page.goto("/auth/sign-in")

    await expect(page.getByText("Connexion sécurisée")).toBeVisible({
      timeout: 15_000,
    })

    // Clerk SignIn widget should render
    await expect(page.locator(".cl-rootBox")).toBeVisible({ timeout: 15_000 })
  })

  test("la page d'inscription charge correctement", async ({ page }) => {
    await page.goto("/auth/sign-up")

    await expect(
      page.getByText("Créez votre compte en quelques secondes"),
    ).toBeVisible({ timeout: 15_000 })

    // Clerk SignUp widget should render
    await expect(page.locator(".cl-rootBox")).toBeVisible({ timeout: 15_000 })
  })
})
