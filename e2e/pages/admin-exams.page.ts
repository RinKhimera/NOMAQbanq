import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminExamsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin/examens")
  }

  /** Vue de pilotage : ses trois sections. */
  async waitForReady() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Examens blancs" }),
    ).toBeVisible({ timeout: 15_000 })
    for (const section of ["live", "prepare", "finished"]) {
      await expect(
        this.page.getByTestId(`exams-section-${section}`),
      ).toBeVisible()
    }
  }

  async gotoCreateExam() {
    await this.page.getByTestId("btn-create-exam").click()
    await this.page.waitForURL(/\/admin\/examens\/creer/)
    await this.expectCreateFormFields()
  }

  async expectCreateFormFields() {
    await expect(this.page.getByTestId("exam-title-input")).toBeVisible({
      timeout: 15_000,
    })
    for (const id of [
      "exam-description-input",
      "exam-start-input",
      "exam-end-input",
      "exam-target-input",
      "exam-pause-switch",
      "btn-finalize-exam",
      "btn-save-exam",
    ]) {
      await expect(this.page.getByTestId(id)).toBeVisible()
    }
    // Rien à composer avant le premier enregistrement.
    await expect(this.page.getByTestId("btn-compose-questions")).toBeDisabled()
  }
}
