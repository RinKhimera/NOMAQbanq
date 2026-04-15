import { expect, test } from "../fixtures/base"

/**
 * Tests pour la page de résultats d'une session d'entraînement.
 * Vérifie le lazy-load des explications (PR B) et la navigation via le navigator.
 *
 * Le spec crée sa propre session pour être auto-contenu, au coût d'une
 * session supplémentaire sur le user de test.
 */
test.describe("Entraînement — page de résultats", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 })

  test.beforeEach(async ({ entrainement, page }) => {
    await entrainement.goto()

    if (!(await entrainement.hasAccess())) {
      test.skip(true, "Pas d'accès à l'entraînement pour ce user")
      return
    }

    await entrainement.waitForForm()
    await entrainement.setQuestionCount(5)
    await entrainement.startSession()

    // Answer 3 questions quickly then finish early via header finish button
    for (let i = 1; i <= 5; i++) {
      await entrainement.waitForQuestion(i, 5)
      await entrainement.selectAnswer(i % 4)
      if (i < 5) await entrainement.nextQuestion()
    }

    await entrainement.finishSession()
    await expect(page).toHaveURL(/\/results/, { timeout: 15_000 })
  })

  test("expand d'une question déclenche le lazy-load de l'explication", async ({
    entrainement,
    page,
  }) => {
    // Expand first question via its own toggle button inside the review card
    const firstCard = page.locator("#question-1")
    await expect(firstCard).toBeVisible({ timeout: 15_000 })

    const toggleBtn = firstCard.getByRole("button", {
      name: /Développer la question|Réduire la question/,
    })
    await toggleBtn.click()

    // Lazy query fires → explanation appears with non-empty text
    await entrainement.waitForExplanation(0)

    const explanation = firstCard.getByTestId("explanation-content")
    const text = (await explanation.textContent()) ?? ""
    expect(text.length).toBeGreaterThan(10)
  })

  test("cliquer Q1 → Q3 → Q2 via le navigator scroll + expand la bonne question", async ({
    entrainement,
    page,
  }) => {
    await entrainement.clickNavItem(0)
    await expect(page.locator("#question-1")).toBeInViewport({ ratio: 0.1 })

    await entrainement.clickNavItem(2)
    await expect(page.locator("#question-3")).toBeInViewport({ ratio: 0.1 })
    await entrainement.waitForExplanation(2)

    await entrainement.clickNavItem(1)
    await expect(page.locator("#question-2")).toBeInViewport({ ratio: 0.1 })
    await entrainement.waitForExplanation(1)
  })
})
