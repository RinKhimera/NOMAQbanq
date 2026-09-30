import { expect, test } from "@playwright/test"
import { AdminTransactionsPage } from "../pages/admin-transactions.page"

// Lecture seule : aucune écriture sur develop (pas d'enregistrement de paiement).
test.describe("Admin — Transactions (dossier client)", () => {
  test.setTimeout(60_000)

  let transactions: AdminTransactionsPage

  test.beforeEach(async ({ page }) => {
    transactions = new AdminTransactionsPage(page)
    await transactions.goto()
    await transactions.waitForReady()
  })

  test("ligne de chiffres, liste des clients, dossier à choisir", async ({
    page,
  }) => {
    await expect(page.getByTestId("transactions-summary")).toContainText(
      "acheteur",
    )
    await expect(transactions.clientList).toBeVisible()
    await expect(page.getByText("Choisissez un client")).toBeVisible()
  })

  test("ouvrir un client affiche son constat, ses accès et sa chronologie", async ({
    page,
  }) => {
    await transactions.openFirstClient()
    const file = transactions.clientFile
    await expect(file.getByText("Accès Examens")).toBeVisible()
    await expect(file.getByText("Accès Entraînement")).toBeVisible()

    // Déplier une transaction : le détail et l'URL suivent.
    await file.locator("[data-testid^='timeline-'] button").first().click()
    await expect(file.getByText("Identifiant")).toBeVisible()
    await expect(page).toHaveURL(/tx=/)
  })

  test("filtre et recherche vivent dans l'URL, retour en tête de liste", async ({
    page,
  }) => {
    await page.getByTestId("client-filter-failed").click()
    await expect(page).toHaveURL(/filtre=echec/)

    await page.getByPlaceholder("Nom ou courriel du client").fill("zzzz-aucun")
    await expect(page).toHaveURL(/q=zzzz-aucun/)
    await expect(
      page.getByText(/Aucune transaction ne correspond à « zzzz-aucun »/),
    ).toBeVisible({ timeout: 15_000 })

    await page.getByRole("button", { name: "Effacer les filtres" }).click()
    await expect(page).not.toHaveURL(/q=|filtre=/)
  })

  test("le dialogue de paiement manuel propose client, produit et montant", async ({
    page,
  }) => {
    await transactions.openManualPaymentDialog()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Client")).toBeVisible()
    await expect(dialog.getByText("Produit")).toBeVisible()
    await expect(dialog.getByLabel("Montant")).toBeVisible()

    // Montant nul : accès offert, motif obligatoire.
    await dialog.getByLabel("Montant").fill("0")
    await expect(dialog.getByText("Motif de la gratuité")).toBeVisible()
    await page.keyboard.press("Escape")
  })
})
