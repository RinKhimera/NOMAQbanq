import { expect, test } from "@playwright/test"
import { EntrainementPage } from "../pages/entrainement.page"

/**
 * Tests "journey" pour l'entraînement : au lieu d'isoler chaque interaction
 * dans son propre test (et donc refaire le setup 10×), on chaîne les
 * assertions dans un seul flow complet. Grosse économie de temps sans perte
 * de couverture : chaque étape reste assertée.
 */
test.describe("Entrainement — session complete", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  let entrainement: EntrainementPage

  test.beforeEach(async ({ page }) => {
    entrainement = new EntrainementPage(page)
  })

  test("affiche la page entrainement ou le paywall", async ({ page }) => {
    await entrainement.goto()

    if (await entrainement.hasAccess()) {
      await entrainement.waitForForm()
      await expect(page.getByText("Nombre de questions")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Commencer l'entraînement" }),
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole("heading", { name: "Débloquez l'Entraînement" }),
      ).toBeVisible()
      await expect(
        page.getByText(/Accédez à notre banque complète/),
      ).toBeVisible()
    }
  })

  test("journey complet : session 5 questions, navigation, flag, finish, résultats", async ({
    page,
  }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    // Setup session
    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()

    // Q1: answer + flag, assert initial state
    await entrainement.waitForQuestion(1, 5)
    await expect(page.getByTestId("btn-previous")).toBeDisabled()
    await expect(page.getByTestId("btn-next")).toBeVisible()
    await entrainement.selectAnswer(0)
    await entrainement.flagQuestion()
    await expect(
      page.locator('[data-testid="btn-flag"][data-flagged="true"]'),
    ).toBeVisible()

    // Navigate to Q2 then back to Q1 — answer AND flag must persist
    await entrainement.nextQuestion()
    await entrainement.waitForQuestion(2, 5)
    await entrainement.prevQuestion()
    await entrainement.waitForQuestion(1, 5)
    await expect(
      page.locator('[data-testid="answer-option-0"][data-selected="true"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="btn-flag"][data-flagged="true"]'),
    ).toBeVisible()

    // Answer remaining questions (Q2-Q5)
    for (let i = 1; i < 5; i++) {
      await entrainement.nextQuestion()
      await entrainement.waitForQuestion(i + 1, 5)
      await entrainement.selectAnswer(0)
    }

    // Finish and assert results page
    await entrainement.finishSession()
    await expect(page.getByText(/\d+%/).first()).toBeVisible()
    await expect(page.getByText("Correctes", { exact: true })).toBeVisible()
    await expect(page.getByText("Incorrectes", { exact: true })).toBeVisible()
    await expect(page.getByText("Révision des questions")).toBeVisible()

    // Filter + expand/collapse controls on the results page
    const filterBtn = page.locator("[data-testid='btn-filter-errors']")
    await expect(filterBtn).toBeVisible({ timeout: 15_000 })
    await filterBtn.click()
    await expect(filterBtn).toHaveText("Voir toutes")
    await filterBtn.click()
    await expect(filterBtn).toHaveText(/Erreurs/)

    await page.locator("[data-testid='btn-expand-all']").click()
    await page.locator("[data-testid='btn-collapse-all']").click()
  })

  test("la session apparait dans l'historique", async ({ page }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await expect(page.getByText("Historique")).toBeVisible({ timeout: 15_000 })
    await expect(page.locator("text=/\\d+%/").first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test("outils : calculatrice et valeurs de laboratoire s'ouvrent", async ({
    page,
  }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()
    await entrainement.waitForQuestion(1, 5)

    // Calculator
    await page.locator("[data-testid='btn-calculator']").click()
    await expect(
      page.locator("[role='dialog']").filter({ hasText: /Calculatrice|AC|0/ }),
    ).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press("Escape")

    // Lab values
    await page.locator("[data-testid='btn-lab-values']").click()
    await expect(
      page
        .locator("[role='dialog']")
        .filter({ hasText: /Valeurs de laboratoire|Paramètre/ }),
    ).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press("Escape")
  })
})
