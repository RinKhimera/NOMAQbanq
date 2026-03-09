import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminTransactionsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin/transactions")
  }

  async waitForReady() {
    await expect(this.page.getByText("Transactions").first()).toBeVisible({
      timeout: 15_000,
    })
  }

  async openManualPaymentModal() {
    await this.page.getByRole("button", { name: /Paiement manuel/ }).click()
    await expect(
      this.page
        .locator("[role='dialog']")
        .filter({ hasText: "Paiement manuel" }),
    ).toBeVisible({ timeout: 10_000 })
  }
}
