import { expect, test } from "@playwright/test"

// Parcours non authentifiés : on repart d'un état vierge.
test.use({ storageState: { cookies: [], origins: [] } })

test("inscription email/mdp → écran de vérification du courriel", async ({
  page,
}) => {
  await page.goto("/inscription")

  // Email unique par run pour éviter toute collision côté serveur.
  const unique = `e2e+${Date.now()}@nomaqtest.local`
  await page.getByTestId("auth-name").fill("E2E Test")
  await page.getByTestId("auth-email").fill(unique)
  await page.getByTestId("auth-password").fill("password123")
  await page.getByTestId("auth-submit").click()

  await expect(page.getByTestId("auth-check-email")).toBeVisible()
})

test("connexion avec mauvais mot de passe → alerte actionnable + lien reset", async ({
  page,
}) => {
  await page.goto("/connexion")

  await page.getByTestId("auth-email").fill("inconnu@nomaqtest.local")
  await page.getByTestId("auth-password").fill("mauvaispass123")
  await page.getByTestId("auth-submit").click()

  const alert = page.getByTestId("auth-error-alert")
  await expect(alert).toBeVisible()
  await expect(
    alert.getByRole("link", { name: /Réinitialisez-le/ }),
  ).toHaveAttribute("href", "/mot-de-passe-oublie")
})
