import { expect, test } from "@playwright/test"
import { ExamenBlancPage } from "../pages/examen-blanc.page"

/**
 * Tests "journey" pour l'examen blanc : tout le flow (list → confirm dialog →
 * warning anti-fraude → timer → questions → submit → post-submit state) dans
 * un seul test pour éviter 7× le même setup Clerk/Convex.
 */
test.describe("Examen Blanc — session complete", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })

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

  test("journey complet : confirmation → warning → timer → réponses → submit", async ({
    page,
  }) => {
    await exam.goto()
    await exam.clickStartExam()

    // Confirmation dialog content
    await expect(page.getByText("Confirmer le début de l'examen")).toBeVisible()
    await expect(page.getByText(/questions à répondre/)).toBeVisible()
    await expect(page.getByText(/minutes pour compléter/)).toBeVisible()
    await expect(page.getByText("Un seul essai autorisé")).toBeVisible()

    // Proceed via the existing confirmStart helper (clicks the dialog CTA)
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Commencer l'examen" }).click()
    await page.waitForURL(/\/evaluation/, { timeout: 15_000 })

    // Warning anti-fraude
    await expect(page.getByText("Règles importantes de l'examen")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Mesures anti-fraude activées")).toBeVisible()
    await exam.acceptWarningOrResume()

    // Timer + first question
    await exam.waitForTimer()
    expect(await exam.getTimerText()).toMatch(/\d{2}:\d{2}:\d{2}/)
    await exam.waitForQuestion(1)
    await expect(page.getByTestId("btn-next")).toBeVisible()

    // Answer Q1, navigate to Q2, back to Q1 → answer must persist
    await exam.selectAnswer(0)
    await exam.nextQuestion()
    await exam.waitForQuestion(2)
    await exam.selectAnswer(1)
    await exam.prevQuestion()
    await exam.waitForQuestion(1)
    await expect(
      page.locator('[data-testid="answer-option-0"][data-selected="true"]'),
    ).toBeVisible()

    // Submit from header
    await exam.submitExam()
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /terminé/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("affiche les resultats apres soumission", async ({ page }) => {
    await exam.goto()

    await expect(page.getByRole("button", { name: "Déjà passé" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("1 examen passé")).toBeVisible()
    await expect(page.getByText(/Score moyen/)).toBeVisible()
  })
})
