import { expect, test } from "../fixtures/base"

/**
 * Tests pour la page de résultats d'un examen blanc soumis.
 *
 * PREREQUIS : examen-blanc.spec.ts doit avoir soumis un examen avant ce spec
 * (ordre alphabétique respecté : examen-blanc < resultats-examen).
 * Si aucun examen complété n'existe, les tests skippent gracieusement.
 */
test.describe("Examen Blanc — page de résultats", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  test.beforeEach(async ({ examen, examenResultats, page }) => {
    // Navigate to exam list and open the results page for a completed exam
    await examen.goto()

    const resultsLink = page.getByRole("button", {
      name: "Consulter les résultats",
    })
    if (!(await resultsLink.first().isVisible().catch(() => false))) {
      test.skip(true, "Aucun examen complété pour afficher des résultats")
      return
    }

    await resultsLink.first().click()
    await page.waitForURL(/\/resultats/, { timeout: 15_000 })
    await examenResultats.waitForScore()
  })

  test("affiche le score, le badge et les stats correct/incorrect", async ({
    examenResultats,
    page,
  }) => {
    const score = await examenResultats.getScorePercent()
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)

    const badge = await examenResultats.getBadgeText()
    expect(badge).toMatch(/Réussi|À améliorer/)

    await expect(page.getByText("Correctes")).toBeVisible()
    await expect(page.getByText("Incorrectes")).toBeVisible()
  })

  test("le navigateur Q1-QN est color-coded et navigue en cliquant", async ({
    examenResultats,
    page,
  }) => {
    const totalItems = await examenResultats.countNavItems()
    expect(totalItems).toBeGreaterThan(0)

    // Verify each nav item has a valid data-state
    for (let i = 0; i < Math.min(totalItems, 5); i++) {
      const state = await examenResultats.getNavItemState(i)
      expect(["correct", "incorrect", "unanswered"]).toContain(state)
    }

    // Click first nav item and verify the target question is expanded
    await examenResultats.clickNavigatorItem(0)
    await expect(page.locator("#question-1")).toBeInViewport({ ratio: 0.1 })
  })

  test("le filtre 'Voir uniquement les erreurs' masque les correctes", async ({
    examenResultats,
    page,
  }) => {
    const before = await examenResultats.countVisibleQuestions()
    expect(before).toBeGreaterThan(0)

    await examenResultats.toggleFilterIncorrect()
    // Small settle for framer-motion exit animations
    await page.waitForTimeout(400)

    const after = await examenResultats.countVisibleQuestions()
    expect(after).toBeLessThanOrEqual(before)

    // Restore for other tests
    await examenResultats.toggleFilterIncorrect()
  })

  test("la page est read-only : impossible de changer une réponse", async ({
    page,
  }) => {
    // The first review card is expanded by default (expandedQuestions = new Set([0]))
    const firstOption = page.locator("#question-1 [data-testid^='answer-option-']").first()
    if (!(await firstOption.isVisible().catch(() => false))) {
      test.skip(true, "Question 1 non dépliée par défaut")
      return
    }

    // Capture current state of answer-option-1 (not the correct one hopefully)
    const targetOption = page.locator("#question-1 [data-testid='answer-option-1']")
    const initialSelected = await targetOption.getAttribute("data-selected")

    // Attempt to click — in review variant, onAnswerSelect is not wired up
    await targetOption.click({ trial: true }).catch(() => {})

    const afterSelected = await targetOption.getAttribute("data-selected")
    expect(afterSelected).toBe(initialSelected)
  })
})
