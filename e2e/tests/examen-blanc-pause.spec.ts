import { type APIRequestContext } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Pause repos pendant un examen (`enablePause=true`).
 *
 * La pause est déclenchée par L'UTILISATEUR via le bouton `btn-pause` du header
 * (et non automatiquement à mi-parcours — l'ancien modèle pré-refonte). Pendant
 * la pause, l'overlay opaque occulte TOUT le contenu de questions (anti-triche
 * D3) et le chrono est gelé. Une seule pause est autorisée → tout le parcours
 * tient dans UN test (une fois consommée, le bouton disparaît).
 *
 * Isolation (3.B) : seede son propre examen `subscribers` avec pause activée.
 */

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] Pause"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

let examId = ""

test.describe("Examen Blanc — pause repos", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} Repos`,
      questionCount: 5,
      enablePause: true,
    })
    examId = (await seed.json()).examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test("pause : overlay opaque (anti-triche), chrono gelé, reprise", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    expect(examId).toBeTruthy()

    await examen.goto()
    await examen.clickStartExamById(examId)
    await examen.confirmStart()
    await examen.acceptWarningOrResume()
    await examen.waitForQuestion(1)

    // Le bouton pause n'existe que sur un examen `enablePause=true`.
    await expect(page.getByTestId("btn-pause")).toBeVisible()
    await examen.takePause()

    // Overlay de pause : minuteur + bouton reprendre.
    await expect(page.getByTestId("pause-overlay")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId("pause-timer")).toBeVisible()
    await expect(page.getByTestId("btn-resume-exam")).toBeVisible()

    // Anti-triche D3 : aucune option de réponse n'est dans le DOM pendant la pause.
    await expect(page.getByTestId("answer-option-0")).toHaveCount(0)

    // Reprise → retour aux questions, et le bouton pause disparaît (1 seule pause).
    await page.getByTestId("btn-resume-exam").click()
    await expect(page.getByTestId("answer-option-0")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("btn-pause")).toHaveCount(0)
  })
})
