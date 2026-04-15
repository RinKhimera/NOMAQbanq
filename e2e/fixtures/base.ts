/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture `use` is not a React hook */
import { test as base, expect } from "@playwright/test"
import { EntrainementPage } from "../pages/entrainement.page"
import { ExamenBlancPage } from "../pages/examen-blanc.page"
import { ExamenResultatsPage } from "../pages/examen-resultats.page"

type Fixtures = {
  entrainement: EntrainementPage
  examen: ExamenBlancPage
  examenResultats: ExamenResultatsPage
  /**
   * POST /e2e/reset-exam on the Convex HTTP site. Useful to reset mid-test
   * without relying on global setup only. Requires E2E_RESET_SECRET +
   * NEXT_PUBLIC_CONVEX_URL in the env.
   */
  resetExamState: (userEmail: string) => Promise<void>
}

export const test = base.extend<Fixtures>({
  entrainement: async ({ page }, use) => {
    await use(new EntrainementPage(page))
  },
  examen: async ({ page }, use) => {
    await use(new ExamenBlancPage(page))
  },
  examenResultats: async ({ page }, use) => {
    await use(new ExamenResultatsPage(page))
  },
  resetExamState: async ({ request }, use) => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    const secret = process.env.E2E_RESET_SECRET

    const reset = async (userEmail: string) => {
      if (!convexUrl || !secret) {
        console.warn(
          "[e2e fixtures] NEXT_PUBLIC_CONVEX_URL or E2E_RESET_SECRET missing — skipping reset",
        )
        return
      }
      const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site")
      await request.post(`${siteUrl}/e2e/reset-exam`, {
        data: { secret, userEmail },
        failOnStatusCode: false,
      })
    }

    await use(reset)
  },
})

export { expect }
