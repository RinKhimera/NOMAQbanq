import { type Locator, type Page, expect } from "@playwright/test"

export class BasePage {
  readonly page: Page
  readonly navSidebar: Locator

  constructor(page: Page) {
    this.page = page
    this.navSidebar = page.locator("nav")
  }

  async goto(path: string) {
    // `page.goto` attend déjà l'événement "load". On NE PAS attendre
    // "networkidle" : en dev Next.js (HMR websocket, tunnel Sentry, fetch des
    // charts) le réseau n'atteint jamais l'état idle → `goto` pendait jusqu'au
    // timeout de test. Les POM attendent ensuite un élément explicite
    // (`waitForReady`), ce qui est la bonne synchronisation.
    await this.page.goto(path)
  }

  async navigateVia(linkText: string) {
    await this.navSidebar.getByRole("link", { name: linkText }).click()
    // Navigation client (Link Next) → pas de rechargement complet. On laisse
    // l'appelant asserter l'URL/élément cible (évite le hang "networkidle").
    await this.page.waitForLoadState("domcontentloaded")
  }

  async expectToast(message: string | RegExp) {
    await expect(
      this.page.locator("[data-sonner-toast]").filter({ hasText: message }),
    ).toBeVisible({ timeout: 5_000 })
  }

  /**
   * Click helper resistant to re-renders that detach the DOM.
   * Waits for visibility, performs a trial click to stabilize layout, then clicks.
   */
  async safeClick(locator: Locator) {
    await locator.waitFor({ state: "visible", timeout: 10_000 })
    await locator.click({ trial: true })
    await locator.click()
  }
}
