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

  test("les actions de l'en-tête naviguent correctement", async ({ page }) => {
    // Entrainement
    await dashboard.clickQuickAccess("Entraînement")
    await expect(page).toHaveURL(/\/tableau-de-bord\/entrainement/)

    await page.goBack()
    await dashboard.waitForReady()

    // Examens blancs
    await dashboard.clickQuickAccess("Examens blancs")
    await expect(page).toHaveURL(/\/tableau-de-bord\/examen-blanc/)
  })

  test("les sections de charts sont presentes", async ({ page }) => {
    const main = page.locator("main")

    // Score evolution chart heading or container
    await expect(main.getByText("Évolution du score").first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("le filtre de période se reflète dans l'URL", async ({ page }) => {
    await expect(page.getByTestId("period-30")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await page.getByTestId("period-7").click()
    await expect(page).toHaveURL(/periode=7/)
    await expect(page.getByTestId("period-7")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})

// Bloc séparé : le beforeEach ci-dessus attend déjà le rendu complet, ce qui
// viderait de son sens une assertion sur l'absence d'écran de chargement.
test.describe("Tableau de bord — chargement", () => {
  test("affiche le shell immédiatement, sans overlay bloquant", async ({
    page,
  }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await dashboard.expectNoBlockingOverlay()
    await dashboard.waitForReady()
  })
})
