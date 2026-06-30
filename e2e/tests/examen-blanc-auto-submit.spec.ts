import { type APIRequestContext } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Teste que le timer de l'examen déclenche bien la soumission automatique
 * quand le temps arrive à zéro. Utilise page.clock pour avancer le temps
 * sans attendre la vraie durée de l'examen.
 *
 * Isolation (3.B) : ce fichier SEEDE son propre examen `subscribers` dédié et
 * le CONSOMME (auto-submit). Sans ça, il consommait l'unique examen actif
 * partagé et cassait les specs `examen-blanc*` suivantes (« Déjà passé »).
 */

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] AutoSubmit"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

let examId = ""

test.describe("Examen Blanc — timer expiré et auto-submit", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} Passation`,
      questionCount: 5,
    })
    examId = (await seed.json()).examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test("le toast 'Temps écoulé' apparaît et redirige vers /dashboard/examen-blanc", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    expect(examId).toBeTruthy()

    await examen.goto()
    await examen.clickStartExamById(examId)
    await examen.confirmStart()
    await examen.acceptWarningOrResume()
    await examen.waitForTimer()

    // Answer the first question so localStorage has data (toast branches on it)
    await examen.waitForQuestion(1)
    await examen.selectAnswer(0)

    // Freeze the page clock at "now" so Date.now() stops advancing on its own.
    // serverStartTime was captured before install, so elapsed time will equal
    // the fastForward delta.
    await page.clock.install({ time: new Date() })

    // Advance 3h — dépasse largement le budget-temps de l'examen seedé (5×83 s).
    await page.clock.fastForward(3 * 60 * 60 * 1000)

    // Toast confirms auto-submission
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /Temps écoulé.*enregistrées/ }),
    ).toBeVisible({ timeout: 15_000 })

    // Redirect back to the exam list (via la page « soumis »)
    await page.waitForURL(/\/dashboard\/examen-blanc/, {
      timeout: 15_000,
    })
  })
})
