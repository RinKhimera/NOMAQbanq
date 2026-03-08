import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminUsersPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin/users")
  }

  async waitForReady() {
    await expect(this.page.getByText("Gestion des utilisateurs")).toBeVisible({
      timeout: 15_000,
    })
  }

  async searchUser(query: string) {
    const searchInput = this.page.getByPlaceholder(/Rechercher/)
    await searchInput.fill(query)
    // Wait for debounce (300ms)
    await this.page.waitForTimeout(500)
  }

  async selectRoleFilter(role: string) {
    const main = this.page.locator("main")
    const roleSelect = main.getByText(/Tous les rôles|Étudiants|Admin/i).first()
    await roleSelect.click()
    await this.page.getByText(role, { exact: true }).click()
  }
}
