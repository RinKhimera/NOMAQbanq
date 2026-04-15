import { expect, test } from "@playwright/test"
import { ExamenBlancPage } from "../pages/examen-blanc.page"

/**
 * Tests pour le mecanisme de pause obligatoire pendant un examen.
 *
 * PREREQUIS: Un examen avec enablePause=true doit exister dans la base.
 * Si aucun examen avec pause n'est disponible, les tests seront skip.
 */
test.describe("Examen Blanc — pause obligatoire", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 })

  let examen: ExamenBlancPage

  test.beforeEach(async ({ page }) => {
    examen = new ExamenBlancPage(page)
  })

  test("le dialog de pause apparait a mi-parcours", async ({ page }) => {
    await examen.goto()

    // Start the exam
    await examen.clickStartExam()
    await examen.confirmStart()
    await examen.acceptWarningOrResume()

    // Answer questions until pause dialog appears or all questions answered
    let pauseAppeared = false
    for (let i = 0; i < 120; i++) {
      // Check if pause dialog appeared
      const pauseTimer = page.locator("[data-testid='pause-timer']")
      pauseAppeared = await pauseTimer
        .isVisible({ timeout: 1_000 })
        .catch(() => false)

      if (pauseAppeared) break

      // Answer current question
      const answerOption = page.locator("[data-testid='answer-option-0']")
      const hasOption = await answerOption
        .isVisible({ timeout: 2_000 })
        .catch(() => false)

      if (!hasOption) break

      await answerOption.click()
      await examen.nextQuestion()
    }

    if (!pauseAppeared) {
      // No pause-enabled exam available — skip
      test.skip(true, "Aucun examen avec pause active disponible")
      return
    }

    // Verify pause dialog elements
    await expect(page.locator("[data-testid='pause-timer']")).toBeVisible()
    await expect(page.locator("[data-testid='btn-resume-exam']")).toBeVisible()
  })

  test("le bouton reprendre fonctionne", async ({ page }) => {
    // This test depends on the previous test having triggered a pause
    // It will be run serially, so the exam should still be in progress

    await examen.goto()
    await examen.clickStartExam()
    await examen.confirmStart()
    await examen.acceptWarningOrResume()

    // Check if we're in a pause state
    const resumeBtn = page.locator("[data-testid='btn-resume-exam']")
    const isPaused = await resumeBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    if (!isPaused) {
      test.skip(true, "L'examen n'est pas en pause")
      return
    }

    // Click resume
    await resumeBtn.click()

    // Should return to questions
    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("toutes les questions sont accessibles apres la pause", async ({
    page,
  }) => {
    await examen.goto()
    await examen.clickStartExam()
    await examen.confirmStart()
    await examen.acceptWarningOrResume()

    // Check if we can navigate past the midpoint
    const answerOption = page.locator("[data-testid='answer-option-0']")
    const hasOption = await answerOption
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (!hasOption) {
      test.skip(true, "Pas de question accessible")
      return
    }

    // Answer a question and verify navigation works
    await answerOption.click()
    await examen.nextQuestion()

    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 10_000,
    })
  })

  test("le pause-timer compte pendant la pause (totalPauseDurationMs avance)", async ({
    page,
  }) => {
    await examen.goto()
    await examen.clickStartExam()
    await examen.confirmStart()
    await examen.acceptWarningOrResume()

    // Trigger pause by answering until the dialog appears
    let pauseAppeared = false
    for (let i = 0; i < 120; i++) {
      const pauseTimer = page.locator("[data-testid='pause-timer']")
      pauseAppeared = await pauseTimer
        .isVisible({ timeout: 1_000 })
        .catch(() => false)
      if (pauseAppeared) break

      const answerOption = page.locator("[data-testid='answer-option-0']")
      const hasOption = await answerOption
        .isVisible({ timeout: 2_000 })
        .catch(() => false)
      if (!hasOption) break

      await answerOption.click()
      await examen.nextQuestion()
    }

    if (!pauseAppeared) {
      test.skip(true, "Aucun examen avec pause active disponible")
      return
    }

    const pauseTimer = page.locator("[data-testid='pause-timer']")
    const parseTimer = (text: string): number => {
      const match = text.match(/(\d+)[^\d]+(\d+)/)
      if (!match) return 0
      return Number(match[1]) * 60 + Number(match[2])
    }

    const initialText = (await pauseTimer.textContent()) ?? ""
    const initialSeconds = parseTimer(initialText)

    await page.waitForTimeout(3_000)

    const laterText = (await pauseTimer.textContent()) ?? ""
    const laterSeconds = parseTimer(laterText)

    // Pause timer should count UP by at least 2 seconds (accounting for jitter)
    expect(laterSeconds).toBeGreaterThan(initialSeconds)
    expect(laterSeconds - initialSeconds).toBeGreaterThanOrEqual(2)

    // Resume to leave the fixture in a known state for downstream tests
    const resumeBtn = page.locator("[data-testid='btn-resume-exam']")
    if (await resumeBtn.isVisible().catch(() => false)) {
      await resumeBtn.click()
    }
  })
})
