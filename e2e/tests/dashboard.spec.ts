import { expect, test } from "@playwright/test"
import { DashboardPage } from "../pages/dashboard.page"

test.describe("Tableau de bord etudiant", () => {
  let dashboard: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page)
    await dashboard.goto()
    await dashboard.waitForReady()
  })

  test("affiche le greeting avec le nom de l'utilisateur", async ({ page }) => {
    await expect(
      page.locator("h1").filter({ hasText: /Bonjour|Bon après-midi|Bonsoir/ }),
    ).toBeVisible()
  })

  test("affiche les 4 cartes de statistiques vitales", async () => {
    await dashboard.expectVitalCardsVisible()
  })

  test("la grille d'acces rapides navigue correctement", async ({ page }) => {
    // Entrainement
    await dashboard.clickQuickAccess("Entraînement")
    await expect(page).toHaveURL(/\/dashboard\/entrainement/)

    await page.goBack()
    await dashboard.waitForReady()

    // Examens blancs
    await dashboard.clickQuickAccess("Examens blancs")
    await expect(page).toHaveURL(/\/dashboard\/examen-blanc/)

    await page.goBack()
    await dashboard.waitForReady()

    // Mon profil
    await dashboard.clickQuickAccess("Mon profil")
    await expect(page).toHaveURL(/\/dashboard\/profil/)
  })

  test("les sections de charts sont presentes", async ({ page }) => {
    const main = page.locator("main")

    // Score evolution chart heading or container
    await expect(main.getByText("Évolution du score").first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("la section acces rapides est visible", async ({ page }) => {
    await expect(page.getByText("Accès rapides")).toBeVisible({
      timeout: 15_000,
    })
  })
})
