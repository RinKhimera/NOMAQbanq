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
      await page.locator("[data-testid='answer-option-0']").click()

      const nextBtn = page.getByRole("button", {
        name: "Question suivante",
      })
      const resultsBtn = page.getByRole("button", {
        name: "Voir les résultats",
      })

      const isLast = await resultsBtn.isVisible().catch(() => false)
      if (isLast) break

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
      await page.locator("[data-testid='answer-option-0']").click()

      const resultsBtn = page.getByRole("button", {
        name: "Voir les résultats",
      })
      const isLast = await resultsBtn.isVisible().catch(() => false)

      if (isLast) {
        await resultsBtn.click()
        break
      }

      await page.getByRole("button", { name: "Question suivante" }).click()
      await expect(page.locator("[data-testid='answer-option-0']")).toBeVisible(
        { timeout: 10_000 },
      )
    }

    // Results page should show score
    await expect(page.getByText(/\d+%/)).toBeVisible({ timeout: 15_000 })
  })
})
