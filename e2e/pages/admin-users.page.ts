import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminUsersPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(query = "") {
    await super.goto(`/admin/utilisateurs${query}`)
  }

  async waitForReady() {
    await expect(
      this.page.getByRole("heading", { name: "Utilisateurs", level: 1 }),
    ).toBeVisible({ timeout: 15_000 })
  }

  get search() {
    return this.page.getByPlaceholder(/Retrouver un compte/)
  }

  async searchUser(query: string) {
    await this.search.fill(query)
    await expect(this.page).toHaveURL(new RegExp(`q=${query}`))
  }

  /** Ouvre la fiche du premier compte de la liste (grand écran). */
  async openFirstUser() {
    await this.page
      .locator("main table a[href^='/admin/utilisateurs/']")
      .first()
      .click()
    await expect(this.page).toHaveURL(/\/admin\/utilisateurs\/[^/?]+$/)
  }
}
