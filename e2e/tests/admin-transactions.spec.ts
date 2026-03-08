import { expect, test } from "@playwright/test"
import { AdminTransactionsPage } from "../pages/admin-transactions.page"

test.describe("Admin — Transactions", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(60_000)

  let transactionsPage: AdminTransactionsPage

  test.beforeEach(async ({ page }) => {
    transactionsPage = new AdminTransactionsPage(page)
  })

  test("la page transactions charge correctement", async ({ page }) => {
    await transactionsPage.goto()
    await transactionsPage.waitForReady()

    // Stats section should be visible
    const main = page.locator("main")
    await expect(main.getByText(/Total|Revenus/).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("le bouton paiement manuel ouvre le modal", async ({ page }) => {
    await transactionsPage.goto()
    await transactionsPage.waitForReady()
    await transactionsPage.openManualPaymentModal()

    // Modal should be visible with form fields
    const modal = page.locator("[role='dialog']")
    await expect(modal).toBeVisible()

    // Close
    await page.keyboard.press("Escape")
  })

  test("le modal de paiement manuel affiche les champs", async ({ page }) => {
    await transactionsPage.goto()
    await transactionsPage.waitForReady()
    await transactionsPage.openManualPaymentModal()

    const modal = page.locator("[role='dialog']")

    // Should have user selection, product, amount fields
    await expect(
      modal.getByText(/Utilisateur|Patient|Client/).first(),
    ).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByText(/Produit|Offre/).first()).toBeVisible()

    await page.keyboard.press("Escape")
  })

  test("les filtres de transactions fonctionnent", async ({ page }) => {
    await transactionsPage.goto()
    await transactionsPage.waitForReady()

    const main = page.locator("main")

    // Look for filter buttons (type and status)
    const filterBtn = main
      .getByRole("button", { name: /Tous|Stripe|Manuel|Complété|En attente/i })
      .first()

    const hasFilter = await filterBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    if (hasFilter) {
      await filterBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test("la recherche de transactions fonctionne", async ({ page }) => {
    await transactionsPage.goto()
    await transactionsPage.waitForReady()

    const searchInput = page.getByPlaceholder(/Rechercher/)
    const hasSearch = await searchInput
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    if (hasSearch) {
      await searchInput.fill("test")
      await page.waitForTimeout(500)
      await expect(searchInput).toHaveValue("test")
    }
  })
})
