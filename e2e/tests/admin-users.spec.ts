import { expect, test } from "@playwright/test"
import { AdminUsersPage } from "../pages/admin-users.page"

// Lecture seule : aucune écriture sur develop.
test.describe("Admin — Utilisateurs", () => {
  let usersPage: AdminUsersPage

  test.beforeEach(async ({ page }) => {
    usersPage = new AdminUsersPage(page)
    await usersPage.goto()
    await usersPage.waitForReady()
  })

  test("la liste charge : comptes, segments, colonnes", async ({ page }) => {
    const main = page.locator("main")
    await expect(
      main.getByText(/comptes · \d+ nouveaux sur 30 jours/),
    ).toBeVisible()
    await expect(page.getByTestId("segment-all")).toBeVisible()
    await expect(
      main.getByRole("columnheader", { name: /Dernière connexion/ }),
    ).toBeVisible()
    await expect(main.locator("tbody tr").first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("recherche, segment et suspendus vivent dans l'URL", async ({
    page,
  }) => {
    await usersPage.searchUser("e2e")
    await page.getByTestId("segment-active").click()
    await expect(page).toHaveURL(/segment=actif/)
    await expect(page).toHaveURL(/q=e2e/)

    await page.getByTestId("filter-suspended").click()
    await expect(page).toHaveURL(/suspendus=1/)

    await page.getByRole("button", { name: "Effacer" }).first().click()
    await expect(page).not.toHaveURL(/segment=|suspendus=|q=/)
  })

  test("un clic ouvre la fiche : accès, paiements, compte", async ({
    page,
  }) => {
    await usersPage.openFirstUser()
    await expect(
      page.getByRole("navigation", { name: "Fil d'Ariane" }),
    ).toContainText("Utilisateurs")
    for (const title of [
      "Abonnements",
      "Résumé",
      "Examens blancs et séries",
      "Identité, rôle et suspension",
      "Préférences et courriels envoyés",
    ])
      await expect(page.getByRole("heading", { name: title })).toBeVisible()
  })

  test("l'export résume les filtres appliqués", async ({ page }) => {
    await page.getByTestId("segment-never").click()
    await expect(page).toHaveURL(/segment=jamais/)
    await page.getByRole("button", { name: /^Exporter/ }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("jamais eu d'accès")
    await expect(
      dialog.getByRole("button", { name: /Exporter en XLSX/ }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("un lien vers un compte inconnu affiche « Utilisateur introuvable »", async ({
    page,
  }) => {
    await usersPage.goto("/inconnu-e2e")
    await expect(page.getByText("Utilisateur introuvable")).toBeVisible({
      timeout: 15_000,
    })
  })
})
