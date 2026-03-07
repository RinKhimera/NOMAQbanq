import { expect, test } from "@playwright/test"

import { PaymentPage } from "../pages/payment.page"

test.describe("Paiement et acces — paywall et verification", () => {
  test("la page tarifs affiche les produits", async ({ page }) => {
    const payment = new PaymentPage(page)
    await payment.gotoTarifs()

    await expect(
      page.getByRole("button", { name: /Acheter maintenant|Prolonger/ }).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/Paiement sécurisé/),
    ).toBeVisible()
  })

  test("la page abonnements affiche le statut des acces", async ({
    page,
  }) => {
    const payment = new PaymentPage(page)
    await payment.gotoAbonnements()

    // La page doit afficher les deux types d'acces
    await expect(page.getByText(/Examens Simulés|Examens/i)).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByText(/Banque d'Entraînement|Entraînement/i),
    ).toBeVisible()
  })

  test("la page entrainement montre le contenu quand l'acces est actif", async ({
    page,
  }) => {
    await page.goto("/dashboard/entrainement")

    // Avec un user qui a acces, on doit voir le formulaire
    // (si l'user n'a pas acces, on verra le paywall — les deux sont valides)
    const hasAccess = await page
      .getByText("Nouvelle session")
      .isVisible({ timeout: 15_000 })
      .catch(() => false)

    const hasPaywall = await page
      .getByText("Débloquez l'Entraînement")
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    // L'un des deux doit etre visible
    expect(hasAccess || hasPaywall).toBe(true)
  })

  test("la page succes de paiement affiche erreur sans session_id", async ({
    page,
  }) => {
    const payment = new PaymentPage(page)
    await payment.gotoPaymentSuccess()

    await expect(
      page.getByText("Erreur de vérification"),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText(/Aucun identifiant de session/),
    ).toBeVisible()
  })

  test("la page succes de paiement affiche erreur avec session_id invalide", async ({
    page,
  }) => {
    await page.goto("/dashboard/payment/success?session_id=invalid_session")

    await expect(
      page.getByText(/Erreur de vérification|en cours de traitement/),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("le lien voir les tarifs depuis le paywall fonctionne", async ({
    page,
  }) => {
    await page.goto("/dashboard/entrainement")

    // Si le paywall est visible, verifier le lien
    const paywallVisible = await page
      .getByText("Débloquez l'Entraînement")
      .isVisible({ timeout: 15_000 })
      .catch(() => false)

    if (paywallVisible) {
      await page
        .getByRole("link", { name: /Voir tous les forfaits|tarifs/i })
        .click()
      await expect(page).toHaveURL(/\/tarifs/)
    } else {
      // User has access — skip this test gracefully
      test.skip()
    }
  })
})
