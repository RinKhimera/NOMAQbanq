import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminQuestionsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin/questions")
  }

  async waitForReady() {
    await expect(this.page.getByText("Gestion des Questions")).toBeVisible({
      timeout: 15_000,
    })
  }

  async gotoNewQuestion() {
    await this.page.getByRole("link", { name: "Nouvelle question" }).click()
    await this.page.waitForURL(/\/admin\/questions\/nouvelle/)
    await expect(this.page.getByText("Nouvelle question")).toBeVisible({
      timeout: 15_000,
    })
  }

  async searchQuestion(query: string) {
    const searchInput = this.page.getByPlaceholder(/Rechercher/)
    await searchInput.fill(query)
    // Wait for debounce (300ms) + Convex query
    await this.page.waitForTimeout(500)
  }

  async fillQuestionForm(data: {
    question: string
    options: string[]
    correctAnswer: string
    domain: string
    explanation: string
  }) {
    const main = this.page.locator("main")

    // Fill question text
    await main
      .getByPlaceholder("Saisissez votre question ici...")
      .fill(data.question)

    // Fill options
    for (let i = 0; i < data.options.length; i++) {
      const letter = String.fromCharCode(65 + i) // A, B, C, D
      await main.getByPlaceholder(`Option ${letter}`).fill(data.options[i])
    }

    // Select correct answer (click the letter button)
    await main
      .getByRole("button", { name: data.correctAnswer, exact: true })
      .click()

    // Select domain
    await main.getByText("Sélectionnez un domaine").click()
    await this.page.getByText(data.domain, { exact: true }).click()

    // Fill explanation
    await main
      .getByPlaceholder("Explication détaillée de la réponse...")
      .fill(data.explanation)
  }

  async submitQuestion() {
    await this.page.getByRole("button", { name: "Créer la question" }).click()
  }

  async expectSuccessToast() {
    await this.expectToast("Question créée avec succès !")
  }
}
