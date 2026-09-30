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
    // "Tableau de bord" apparaît dans la SideNav, la barre du haut et le h1 de
    // la page → cibler le heading.
    await expect(
      this.page.getByRole("heading", { name: "Tableau de bord" }).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async expectStatBandVisible() {
    const main = this.page.locator("main")
    for (const label of [
      "Revenus 30 jours",
      "Utilisateurs",
      "Examens actifs",
      "Accès expirant",
    ])
      await expect(main.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })
  }

  async clickQuickAction(label: string) {
    // « Enregistrer un paiement » est aussi l'action de l'en-tête : le
    // raccourci est le dernier de la page.
    const main = this.page.locator("main")
    await main.getByText(label, { exact: true }).last().click()
    // Pas de "networkidle" (jamais atteint en dev Next.js → hang). L'appelant
    // asserte l'URL/élément cible (qui a son propre retry).
    await this.page.waitForLoadState("domcontentloaded")
  }
}
