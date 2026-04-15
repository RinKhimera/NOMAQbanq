import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { expect, test } from "@playwright/test"

test.describe("Evaluation gratuite — quiz public", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page })
  })

  test("le quiz charge et affiche la premiere question", async ({ page }) => {
    await page.goto("/evaluation/quiz")

    // Wait for loading to finish
    await expect(page.getByText("Chargement des questions...")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Chargement des questions...")).toBeHidden({
      timeout: 30_000,
    })

    // First question should be visible with answer options
    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("la selection d'une reponse fonctionne", async ({ page }) => {
    await page.goto("/evaluation/quiz")

    // Wait for quiz to load
    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 30_000,
    })

    // Select first answer
    await page.locator("[data-testid='answer-option-0']").click()

    // Answer should be marked as selected
    await expect(
      page.locator("[data-testid='answer-option-0'][data-selected='true']"),
    ).toBeVisible()
  })

  test("le bouton suivant navigue vers la question suivante", async ({
    page,
  }) => {
    await page.goto("/evaluation/quiz")

    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 30_000,
    })

    // Select answer and click next
    await page.locator("[data-testid='answer-option-0']").click()
    await page.getByRole("button", { name: "Question suivante" }).click()

    // Should show next question (still has answer options)
    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 10_000,
    })
  })

  test("la derniere question affiche le bouton resultats", async ({ page }) => {
    await page.goto("/evaluation/quiz")

    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 30_000,
    })

    // Answer all questions (up to 10)
    for (let i = 0; i < 10; i++) {
      // Scroll the answer into the middle of the viewport first so the sticky
      // marketing header (fixed, z-50) doesn't intercept the click
      const answer = page.locator("[data-testid='answer-option-0']")
      await answer.scrollIntoViewIfNeeded()
      await answer.click()

      const nextBtn = page.getByRole("button", {
        name: "Question suivante",
      })
      const resultsBtn = page.getByRole("button", {
        name: "Voir les résultats",
      })

      const isLast = await resultsBtn.isVisible().catch(() => false)
      if (isLast) break

      await nextBtn.scrollIntoViewIfNeeded()
      await nextBtn.click()
      await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible(
        { timeout: 10_000 },
      )
    }

    // Last question should show "Voir les résultats"
    await expect(
      page.getByRole("button", { name: "Voir les résultats" }),
    ).toBeVisible()
  })

  test("les resultats affichent le score apres soumission", async ({
    page,
  }) => {
    await page.goto("/evaluation/quiz")

    await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible({
      timeout: 30_000,
    })

    // Answer all questions quickly
    for (let i = 0; i < 10; i++) {
      const answer = page.locator("[data-testid='answer-option-0']")
      await answer.scrollIntoViewIfNeeded()
      await answer.click()

      const resultsBtn = page.getByRole("button", {
        name: "Voir les résultats",
      })
      const isLast = await resultsBtn.isVisible().catch(() => false)

      if (isLast) {
        await resultsBtn.scrollIntoViewIfNeeded()
        await resultsBtn.click()
        break
      }

      const nextBtn = page.getByRole("button", { name: "Question suivante" })
      await nextBtn.scrollIntoViewIfNeeded()
      await nextBtn.click()
      await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible(
        { timeout: 10_000 },
      )
    }

    // Results page should show score — review cards can also contain percentage
    // text, so scope to the score summary card via the "Score" label
    await expect(
      page
        .locator("div")
        .filter({ has: page.getByText("Score", { exact: true }) })
        .getByText(/\d+%/)
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
