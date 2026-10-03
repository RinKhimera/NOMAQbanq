import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminQuestionsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(query = "") {
    await super.goto(`/admin/questions${query}`)
  }

  async waitForReady() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Questions" }),
    ).toBeVisible({ timeout: 15_000 })
  }

  async gotoNewQuestion() {
    await this.page.getByRole("link", { name: "Nouvelle question" }).click()
    await this.page.waitForURL(/\/admin\/questions\/nouvelle/)
    await expect(
      this.page.getByRole("heading", { name: "Nouvelle question" }),
    ).toBeVisible({ timeout: 15_000 })
  }

  async searchQuestion(query: string) {
    await this.page
      .getByPlaceholder("Énoncé, choix de réponse, objectif ou identifiant")
      .fill(query)
    // Recherche débouncée (300 ms) puis rechargement de la page serveur.
    await this.page.waitForURL(
      (url) => url.searchParams.get("q") === query.trim(),
    )
  }

  /** Ouvre la page de détail de la n-ième ligne (lien de l'énoncé). */
  async openRow(index = 0) {
    await this.page.getByTestId("question-row-link").nth(index).click()
    await this.page.waitForURL(/\/admin\/questions\/[^/?]+(\?|$)/)
  }

  async fillQuestionForm(data: {
    question: string
    options: string[]
    keyIndex: number
    domain: string
    objective: string
    explanation: string
  }) {
    const main = this.page.locator("main")

    // Domaine : Select Radix, contenu dans un portail (listbox hors `main`).
    await main.locator("#qf-domain").click()
    await this.page
      .getByRole("listbox")
      .getByText(data.domain, { exact: true })
      .click()

    // Objectif : combobox à recherche ; « Créer » passe par le serveur, qui
    // refuse un doublon du référentiel.
    await main.locator("#qf-objective").click()
    await this.page
      .getByPlaceholder("Rechercher un objectif")
      .fill(data.objective)
    const exact = this.page.getByRole("option", {
      name: data.objective,
      exact: true,
    })
    const create = this.page.getByRole("option").filter({ hasText: "Créer" })
    await exact.or(create).first().waitFor({ state: "visible" })
    await ((await exact.count()) > 0 ? exact : create).first().click()
    await expect(main.locator("#qf-objective")).toContainText(data.objective)

    await main.getByTestId("question-input").fill(data.question)
    for (const [i, option] of data.options.entries())
      await main.getByTestId(`option-input-${i}`).fill(option)
    await main.getByTestId(`btn-key-${data.keyIndex}`).click()
    await main.getByTestId("explanation-input").fill(data.explanation)
  }

  async save() {
    await this.page.getByTestId("btn-save-question").click()
  }
}
