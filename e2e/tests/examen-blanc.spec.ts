import { type APIRequestContext } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Tests "journey" pour l'examen blanc : tout le flow (list → confirm dialog →
 * warning anti-fraude → timer → questions → submit → post-submit state) dans
 * un seul test pour éviter de répéter le setup d'auth.
 *
 * Isolation (3.B) : ce fichier SEEDE son propre examen `subscribers` dédié
 * (`exam-card-{id}` ciblé) au lieu de l'unique examen actif partagé → plus de
 * collision avec auto-submit / pause / resultats.
 */

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] Journey"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

let examId = ""

test.describe("Examen Blanc — session complete", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} Complet`,
      questionCount: 5,
    })
    examId = (await seed.json()).examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test("affiche la liste des examens avec un examen actif", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    expect(examId).toBeTruthy()

    await examen.goto()
    const card = page.getByTestId(`exam-card-${examId}`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(
      card.getByRole("button", { name: "Commencer l'examen" }),
    ).toBeVisible()
  })

  test("journey complet : consignes → timer → réponses → submit", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    await examen.goto()
    await examen.clickStartExamById(examId)

    // Dialogue des consignes : le bouton n'est actif qu'une fois les consignes lues.
    const dialog = page.getByTestId("exam-start-dialog")
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/Le chronomètre démarre immédiatement/),
    ).toBeVisible()
    await expect(dialog.getByText(/Une seule tentative/)).toBeVisible()
    await expect(dialog.getByTestId("btn-start-exam")).toBeDisabled()

    // La participation se crée depuis le dialogue ; la passation s'ouvre sur le chrono.
    await examen.confirmStart()
    await examen.acceptWarningOrResume()

    // Timer + first question
    await examen.waitForTimer()
    expect(await examen.getTimerText()).toMatch(/\d{2}:\d{2}:\d{2}/)
    await examen.waitForQuestion(1)
    await expect(page.getByTestId("btn-next")).toBeVisible()

    // Answer Q1, navigate to Q2, back to Q1 → answer must persist
    await examen.selectAnswer(0)
    await examen.nextQuestion()
    await examen.waitForQuestion(2)
    await examen.selectAnswer(1)
    await examen.prevQuestion()
    await examen.waitForQuestion(1)
    await expect(
      page.locator('[data-testid="answer-option-0"][data-selected="true"]'),
    ).toBeVisible()

    // Submit from header
    await examen.submitExam()
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /soumis/i }),
    ).toBeVisible({ timeout: 10_000 })
    // Page « soumis » : la date de publication des résultats.
    await expect(
      page.getByRole("heading", { level: 1, name: /soumis$/ }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/publiés à la fermeture/)).toBeVisible()
  })

  test("affiche la carte « Soumis » et les chiffres après soumission", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    await examen.goto()

    // La carte de l'examen seedé (encore ouvert) passe en « Soumis », sans
    // score ni bouton : preuve que la soumission vise CET examen.
    const card = page.getByTestId(`exam-card-${examId}`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card).toHaveAttribute("data-state", "submitted")
    await expect(card.getByText("Soumis", { exact: true })).toBeVisible()
    await expect(card.getByText(/Résultats publiés le/)).toBeVisible()
    await expect(
      card.getByRole("button", { name: "Commencer l'examen" }),
    ).toHaveCount(0)

    // Chiffres d'en-tête (VitalCard).
    await expect(page.getByText("Examens passés")).toBeVisible()
    await expect(page.getByText("Score moyen")).toBeVisible()
  })
})
