import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminTransactionsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(query = "") {
    await super.goto(`/admin/transactions${query}`)
  }

  async waitForReady() {
    await expect(
      this.page.getByRole("heading", { name: "Transactions", level: 1 }),
    ).toBeVisible({ timeout: 15_000 })
  }

  get clientList() {
    return this.page.getByRole("complementary", { name: "Clients" })
  }

  get clientFile() {
    return this.page.getByRole("region", { name: "Dossier du client" })
  }

  async openFirstClient() {
    // Un clic avant l'hydratation (serveur de dev à froid) ne navigue pas :
    // on recommence jusqu'à ce que l'URL porte le client.
    await expect(async () => {
      await this.clientList
        .locator("li [data-testid^='client-']")
        .first()
        .click()
      await expect(this.page).toHaveURL(/client=/, { timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    await expect(this.page.getByTestId("client-verdict")).toBeVisible({
      timeout: 15_000,
    })
  }

  async openManualPaymentDialog() {
    await this.page.getByRole("button", { name: "Paiement manuel" }).click()
    await expect(
      this.page
        .getByRole("dialog")
        .filter({ hasText: "Enregistrer un paiement manuel" }),
    ).toBeVisible({ timeout: 10_000 })
  }
}
