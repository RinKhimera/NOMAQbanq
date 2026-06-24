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
   * POST /api/e2e (action "reset-exam"). Réinitialise l'examen en cours de test
   * sans dépendre du global setup. Requiert `E2E_RESET_SECRET` dans l'env.
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
    const secret = process.env.E2E_RESET_SECRET

    const reset = async (userEmail: string) => {
      if (!secret) {
        console.warn(
          "[e2e fixtures] E2E_RESET_SECRET manquant — reset ignoré",
        )
        return
      }
      await request.post("/api/e2e", {
        data: { secret, action: "reset-exam", userEmail },
        failOnStatusCode: false,
      })
    }

    await use(reset)
  },
})

export { expect }
