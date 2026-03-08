import { expect, test } from "@playwright/test"

test.describe("Onboarding — premiere connexion", () => {
  test("redirige vers le dashboard si l'utilisateur a deja un username", async ({
    page,
  }) => {
    // The E2E test user already has a username set
    await page.goto("/dashboard/onboarding")

    // Should redirect to /dashboard since username exists
    await expect(page).toHaveURL(/\/dashboard(?!\/onboarding)/, {
      timeout: 15_000,
    })
  })

  test("la page onboarding affiche le formulaire si accessible", async ({
    page,
  }) => {
    await page.goto("/dashboard/onboarding")

    // Either redirected (username exists) or form is visible
    const redirected = await page
      .waitForURL(/\/dashboard(?!\/onboarding)/, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!redirected) {
      // Form should be visible
      await expect(page.getByText("Complétez votre profil")).toBeVisible({
        timeout: 15_000,
      })

      await expect(page.getByText("Nom complet")).toBeVisible()
      await expect(page.getByPlaceholder("Ex: Marie Dupont")).toBeVisible()
      await expect(page.getByPlaceholder("votre_nom_utilisateur")).toBeVisible()
      await expect(page.getByRole("button", { name: "Terminer" })).toBeVisible()
    }
  })
})
