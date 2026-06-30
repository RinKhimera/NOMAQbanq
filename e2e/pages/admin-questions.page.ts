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
    // "Nouvelle question" = h1 + description → cibler le heading.
    await expect(
      this.page.getByRole("heading", { name: "Nouvelle question" }),
    ).toBeVisible({
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

    // Select domain — le Select shadcn/Radix monte son contenu dans un portail
    // (role="listbox" hors `main`) ET garde un <select> natif caché pour le form.
    // Scoper au listbox évite la collision strict-mode avec l'<option> native.
    await main.getByText("Sélectionnez un domaine").click()
    await this.page
      .getByRole("listbox")
      .getByText(data.domain, { exact: true })
      .click()

    // Fill explanation
    await main
      .getByPlaceholder("Explication détaillée de la réponse...")
      .fill(data.explanation)
  }

  /**
   * Renseigne l'objectif CMC. Ce champ est un combobox Popover + cmdk (PAS un
   * input) : le trigger `role="combobox"` affiche « Sélectionner ou créer... »,
   * et c'est seulement à l'ouverture qu'un `CommandInput` (placeholder réel
   * « Rechercher ou créer... », dans un portail) apparaît. On tape puis on
   * clique le 1er item (objectif existant OU « Créer "x" »), tous `role="option"`.
   */
  async fillObjectifCMC(value: string) {
    // Le trigger n'a pas de nom accessible (label « Objectif CMC » non associé
    // via htmlFor) → on le cible par son texte, comme le trigger domaine.
    await this.page.locator("main").getByText("Sélectionner ou créer...").click()
    await this.page.getByPlaceholder("Rechercher ou créer...").fill(value)
    await this.page.getByRole("option").first().click()
  }

  async submitQuestion() {
    await this.page.getByRole("button", { name: "Créer la question" }).click()
  }

  async expectSuccessToast() {
    await this.expectToast("Question créée avec succès !")
  }
}
