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
    await expect(
      page.getByRole("heading", { name: "Tableau de bord" }).first(),
    ).toBeVisible()

    // Date in French format should be visible (e.g., "vendredi 7 mars 2026")
    await expect(
      page.getByText(
        /\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/,
      ),
    ).toBeVisible()
  })

  test("affiche la bande de chiffres clés", async () => {
    await admin.expectStatBandVisible()
  })

  test("les actions rapides naviguent correctement", async ({ page }) => {
    // Ajouter une question → /admin/questions
    await admin.clickQuickAction("Ajouter une question")
    await expect(page).toHaveURL(/\/admin\/questions/)

    await page.goBack()
    await admin.waitForReady()

    // Créer un examen → /admin/examens/creer
    await admin.clickQuickAction("Créer un examen")
    await expect(page).toHaveURL(/\/admin\/examens\/creer/)

    await page.goBack()
    await admin.waitForReady()

    // Gérer les utilisateurs → /admin/utilisateurs
    await admin.clickQuickAction("Gérer les utilisateurs")
    await expect(page).toHaveURL(/\/admin\/utilisateurs/)
  })

  test("le modal de paiement manuel s'ouvre", async ({ page }) => {
    await admin.clickQuickAction("Enregistrer un paiement")

    await expect(
      page
        .getByRole("dialog")
        .filter({ hasText: "Enregistrer un paiement manuel" }),
    ).toBeVisible({ timeout: 10_000 })

    // Close the modal
    await page.keyboard.press("Escape")
  })

  test("revenus, activité, banque et raccourcis sont présents", async ({
    page,
  }) => {
    const main = page.locator("main")
    for (const title of [
      "Revenus quotidiens",
      "Dernières actions",
      "Questions par domaine",
      "Actions rapides",
    ])
      await expect(main.getByRole("heading", { name: title })).toBeVisible({
        timeout: 15_000,
      })
  })
})
