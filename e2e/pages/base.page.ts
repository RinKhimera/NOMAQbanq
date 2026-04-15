import { type Locator, type Page, expect } from "@playwright/test"

export class BasePage {
  readonly page: Page
  readonly navSidebar: Locator

  constructor(page: Page) {
    this.page = page
    this.navSidebar = page.locator("nav")
  }

  async goto(path: string) {
    await this.page.goto(path)
    await this.page.waitForLoadState("networkidle")
  }

  async navigateVia(linkText: string) {
    await this.navSidebar.getByRole("link", { name: linkText }).click()
    await this.page.waitForLoadState("networkidle")
  }

  async expectToast(message: string | RegExp) {
    await expect(
      this.page.locator("[data-sonner-toast]").filter({ hasText: message }),
    ).toBeVisible({ timeout: 5_000 })
  }

  /**
   * Click helper resistant to Convex real-time re-renders that detach the DOM.
   * Waits for visibility, performs a trial click to stabilize layout, then clicks.
   */
  async safeClick(locator: Locator) {
    await locator.waitFor({ state: "visible", timeout: 10_000 })
    await locator.click({ trial: true })
    await locator.click()
  }
}
