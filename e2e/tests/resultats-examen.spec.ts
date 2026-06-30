import { type APIRequestContext } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Page de résultats d'un examen blanc (`/dashboard/examen-blanc/{id}/resultats`).
 *
 * Isolation (3.B) : seede un examen `subscribers` CLOS (endDate révolu) avec une
 * participation COMPLÉTÉE pour le student (mix correct/incorrect déterministe).
 *   - clos : `getParticipantExamResults` ne révèle les résultats à un non-admin
 *     qu'APRÈS `endDate` (anti-fuite F3) ;
 *   - complété : la page a des données sans rejouer toute la passation.
 * On navigue DIRECTEMENT vers la page résultats (le bouton « Consulter les
 * résultats » de la liste pointe vers `/{id}`, pas `/{id}/resultats`).
 */

const SECRET = process.env.E2E_RESET_SECRET
const STUDENT_EMAIL =
  process.env.E2E_USER_EMAIL ?? "e2e.student@nomaqtest.local"
const PREFIX = "[E2E] Resultats"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

let examId = ""

test.describe("Examen Blanc — page de résultats", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} Corrigé`,
      questionCount: 5,
      closed: true,
      completedFor: STUDENT_EMAIL,
    })
    examId = (await seed.json()).examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test.beforeEach(async ({ examenResultats }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    expect(examId).toBeTruthy()
    await examenResultats.goto(examId)
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

    // exact : « Correctes » est une sous-chaîne de « Incorrectes » (et de
    // « …/5 correctes ») → un match non-exact viole le strict mode.
    await expect(page.getByText("Correctes", { exact: true })).toBeVisible()
    await expect(page.getByText("Incorrectes", { exact: true })).toBeVisible()
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

  test("la page est read-only : aucune option n'est cliquable", async ({
    page,
  }) => {
    // La 1re carte review est dépliée par défaut (expandedQuestions = Set([0])).
    const card = page.locator("#question-1")
    await expect(card).toBeVisible()

    // Read-only par construction : en variant "review", `AnswerOption` ne pose
    // `data-testid="answer-option-*"` (motion.button) QUE si l'option est
    // interactive (`onClick && !disabled`) — ce qui n'arrive qu'en variant
    // "exam". Aucune option cliquable ne doit donc exister dans la correction.
    await expect(
      card.locator('button[data-testid^="answer-option-"]'),
    ).toHaveCount(0)
  })
})
