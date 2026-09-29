import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base.page"

export class PaymentPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async gotoTarifs() {
    await super.goto("/tarifs")
    await expect(
      this.page.getByText("Choisissez votre plan de préparation"),
    ).toBeVisible({ timeout: 15_000 })
  }

  async gotoAbonnements() {
    await super.goto("/tableau-de-bord/abonnements")
    await expect(
      this.page.getByRole("heading", { name: "Abonnements et accès" }),
    ).toBeVisible({ timeout: 15_000 })
  }

  async gotoPaymentSuccess() {
    await this.page.goto("/tableau-de-bord/paiement/succes")
  }

  async expectNoPaywall() {
    await expect(this.page.getByText("Nouvelle session")).toBeVisible({
      timeout: 15_000,
    })
  }

  async expectActiveAccess(type: "training" | "exam") {
    const label = type === "training" ? "Entraînement" : "Examens"
    await expect(
      this.page.getByText(new RegExp(`${label}.*|.*restants?`, "i")),
    ).toBeVisible({ timeout: 15_000 })
  }
}
