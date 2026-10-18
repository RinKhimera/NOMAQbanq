import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminProgressionPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(query = "") {
    await super.goto(`/admin/progression${query}`)
  }

  async waitForReady() {
    await expect(
      this.page.getByRole("heading", { name: "Progression", level: 1 }),
    ).toBeVisible({ timeout: 15_000 })
  }

  get table() {
    return this.page.getByTestId("progression-table")
  }

  /** Ouvre la progression du premier étudiant du tableau (grand écran). */
  async openFirstStudent() {
    // Un clic avant l'hydratation (serveur de dev à froid) ne navigue pas :
    // on recommence jusqu'à ce que l'URL porte l'étudiant.
    await expect(async () => {
      await this.table.locator("a[href^='/admin/progression/']").first().click()
      await expect(this.page).toHaveURL(
        /\/admin\/progression\/[^/?]+\?.*liste=1/,
        { timeout: 2_000 },
      )
    }).toPass({ timeout: 30_000 })
  }

  get position() {
    return this.page.getByTestId("student-position")
  }
}
