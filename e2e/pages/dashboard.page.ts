import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/dashboard")
  }

  async waitForReady() {
    // Wait for the greeting text to appear (Bonjour/Bon après-midi/Bonsoir)
    await expect(
      this.page
        .locator("h1")
        .filter({ hasText: /Bonjour|Bon après-midi|Bonsoir/ }),
    ).toBeVisible({ timeout: 15_000 })
  }

  async expectVitalCardsVisible() {
    const main = this.page.locator("main")
    await expect(main.getByText("Score moyen")).toBeVisible({ timeout: 15_000 })
    await expect(main.getByText("Examens complétés")).toBeVisible()
    await expect(main.getByText("Taux de complétion")).toBeVisible()
    await expect(main.getByText("Entraînements")).toBeVisible()
  }

  async clickQuickAccess(title: string) {
    const main = this.page.locator("main")
    await main.getByRole("link", { name: title }).click()
    await this.page.waitForLoadState("networkidle")
  }
}
