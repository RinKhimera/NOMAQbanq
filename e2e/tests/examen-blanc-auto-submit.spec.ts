import { expect, test } from "../fixtures/base"

/**
 * Teste que le timer de l'examen déclenche bien la soumission automatique
 * quand le temps arrive à zéro. Utilise page.clock pour avancer le temps
 * sans attendre la vraie durée de l'examen (10+ minutes).
 */
test.describe("Examen Blanc — timer expiré et auto-submit", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  test("le toast 'Temps écoulé' apparaît et redirige vers /dashboard/examen-blanc", async ({
    examen,
    page,
  }) => {
    await examen.goto()

    // Skip if no active exam can be started (already passed, etc.)
    const startBtn = page.getByRole("button", { name: "Commencer l'examen" })
    if (!(await startBtn.first().isVisible().catch(() => false))) {
      test.skip(true, "Aucun examen actif à démarrer pour tester auto-submit")
      return
    }

    await examen.clickStartExam()
    await examen.confirmStart()
    await examen.acceptWarningOrResume()
    await examen.waitForTimer()

    // Answer the first question so localStorage has data (toast branches on it)
    await examen.waitForQuestion(1)
    await examen.selectAnswer(0)

    // Freeze the page clock at "now" so Date.now() stops advancing on its own.
    // The Convex serverStartTime was captured before install, so elapsed time
    // will equal the fastForward delta.
    await page.clock.install({ time: new Date() })

    // Advance 3h — covers any realistic exam completionTime (typically ≤ 2h).
    await page.clock.fastForward(3 * 60 * 60 * 1000)

    // Toast confirms auto-submission
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /Temps écoulé.*enregistrées/ }),
    ).toBeVisible({ timeout: 15_000 })

    // Redirect back to the exam list
    await page.waitForURL(/\/dashboard\/examen-blanc(?!\/)/, {
      timeout: 15_000,
    })
  })
})
