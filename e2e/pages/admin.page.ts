import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin")
  }

  async waitForReady() {
    await expect(this.page.getByText("Tableau de bord")).toBeVisible({
      timeout: 15_000,
    })
  }

  async expectVitalCardsVisible() {
    const main = this.page.locator("main")
    await expect(main.getByText("Revenus CAD (30j)")).toBeVisible({
      timeout: 15_000,
    })
    await expect(main.getByText("Utilisateurs")).toBeVisible()
    await expect(main.getByText("Examens actifs")).toBeVisible()
    await expect(main.getByText("Accès expirant")).toBeVisible()
  }

  async clickQuickAction(label: string) {
    const main = this.page.locator("main")
    await main.getByText(label, { exact: true }).click()
    await this.page.waitForLoadState("networkidle")
  }
}
