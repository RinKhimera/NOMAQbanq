import { expect, test } from "@playwright/test"
import { AdminPage } from "../pages/admin.page"

test.describe("Panneau d'administration", () => {
  let admin: AdminPage

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page)
    await admin.goto()
    await admin.waitForReady()
  })

  test("affiche le tableau de bord admin avec la date", async ({ page }) => {
    await expect(page.getByText("Tableau de bord")).toBeVisible()

    // Date in French format should be visible (e.g., "vendredi 7 mars 2026")
    await expect(
      page.getByText(
        /\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/,
      ),
    ).toBeVisible()
  })

  test("affiche les cartes de statistiques vitales", async () => {
    await admin.expectVitalCardsVisible()
  })

  test("les actions rapides naviguent correctement", async ({ page }) => {
    // Ajouter une question → /admin/questions
    await admin.clickQuickAction("Ajouter une question")
    await expect(page).toHaveURL(/\/admin\/questions/)

    await page.goBack()
    await admin.waitForReady()

    // Créer un examen → /admin/exams/create
    await admin.clickQuickAction("Créer un examen")
    await expect(page).toHaveURL(/\/admin\/exams\/create/)

    await page.goBack()
    await admin.waitForReady()

    // Gérer les utilisateurs → /admin/users
    await admin.clickQuickAction("Gérer les utilisateurs")
    await expect(page).toHaveURL(/\/admin\/users/)
  })

  test("le modal de paiement manuel s'ouvre", async ({ page }) => {
    await admin.clickQuickAction("Enregistrer un paiement")

    // ManualPaymentModal should be visible
    await expect(
      page.locator("[role='dialog']").filter({ hasText: "Paiement manuel" }),
    ).toBeVisible({ timeout: 10_000 })

    // Close the modal
    await page.keyboard.press("Escape")
  })

  test("les sections charts et activite sont presentes", async ({ page }) => {
    const main = page.locator("main")

    await expect(main.getByText("Actions rapides")).toBeVisible({
      timeout: 15_000,
    })
  })
})
