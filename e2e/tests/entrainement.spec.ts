import { expect, test } from "@playwright/test"
import { EntrainementPage } from "../pages/entrainement.page"

/**
 * Tests "journey" pour l'entraînement : au lieu d'isoler chaque interaction
 * dans son propre test (et donc refaire le setup 10×), on chaîne les
 * assertions dans un seul flow complet. Grosse économie de temps sans perte
 * de couverture : chaque étape reste assertée.
 */
test.describe("Entrainement — série complète", () => {
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
        page.getByRole("button", { name: "Commencer la série" }),
      ).toBeVisible()
      // Récapitulatif collant : disponibles, mode, chronomètre.
      await expect(page.getByTestId("training-pool")).toBeVisible()
      await expect(page.getByText("Chronomètre")).toBeVisible()
    } else {
      await expect(
        page.getByRole("heading", { name: "Entraînement non disponible" }),
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: /Voir les tarifs/ }),
      ).toBeVisible()
    }
  })

  test("journey complet : session 5 questions, navigation, flag, finish, résultats", async ({
    page,
  }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    // Configuration de la série
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
    await entrainement.gotoResultsFromCurrentUrl()
    await expect(page.getByText("Correctes", { exact: true })).toBeVisible()
    await expect(page.getByText("Incorrectes", { exact: true })).toBeVisible()
    // Score affiché ou retenu : le statut porte l'un des deux états.
    await expect(page.getByTestId("score-status")).toHaveAttribute(
      "data-status",
      /passing|failing|withheld/,
    )

    // Filtre segmenté Toutes / Incorrectes / Marquées : Q1 est marquée.
    const errors = page.getByTestId("btn-filter-errors")
    await expect(errors).toBeVisible({ timeout: 15_000 })
    await errors.click()
    await expect(errors).toHaveAttribute("aria-pressed", "true")
    await page.getByTestId("results-filter-flagged").click()
    await expect(page.locator("#question-1")).toBeVisible()
    await expect(page.locator('[id^="question-"]')).toHaveCount(1)
    await page.getByTestId("results-filter-all").click()
    await expect(page.locator('[id^="question-"]')).toHaveCount(5)

    await page.locator("[data-testid='btn-expand-all']").click()
    await page.locator("[data-testid='btn-collapse-all']").click()
  })

  test("mode tuteur : valider révèle la correction et le code couleur", async ({
    page,
  }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.selectMode("tutor")
    await entrainement.startSession()
    await entrainement.waitForQuestion(1, 5)

    // Choisir une option : aucune correction tant qu'on n'a pas validé.
    await entrainement.selectAnswer(0)
    await expect(page.getByTestId("explanation-content")).toBeHidden()
    await expect(page.getByTestId("btn-validate-answer")).toBeVisible()

    // Valider → correction + explication + code couleur.
    await entrainement.validateAnswer()
    await expect(page.getByTestId("explanation-content")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId("btn-validate-answer")).toBeHidden()
    // Exactement une option marquée juste.
    await expect(
      page.locator('[data-testid^="answer-option-"][data-state="correct"]'),
    ).toHaveCount(1)
  })

  test("la série apparait dans l'historique", async ({ page }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await expect(
      page.getByRole("heading", { name: "Séries précédentes" }),
    ).toBeVisible({ timeout: 15_000 })
    // Tableau ou lignes empilées selon la largeur : la ligne visible porte un
    // score (« 60 % ») ou un score retenu.
    await expect(
      page
        .locator('[data-testid="history-score"]:visible')
        .or(page.locator('[data-testid="history-score-withheld"]:visible'))
        .first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('[data-testid="history-row"]:visible').first(),
    ).toContainText(/Revoir/)
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
