import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class ExamenBlancPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/dashboard/examen-blanc")
    // Wait for page content — heading or exam cards
    await this.page
      .getByText("Examens Blancs")
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
  }

  async clickStartExam() {
    await this.page
      .getByRole("button", { name: "Commencer l'examen" })
      .first()
      .click()
  }

  async confirmStart() {
    await expect(
      this.page.getByText("Confirmer le début de l'examen"),
    ).toBeVisible()

    const dialog = this.page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Commencer l'examen" }).click()

    await this.page.waitForURL(/\/evaluation/, { timeout: 15_000 })
  }

  async acceptWarning() {
    await expect(
      this.page.getByText("Règles importantes de l'examen"),
    ).toBeVisible({ timeout: 10_000 })

    await this.page
      .getByRole("button", { name: /Je comprends.*Commencer/ })
      .click()
  }

  /** Accept warning if shown, or wait for timer if session is being resumed */
  async acceptWarningOrResume() {
    const warning = this.page.getByText("Règles importantes de l'examen")
    const timer = this.page.locator("text=/\\d{2}:\\d{2}:\\d{2}/").first()

    // Wait for either the warning dialog or the timer to appear
    await warning
      .or(timer)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })

    if (await warning.isVisible()) {
      await this.page
        .getByRole("button", { name: /Je comprends.*Commencer/ })
        .click()
    }
    // If timer is already visible, session was resumed — nothing to do
  }

  async waitForTimer() {
    await expect(this.page.locator("text=/\\d{2}:\\d{2}:\\d{2}/")).toBeVisible({
      timeout: 10_000,
    })
  }

  async getTimerText(): Promise<string> {
    const timer = this.page.locator("text=/\\d{2}:\\d{2}:\\d{2}/").first()
    return (await timer.textContent()) ?? ""
  }

  async waitForQuestion(questionNum: number) {
    await expect(
      this.page.getByText(new RegExp(`Question ${questionNum} /`)),
    ).toBeVisible({ timeout: 10_000 })
  }

  async selectAnswer(index: number) {
    await this.page.getByTestId(`answer-option-${index}`).click()
  }

  async nextQuestion() {
    await this.page.getByTestId("btn-next").click()
  }

  async prevQuestion() {
    await this.page.getByTestId("btn-previous").click()
  }

  async submitExam() {
    // Use header finish button (visible on any question, not just last)
    await this.page.getByTestId("btn-header-finish").click()

    await expect(this.page.getByText("Soumettre l'examen ?")).toBeVisible()

    const dialog = this.page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: /Terminer l'examen/ }).click()

    await this.page.waitForURL(/\/dashboard\/examen-blanc/, {
      timeout: 15_000,
    })
  }

  async goToResults() {
    await this.page
      .getByRole("button", { name: "Consulter les résultats" })
      .first()
      .click()
    await this.page.waitForURL(/\/resultats|\/examen-blanc\//, {
      timeout: 15_000,
    })
  }
}
