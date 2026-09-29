import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class EntrainementPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/tableau-de-bord/entrainement")
    // Contenu principal : le formulaire, le paywall ou la carte « Série en cours ».
    await this.page
      .getByText("Nouvelle série", { exact: true })
      .or(this.page.getByTestId("access-paywall"))
      .or(this.page.getByTestId("active-series-card"))
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
  }

  /** Vrai si l'étudiant a l'accès Entraînement (pas de paywall). */
  async hasAccess(): Promise<boolean> {
    const paywall = this.page.getByTestId("access-paywall")
    return !(await paywall.isVisible().catch(() => false))
  }

  /** Vrai s'il y a une série en cours à reprendre. */
  async hasActiveSession(): Promise<boolean> {
    return this.page
      .getByTestId("active-series-card")
      .isVisible()
      .catch(() => false)
  }

  /** Abandonne la série en cours pour repartir d'un formulaire libre. */
  async abandonActiveSession() {
    await this.page
      .getByTestId("active-series-card")
      .getByRole("button", { name: "Abandonner" })
      .click()

    const dialog = this.page.locator('[role="alertdialog"]')
    await dialog.getByRole("button", { name: "Abandonner la série" }).click()

    await expect(this.page.getByTestId("active-series-card")).toBeHidden({
      timeout: 10_000,
    })
  }

  async waitForForm() {
    if (await this.hasActiveSession()) {
      await this.abandonActiveSession()
    }
    await expect(
      this.page.getByRole("heading", { name: "Configurer" }),
    ).toBeVisible({ timeout: 15_000 })
    // Les compteurs de révision chargés : le bouton de départ n'est plus grisé.
    await expect(this.page.getByTestId("btn-start-training")).toBeEnabled({
      timeout: 15_000,
    })
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

    await this.page.getByTestId("btn-start-training").click()
    await this.page.waitForURL(/\/tableau-de-bord\/entrainement\//, {
      timeout: 15_000,
    })
  }

  async waitForQuestion(questionNum: number, total: number) {
    await expect(
      this.page.getByRole("heading", {
        name: `Question ${questionNum} / ${total}`,
      }),
    ).toBeVisible({ timeout: 10_000 })
  }

  async selectAnswer(index: number) {
    await this.page.getByTestId(`answer-option-${index}`).click()
  }

  /** Sélectionne le mode (carte radio du formulaire de configuration). */
  async selectMode(mode: "tutor" | "test") {
    await this.page.locator(`label[for="mode-${mode}"]`).click()
  }

  /** Valide la réponse en attente (mode tuteur) → révèle la correction. */
  async validateAnswer() {
    await this.page.getByTestId("btn-validate-answer").click()
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
    await this.page.getByTestId("btn-finish").click()

    await expect(this.page.getByText("Terminer la série ?")).toBeVisible()

    const dialog = this.page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Voir les résultats" }).click()

    await this.page.waitForURL(/\/resultats/, { timeout: 15_000 })
  }

  /** Score de la page de résultats (« 72 % », espace insécable). */
  async getScore(): Promise<string> {
    return (await this.page.getByTestId("score-percentage").textContent()) ?? ""
  }

  /** Page de résultats atteinte : score affiché, ou retenu. */
  async gotoResultsFromCurrentUrl() {
    await expect(this.page).toHaveURL(/\/resultats/, { timeout: 15_000 })
    await expect(
      this.page
        .getByTestId("score-percentage")
        .or(this.page.getByTestId("score-withheld")),
    ).toBeVisible({ timeout: 15_000 })
  }

  /** Clique une case du navigateur de correction. */
  async clickNavItem(index: number) {
    await this.page
      .locator(`[data-testid="results-nav-item-${index}"]:visible`)
      .click()
  }

  /**
   * Wait for the explanation of the question at `index` (0-based) to be
   * lazy-loaded with non-empty text. Review-variant QuestionCard renders the
   * explanation inside its expanded block, identifiable by data-testid.
   */
  async waitForExplanation(index: number) {
    const questionCard = this.page.locator(`#question-${index + 1}`)
    const explanation = questionCard.getByTestId("explanation-content")
    await expect(explanation).toBeVisible({ timeout: 10_000 })
    await expect(explanation).not.toBeEmpty()
  }
}
