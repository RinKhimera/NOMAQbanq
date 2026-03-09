import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class ProfilPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/dashboard/profil")
  }

  async waitForReady() {
    await expect(this.page.getByText("Informations personnelles")).toBeVisible({
      timeout: 15_000,
    })
  }

  async editInlineField(label: string, newValue: string) {
    const main = this.page.locator("main")
    // Find the field section and hover to reveal edit button
    const fieldSection = main
      .locator(`text=${label}`)
      .locator("..")
      .locator("..")
    await fieldSection.hover()

    // Click edit button (pencil icon) — may be hidden, force click
    const editBtn = fieldSection.getByRole("button").first()
    await editBtn.click({ force: true })

    // Clear and type new value
    const input = fieldSection.locator("input, textarea").first()
    await input.clear()
    await input.fill(newValue)

    // Click save button
    const saveBtn = fieldSection
      .getByRole("button", { name: /Enregistrer|sauvegarder/i })
      .first()
    await saveBtn.click()
  }
}
