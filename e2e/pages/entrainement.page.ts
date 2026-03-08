import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class EntrainementPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/dashboard/entrainement")
    // Wait for main content to load — either the form, paywall, or resume card
    await this.page
      .getByText("Nouvelle session")
      .or(this.page.getByText("Débloquez l'Entraînement"))
      .or(this.page.getByText("Session en cours"))
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
  }

  /** Returns true if the user has training access (no paywall) */
  async hasAccess(): Promise<boolean> {
    const paywall = this.page.getByText("Débloquez l'Entraînement")
    return !(await paywall.isVisible().catch(() => false))
  }

  /** Returns true if there's an in-progress session to resume */
  async hasActiveSession(): Promise<boolean> {
    return this.page
      .getByText("Session en cours")
      .isVisible()
      .catch(() => false)
  }

  /** Abandon the current in-progress session so we can start fresh */
  async abandonActiveSession() {
    await this.page
      .getByRole("button", { name: "Abandonner la session" })
      .click()

    const dialog = this.page.locator('[role="alertdialog"]')
    await dialog.getByRole("button", { name: "Abandonner" }).click()

    await expect(this.page.getByText("Session en cours")).toBeHidden({
      timeout: 10_000,
    })
  }

  async waitForForm() {
    if (await this.hasActiveSession()) {
      await this.abandonActiveSession()
    }
    await expect(
      this.page.getByRole("heading", { name: "Nouvelle session" }),
    ).toBeVisible({ timeout: 15_000 })
  }

  async setQuestionCount(count: number) {
    await this.page
      .getByRole("button", { name: String(count), exact: true })
      .click()
  }

  async startSession() {
    if (await this.hasActiveSession()) {
      await this.abandonActiveSession()
    }

    await this.page
      .getByRole("button", { name: "Commencer l'entraînement" })
      .click()
    await this.page.waitForURL(/\/dashboard\/entrainement\//, {
      timeout: 15_000,
    })
  }

  async waitForQuestion(questionNum: number, total: number) {
    await expect(
      this.page.getByText(`Question ${questionNum} / ${total}`),
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

  async flagQuestion() {
    await this.page.getByTestId("btn-flag").click()
  }

  async finishSession() {
    // Click finish — could be in header or session-navigation
    await this.page.getByTestId("btn-finish").click()

    await expect(this.page.getByText("Terminer la session ?")).toBeVisible()

    const dialog = this.page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Terminer" }).click()

    await this.page.waitForURL(/\/results/, { timeout: 15_000 })
  }

  async getScore(): Promise<string> {
    const scoreElement = this.page.locator("text=/\\d+%/").first()
    return (await scoreElement.textContent()) ?? ""
  }
}
