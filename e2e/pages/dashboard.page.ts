import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/tableau-de-bord")
  }

  async waitForReady() {
    // Wait for the greeting text to appear (Bonjour/Bon après-midi/Bonsoir)
    await expect(
      this.page
        .locator("h1")
        .filter({ hasText: /Bonjour|Bon après-midi|Bonsoir/ }),
    ).toBeVisible({ timeout: 15_000 })
  }

  async expectVitalCardsVisible() {
    // Libellés dupliqués après F1 (carte vitale + stats/CTA) → exact + first
    // pour cibler une occurrence stable (assertion de présence des cartes).
    const main = this.page.locator("main")
    await expect(
      main.getByText("Score moyen", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      main.getByText("Examens complétés", { exact: true }).first(),
    ).toBeVisible()
    await expect(
      main.getByText("Taux de complétion", { exact: true }).first(),
    ).toBeVisible()
    await expect(
      main.getByText("Entraînements", { exact: true }).first(),
    ).toBeVisible()
  }

  async clickQuickAccess(title: string) {
    // testid stable : le lien de la carte ET un CTA pointent vers la même URL
    // (ex. /entrainement) → getByRole("link", { name }) est ambigu.
    await this.page.getByTestId(`quick-access-${title}`).click()
    // Pas de "networkidle" (jamais atteint en dev Next.js → hang). L'appelant
    // asserte l'URL cible (qui a son propre retry).
    await this.page.waitForLoadState("domcontentloaded")
  }
}
