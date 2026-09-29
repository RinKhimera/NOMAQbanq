import { expect, test } from "@playwright/test"

test.describe("Pages d'authentification", () => {
  test("la page de connexion charge le formulaire Better Auth", async ({
    page,
  }) => {
    await page.goto("/connexion")

    await expect(
      page.getByRole("heading", { level: 1, name: "Bon retour parmi nous" }),
    ).toBeVisible({
      timeout: 15_000,
    })

    // Formulaire email/mot de passe Better Auth.
    await expect(page.getByTestId("auth-email")).toBeVisible()
    await expect(page.getByTestId("auth-password")).toBeVisible()
    await expect(page.getByTestId("auth-submit")).toBeVisible()
  })

  test("la page d'inscription charge le formulaire Better Auth", async ({
    page,
  }) => {
    await page.goto("/inscription")

    await expect(
      page.getByRole("heading", { level: 1, name: "Créer votre compte" }),
    ).toBeVisible({ timeout: 15_000 })

    await expect(page.getByTestId("auth-email")).toBeVisible()
    await expect(page.getByTestId("auth-password")).toBeVisible()
    await expect(page.getByTestId("auth-submit")).toBeVisible()
  })
})
