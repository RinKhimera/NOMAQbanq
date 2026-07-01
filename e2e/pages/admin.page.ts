import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class AdminPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await super.goto("/admin")
  }

  async waitForReady() {
    // "Tableau de bord" apparaît 3× (lien sidebar + h1 header + h1 page) → cibler
    // un heading (le premier = h1 du header sticky).
    await expect(
      this.page.getByRole("heading", { name: "Tableau de bord" }).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async expectVitalCardsVisible() {
    // exact + first : "Utilisateurs" matche aussi le lien "Gérer les utilisateurs".
    const main = this.page.locator("main")
    await expect(
      main.getByText("Revenus CAD (30j)", { exact: true }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      main.getByText("Utilisateurs", { exact: true }).first(),
    ).toBeVisible()
    await expect(
      main.getByText("Examens actifs", { exact: true }).first(),
    ).toBeVisible()
    await expect(
      main.getByText("Accès expirant", { exact: true }).first(),
    ).toBeVisible()
  }

  async clickQuickAction(label: string) {
    const main = this.page.locator("main")
    await main.getByText(label, { exact: true }).click()
    // Pas de "networkidle" (jamais atteint en dev Next.js → hang). L'appelant
    // asserte l'URL/élément cible (qui a son propre retry).
    await this.page.waitForLoadState("domcontentloaded")
  }
}
