import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminExamsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin/exams")
  }

  async waitForReady() {
    await expect(this.page.getByText("Gestion des Examens")).toBeVisible({
      timeout: 15_000,
    })
  }

  async gotoCreateExam() {
    await this.page.getByRole("link", { name: "Créer un examen" }).click()
    await this.page.waitForURL(/\/admin\/exams\/create/)
    await expect(this.page.getByText("Créer un examen").first()).toBeVisible({
      timeout: 15_000,
    })
  }

  async expectCreateFormFields() {
    const main = this.page.locator("main")
    await expect(main.getByText("Informations générales")).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      main.getByPlaceholder("Ex: Examen de Cardiologie - Session 2025"),
    ).toBeVisible()
    await expect(main.getByText("Nombre de questions")).toBeVisible()
    await expect(main.getByText("Période de disponibilité")).toBeVisible()
    await expect(main.getByText("Pause pendant l'examen")).toBeVisible()
  }
}
