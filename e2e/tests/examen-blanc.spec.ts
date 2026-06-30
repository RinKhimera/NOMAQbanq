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

  test("journey complet : confirmation → warning → timer → réponses → submit", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    await examen.goto()
    await examen.clickStartExamById(examId)

    // Confirmation dialog content
    await expect(page.getByText("Confirmer le début de l'examen")).toBeVisible()
    await expect(page.getByText(/questions à répondre/)).toBeVisible()
    await expect(page.getByText(/minutes pour compléter/)).toBeVisible()
    await expect(page.getByText("Un seul essai")).toBeVisible()

    // Proceed via the dialog CTA
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Commencer l'examen" }).click()
    await page.waitForURL(/\/evaluation/, { timeout: 15_000 })

    // Warning anti-fraude
    await expect(page.getByText("Règles importantes de l'examen")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Mesures anti-fraude activées")).toBeVisible()
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
      page.locator("[data-sonner-toast]").filter({ hasText: /terminé/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("affiche l'état « Déjà passé » et les stats après soumission", async ({
    examen,
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    await examen.goto()

    // La carte de l'examen seedé bascule sur « Déjà passé » (preuve que la
    // soumission a été enregistrée pour CET examen).
    const card = page.getByTestId(`exam-card-${examId}`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card.getByText("Déjà passé")).toBeVisible()

    // Bloc de stats agrégées présent (regex tolérante au pluriel / au compte —
    // ne couple pas l'assertion à l'état global des autres examens).
    await expect(page.getByText(/examens? passés?/)).toBeVisible()
    await expect(page.getByText(/Score moyen/)).toBeVisible()
  })
})
