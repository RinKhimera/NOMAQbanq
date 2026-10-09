import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class ExamenBlancPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/tableau-de-bord/examen-blanc")
    await this.page
      .getByRole("heading", { level: 1, name: "Examens blancs" })
      .waitFor({ state: "visible", timeout: 15_000 })
  }

  async clickStartExam() {
    await this.page
      .getByRole("button", { name: "Commencer l'examen" })
      .first()
      .click()
  }

  /** Démarre un examen CIBLÉ par son id (carte `exam-card-{id}`) — isole les
   *  specs qui seedent leur propre examen des autres cartes de la liste. */
  async clickStartExamById(examId: string) {
    const card = this.page.getByTestId(`exam-card-${examId}`)
    await card.scrollIntoViewIfNeeded()
    await card.getByRole("button", { name: "Commencer l'examen" }).click()
  }

  /** Clique le bouton de pause du header (visible seulement si l'examen a
   *  `enablePause=true`). La pause est déclenchée par l'utilisateur, pas
   *  automatiquement à mi-parcours. */
  async takePause() {
    await this.page.getByTestId("btn-pause").click()
  }

  /**
   * Dialogue des consignes : coche « J'ai lu les consignes », puis
   * « Commencer l'examen ». La participation se crée ici (startExam) ; la page
   * de passation s'ouvre directement sur le chronomètre.
   */
  async confirmStart() {
    const dialog = this.page.getByTestId("exam-start-dialog")
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText("J'ai lu les consignes.")).toBeVisible()
    await dialog.getByTestId("exam-consignes-ack").click()
    await dialog.getByTestId("btn-start-exam").click()

    await this.page.waitForURL(/\/evaluation/, { timeout: 15_000 })
  }

  /** La passation s'ouvre sur le chronomètre : plus de dialogue de règles. */
  async acceptWarning() {
    await this.waitForTimer()
  }

  /** Même chose qu'un démarrage : une reprise arrive aussi sur le chronomètre. */
  async acceptWarningOrResume() {
    await this.waitForTimer()
  }

  async waitForTimer() {
    await expect(this.page.locator("text=/\\d{2}:\\d{2}:\\d{2}/")).toBeVisible({
      timeout: 15_000,
    })
  }

  async getTimerText(): Promise<string> {
    const timer = this.page.locator("text=/\\d{2}:\\d{2}:\\d{2}/").first()
    return (await timer.textContent()) ?? ""
  }

  /** Parse timer "HH:MM:SS" text and return remaining time in milliseconds */
  async getTimerMs(): Promise<number> {
    const text = await this.getTimerText()
    const match = text.match(/(\d{2}):(\d{2}):(\d{2})/)
    if (!match) return 0
    const [, h, m, s] = match
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000
  }

  /** Answer and navigate through `count` questions (for auto-submit scenarios) */
  async answerAllQuestions(count: number) {
    for (let i = 1; i <= count; i++) {
      await this.waitForQuestion(i)
      await this.selectAnswer(0)
      if (i < count) {
        await this.nextQuestion()
      }
    }
  }

  async waitForQuestion(questionNum: number) {
    await expect(
      this.page.getByRole("heading", {
        name: new RegExp(`^Question ${questionNum} /`),
      }),
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
    await dialog.getByRole("button", { name: "Soumettre", exact: true }).click()

    await this.page.waitForURL(/\/tableau-de-bord\/examen-blanc/, {
      timeout: 15_000,
    })
  }

  /** « Résultats » de la première ligne d'examen terminé : son classement. */
  async goToRanking() {
    await this.page
      .getByRole("link", { name: /^Résultats/ })
      .first()
      .click()
    await this.page.waitForURL(/\/examen-blanc\/[^/]+$/, { timeout: 15_000 })
  }
}
