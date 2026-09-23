import { type APIRequestContext, type Page } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Navigation vers une question lointaine sur une longue correction : la carte
 * visée doit être atteinte, visible, et y rester pendant que les explications
 * chargées paresseusement (la sienne, celles des cartes au-dessus) arrivent.
 *
 * Ce spec ne couvre pas les défilements doux restants (retour en haut, quiz
 * public), que protège l'absence d'animation de `height` dans `QuestionCard`.
 */

const SECRET = process.env.E2E_RESET_SECRET
const STUDENT_EMAIL =
  process.env.E2E_USER_EMAIL ?? "e2e.student@nomaqtest.local"
const PREFIX = "[E2E] ResultatsNav"
const QUESTION_COUNT = 230

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

async function expectQuestionReached(page: Page, index: number) {
  const card = page.locator(`#sr-question-${index}`)
  await expect(card).toBeInViewport({ ratio: 0.1, timeout: 8_000 })
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).opacity), {
      timeout: 2_000,
    })
    .toBe("1")
  // La carte doit rester à l'écran une fois atteinte.
  await page.waitForTimeout(1_500)
  await expect(card).toBeInViewport({ ratio: 0.1 })
}

let examId = ""

test.describe("Résultats — navigation vers une question lointaine", () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} ${QUESTION_COUNT}`,
      questionCount: QUESTION_COUNT,
      closed: true,
      completedFor: STUDENT_EMAIL,
    })
    const body = await seed.json()
    expect(body.questionCount).toBe(QUESTION_COUNT)
    examId = body.examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test.beforeEach(async ({ examenResultats, page }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    await page.setViewportSize({ width: 1440, height: 900 })
    await examenResultats.goto(examId)
  })

  for (const index of [199, 120]) {
    test(`cliquer Q${index + 1} amène sa carte à l'écran`, async ({
      examenResultats,
      page,
    }) => {
      await examenResultats.clickNavigatorItem(index)
      await expectQuestionReached(page, index)
    })
  }

  test("une question masquée par le filtre « Erreurs » reste atteignable", async ({
    examenResultats,
    page,
  }) => {
    // Seed : index pair = bonne réponse, donc masquée par le filtre.
    await examenResultats.toggleFilterIncorrect()
    await expect(page.locator("#sr-question-198")).toHaveCount(0)

    await examenResultats.clickNavigatorItem(198)
    await expectQuestionReached(page, 198)
  })
})
