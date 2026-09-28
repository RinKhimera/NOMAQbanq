import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

type NavItemState = "correct" | "incorrect" | "unanswered"

export class ExamenResultatsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(examId: string) {
    await super.goto(`/tableau-de-bord/examen-blanc/${examId}/resultats`)
    await this.waitForScore()
  }

  async waitForScore() {
    await expect(this.page.getByTestId("score-percentage")).toBeVisible({
      timeout: 15_000,
    })
  }

  async getScorePercent(): Promise<number> {
    const text =
      (await this.page.getByTestId("score-percentage").textContent()) ?? ""
    const match = text.match(/(\d+)\s?%/)
    return match ? Number(match[1]) : 0
  }

  async getBadgeText(): Promise<string> {
    return (await this.page.getByTestId("score-badge").textContent()) ?? ""
  }

  async clickNavigatorItem(index: number) {
    // La colonne du navigateur reste dans le DOM sous 1024 px, masquée : on
    // vise la case visible (colonne, ou Sheet ouvert).
    await this.page
      .locator(`[data-testid="results-nav-item-${index}"]:visible`)
      .click()
  }

  async getNavItemState(index: number): Promise<NavItemState> {
    const state = await this.page
      .locator(`[data-testid="results-nav-item-${index}"]:visible`)
      .getAttribute("data-state")
    return (state as NavItemState) ?? "unanswered"
  }

  async countNavItems(): Promise<number> {
    return this.page.locator('[data-testid^="results-nav-item-"]').count()
  }

  async toggleFilterIncorrect() {
    await this.page.getByTestId("btn-filter-errors").click()
  }

  async countVisibleQuestions(): Promise<number> {
    // Review cards have id="question-{n}" (set on QuestionCard when variant=review)
    return this.page.locator('[id^="question-"]').count()
  }

  async expandAll() {
    await this.page.getByRole("button", { name: "Tout déplier" }).click()
  }

  async collapseAll() {
    await this.page.getByRole("button", { name: "Tout replier" }).click()
  }
}
