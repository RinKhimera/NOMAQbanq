import { expect, test } from "@playwright/test"

test.describe("Pages d'authentification", () => {
  test("la page de connexion charge le formulaire Better Auth", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in")

    await expect(page.getByText("Connexion sécurisée")).toBeVisible({
      timeout: 15_000,
    })

    // Formulaire email/mot de passe Better Auth (plus de widget Clerk).
    await expect(page.getByTestId("auth-email")).toBeVisible()
    await expect(page.getByTestId("auth-password")).toBeVisible()
    await expect(page.getByTestId("auth-submit")).toBeVisible()
  })

  test("la page d'inscription charge le formulaire Better Auth", async ({
    page,
  }) => {
    await page.goto("/auth/sign-up")

    await expect(
      page.getByText("Créez votre compte en quelques secondes"),
    ).toBeVisible({ timeout: 15_000 })

    await expect(page.getByTestId("auth-email")).toBeVisible()
    await expect(page.getByTestId("auth-password")).toBeVisible()
    await expect(page.getByTestId("auth-submit")).toBeVisible()
  })
})
