import { expect, test } from "@playwright/test"

import { EntrainementPage } from "../pages/entrainement.page"

test.describe("Entrainement — session complete", () => {
  // Run serially — tests share Convex state (same user's training sessions)
  // Longer timeout — abandoning existing sessions + Convex reactivity takes time
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  let entrainement: EntrainementPage

  test.beforeEach(async ({ page }) => {
    entrainement = new EntrainementPage(page)
  })

  test("affiche la page entrainement ou le paywall", async ({ page }) => {
    await entrainement.goto()

    const hasAccess = await entrainement.hasAccess()

    if (hasAccess) {
      await entrainement.waitForForm()
      await expect(page.getByText("Nombre de questions")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Commencer l'entraînement" }),
      ).toBeVisible()
    } else {
      // Paywall visible — validate its content
      await expect(
        page.getByRole("heading", { name: "Débloquez l'Entraînement" }),
      ).toBeVisible()
      await expect(
        page.getByText(/Accédez à notre banque complète/),
      ).toBeVisible()
    }
  })

  test("cree une session de 5 questions et affiche la session", async ({
    page,
  }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()

    await entrainement.waitForQuestion(1, 5)
    await expect(page.getByTestId("btn-previous")).toBeDisabled()
    await expect(page.getByTestId("btn-next")).toBeVisible()
  })

  test("repond aux questions et navigue", async ({ page }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()

    // Repondre a Q1
    await entrainement.waitForQuestion(1, 5)
    await entrainement.selectAnswer(0)

    // Naviguer vers Q2
    await entrainement.nextQuestion()
    await entrainement.waitForQuestion(2, 5)

    // Revenir a Q1 — la reponse doit persister
    await entrainement.prevQuestion()
    await entrainement.waitForQuestion(1, 5)

    // Verifier qu'une option est selectionnee (data-selected="true")
    await expect(
      page.locator('[data-testid="answer-option-0"][data-selected="true"]'),
    ).toBeVisible()
  })

  test("marque une question et verifie le flag", async ({ page }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()

    await entrainement.waitForQuestion(1, 5)
    await entrainement.flagQuestion()

    // Verifier que le flag est actif
    await expect(
      page.locator('[data-testid="btn-flag"][data-flagged="true"]'),
    ).toBeVisible()

    // Naviguer away et revenir
    await entrainement.nextQuestion()
    await entrainement.waitForQuestion(2, 5)
    await entrainement.prevQuestion()
    await entrainement.waitForQuestion(1, 5)

    // Flag doit persister
    await expect(
      page.locator('[data-testid="btn-flag"][data-flagged="true"]'),
    ).toBeVisible()
  })

  test("termine la session et affiche les resultats", async ({ page }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()

    // Repondre aux 5 questions
    for (let i = 0; i < 5; i++) {
      await entrainement.waitForQuestion(i + 1, 5)
      await entrainement.selectAnswer(0)
      if (i < 4) {
        await entrainement.nextQuestion()
      }
    }

    // Terminer la session
    await entrainement.finishSession()

    // Verifier la page resultats — score percentage
    await expect(page.getByText(/\d+%/).first()).toBeVisible()
    await expect(page.getByText("Correctes", { exact: true })).toBeVisible()
    await expect(page.getByText("Incorrectes", { exact: true })).toBeVisible()
    await expect(page.getByText("Révision des questions")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Nouvelle session" }),
    ).toBeVisible()
  })

  test("la session apparait dans l'historique", async ({ page }) => {
    await entrainement.goto()
    if (!(await entrainement.hasAccess())) test.skip()

    // Verifier la section historique
    await expect(page.getByText("Historique")).toBeVisible({
      timeout: 15_000,
    })

    // Verifier qu'il y a au moins une session avec un score
    await expect(page.locator("text=/\\d+%/").first()).toBeVisible({
      timeout: 10_000,
    })
  })
})
