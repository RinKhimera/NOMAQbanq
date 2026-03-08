import { expect, test } from "@playwright/test"
import { ExamenBlancPage } from "../pages/examen-blanc.page"

test.describe("Examen Blanc — session complete", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  let exam: ExamenBlancPage

  test.beforeEach(async ({ page }) => {
    exam = new ExamenBlancPage(page)
  })

  test("affiche la liste des examens avec un examen actif", async ({
    page,
  }) => {
    await exam.goto()

    await expect(
      page.getByRole("button", { name: "Commencer l'examen" }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("affiche le dialog de confirmation avant de commencer", async ({
    page,
  }) => {
    await exam.goto()
    await exam.clickStartExam()

    // Dialog de confirmation visible
    await expect(page.getByText("Confirmer le début de l'examen")).toBeVisible()
    await expect(page.getByText(/questions à répondre/)).toBeVisible()
    await expect(page.getByText(/minutes pour compléter/)).toBeVisible()
    await expect(page.getByText("Un seul essai autorisé")).toBeVisible()

    // Annuler ferme le dialog
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Annuler" }).click()
    await expect(page.getByText("Confirmer le début de l'examen")).toBeHidden()
  })

  test("demarre l'examen et affiche le warning anti-fraude", async ({
    page,
  }) => {
    await exam.goto()
    await exam.clickStartExam()
    await exam.confirmStart()

    // Warning dialog visible
    await expect(page.getByText("Règles importantes de l'examen")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Mesures anti-fraude activées")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Je comprends.*Commencer/ }),
    ).toBeVisible()
  })

  test("lance le timer et affiche les questions", async ({ page }) => {
    await exam.goto()
    await exam.clickStartExam()
    await exam.confirmStart()
    await exam.acceptWarning()

    // Timer visible
    await exam.waitForTimer()
    const timerText = await exam.getTimerText()
    expect(timerText).toMatch(/\d{2}:\d{2}:\d{2}/)

    // Premiere question visible
    await exam.waitForQuestion(1)

    // Navigation buttons
    await expect(page.getByTestId("btn-next")).toBeVisible()
  })

  test("repond aux questions avec persistance", async ({ page }) => {
    await exam.goto()
    await exam.clickStartExam()
    await exam.confirmStart()
    await exam.acceptWarningOrResume()

    // Q1 — selectionner une reponse
    await exam.waitForQuestion(1)
    await exam.selectAnswer(0)

    // Q2 — selectionner une reponse
    await exam.nextQuestion()
    await exam.waitForQuestion(2)
    await exam.selectAnswer(1)

    // Revenir a Q1 — la reponse doit persister
    await exam.prevQuestion()
    await exam.waitForQuestion(1)

    // Verifier qu'une option est selectionnee (data-selected="true")
    await expect(
      page.locator('[data-testid="answer-option-0"][data-selected="true"]'),
    ).toBeVisible()
  })

  test("soumet l'examen manuellement", async ({ page }) => {
    await exam.goto()
    await exam.clickStartExam()
    await exam.confirmStart()
    await exam.acceptWarningOrResume()

    // Repondre a 2 questions
    await exam.waitForQuestion(1)
    await exam.selectAnswer(0)
    await exam.nextQuestion()

    await exam.waitForQuestion(2)
    await exam.selectAnswer(1)

    // Soumettre via header button
    await exam.submitExam()

    // Verifier toast de succes
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /terminé/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("affiche les resultats apres soumission", async ({ page }) => {
    await exam.goto()

    // Active exam shows "Déjà passé" after submission
    await expect(page.getByRole("button", { name: "Déjà passé" })).toBeVisible({
      timeout: 15_000,
    })

    // Stats header shows completion info
    await expect(page.getByText("1 examen passé")).toBeVisible()
    await expect(page.getByText(/Score moyen/)).toBeVisible()
  })
})
