import { expect, test } from "../fixtures/base"

/**
 * Couverture F3 — images d'explication : garantie ANTI-TRICHE.
 *
 * Les images d'explication (`kind='explanation'`) ne doivent JAMAIS apparaître
 * pendant la passation — uniquement à la correction (QuestionCard variant
 * "review"). On seed une image sur la 1re question d'un examen, on entre en
 * passation, et on vérifie que ni `explanation-images` ni `explanation-content`
 * ne sont rendus (la DAL de passation ne lit pas le canal explication).
 *
 * Compte test = `E2E_USER` (student), membre de l'audience → éligible.
 */

const SECRET = process.env.E2E_RESET_SECRET
const STUDENT_EMAIL =
  process.env.E2E_USER_EMAIL ?? "e2e.student@nomaqtest.local"
const PREFIX = "[E2E] Explication"

let examId = ""

test.describe("Examen — images d'explication (F3 anti-triche)", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    // Retire l'image seedée (question partagée de la banque, non couverte par la
    // cascade d'examen) puis supprime l'examen seedé.
    if (examId) {
      await request.post("/api/e2e", {
        data: {
          secret: SECRET,
          action: "seed-explanation-image",
          examId,
          remove: true,
        },
        failOnStatusCode: false,
      })
    }
    await request.post("/api/e2e", {
      data: { secret: SECRET, action: "cleanup", prefix: PREFIX },
      failOnStatusCode: false,
    })
  })

  test("l'image d'explication n'apparaît jamais pendant la passation", async ({
    examen,
    page,
    request,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    // Examen restreint (student membre → éligible) + image d'explication sur Q1.
    const seed = await request.post("/api/e2e", {
      data: {
        secret: SECRET,
        action: "seed-restricted-exam",
        title: `${PREFIX} Passation`,
        audienceUserEmails: [STUDENT_EMAIL],
        questionCount: 3,
      },
    })
    examId = (await seed.json()).examId
    expect(examId).toBeTruthy()

    const img = await request.post("/api/e2e", {
      data: { secret: SECRET, action: "seed-explanation-image", examId },
    })
    expect((await img.json()).questionId).toBeTruthy()

    // Entrer en passation sur CET examen (carte ciblée par testid).
    await examen.goto()
    const card = page.getByTestId(`exam-card-${examId}`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.getByRole("button", { name: "Commencer l'examen" }).click()
    await examen.confirmStart()
    await examen.acceptWarningOrResume()
    await examen.waitForQuestion(1)

    // Anti-triche : malgré la ligne `question_images kind='explanation'` en base,
    // aucune image NI bloc d'explication n'est rendu pendant la passation.
    await expect(page.getByTestId("explanation-images")).toHaveCount(0)
    await expect(page.getByTestId("explanation-content")).toHaveCount(0)
  })
})
