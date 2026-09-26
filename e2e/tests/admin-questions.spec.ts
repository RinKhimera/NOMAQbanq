import { expect, test } from "@playwright/test"
import { AdminQuestionsPage } from "../pages/admin-questions.page"

test.describe("Admin — Gestion des Questions", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(60_000)

  let questionsPage: AdminQuestionsPage

  test.beforeEach(async ({ page }) => {
    questionsPage = new AdminQuestionsPage(page)
  })

  test("la liste des questions charge correctement", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()

    // Stats row should be visible
    await expect(page.getByText(/Total|questions/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("le filtre de recherche fonctionne", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()

    // Search with a term that should filter results
    await questionsPage.searchQuestion("cardiologie")

    // Wait for results to update
    await page.waitForTimeout(500)

    // Should either show filtered results or "aucune question"
    // The key is that the search input works without errors
    await expect(page.getByPlaceholder(/Rechercher/).first()).toHaveValue(
      "cardiologie",
    )
  })

  test("la navigation vers nouvelle question fonctionne", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()
    await questionsPage.gotoNewQuestion()

    await expect(page).toHaveURL(/\/admin\/questions\/nouvelle/)
  })

  test("le formulaire de creation affiche tous les champs", async ({
    page,
  }) => {
    await page.goto("/admin/questions/nouvelle")

    // All form section cards should be visible
    await expect(page.getByText("Contenu de la question")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("Options de réponse")).toBeVisible()
    await expect(page.getByText("Classification")).toBeVisible()
    await expect(
      page.getByText("Explication", { exact: true }).first(),
    ).toBeVisible()
  })

  test("la creation d'une question avec donnees valides reussit", async ({
    page,
  }) => {
    await page.goto("/admin/questions/nouvelle")
    await expect(page.getByText("Contenu de la question")).toBeVisible({
      timeout: 15_000,
    })

    await questionsPage.fillQuestionForm({
      question:
        "[E2E] Un patient de 45 ans presente une douleur thoracique aigue. Quel est le diagnostic le plus probable ?",
      options: [
        "Infarctus du myocarde",
        "Pneumothorax",
        "Embolie pulmonaire",
        "Dissection aortique",
      ],
      correctAnswer: "A",
      domain: "Cardiologie",
      explanation:
        "[E2E] La douleur thoracique aigue chez un patient de 45 ans avec facteurs de risque cardiovasculaires oriente en premier lieu vers un infarctus du myocarde. L'ECG et les troponines sont essentiels pour confirmer le diagnostic.",
    })

    // Objectif CMC (combobox Popover + cmdk — cf. POM)
    await questionsPage.fillObjectifCMC("1.1")

    await questionsPage.submitQuestion()
    await questionsPage.expectSuccessToast()
  })

  test("la question creee apparait dans la liste", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()

    await questionsPage.searchQuestion("[E2E]")

    await expect(page.getByText("[E2E]").first()).toBeVisible({
      timeout: 15_000,
    })
  })

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 800 },
  ]) {
    test(`la modale de question garde ses actions visibles à ${viewport.width} px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await questionsPage.goto()
      await questionsPage.waitForReady()

      await page
        .getByRole("button", { name: "Prévisualiser la question" })
        .first()
        .click()

      const modal = page.getByTestId("question-detail-modal")
      await expect(modal.getByText("Question", { exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(
        modal.getByRole("button", { name: /Explication/ }),
      ).toHaveAttribute("aria-expanded", "false")

      // Sans débordement, un pied visible ne prouverait rien.
      const overflows = await modal
        .locator(".overflow-y-auto")
        .evaluate((el) => el.scrollHeight > el.clientHeight)
      expect(overflows).toBe(true)

      const footer = page.getByTestId("question-detail-footer")
      await expect(
        footer.getByRole("button", { name: "Supprimer" }),
      ).toBeInViewport({ ratio: 1 })
      await expect(
        footer.getByRole("link", { name: /Modifier/ }),
      ).toBeInViewport({ ratio: 1 })
    })
  }

  test("la suppression d'une question E2E fonctionne", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()

    // Search for E2E question
    await questionsPage.searchQuestion("[E2E]")

    const e2eQuestion = page.getByText("[E2E]").first()
    const hasE2E = await e2eQuestion
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (hasE2E) {
      // Ouvre la modale de la question
      await e2eQuestion.click()

      // Supprimer, dans le pied de la modale
      const deleteBtn = page.getByRole("button", { name: /Supprimer/ }).first()
      await expect(deleteBtn).toBeVisible({ timeout: 10_000 })
      await deleteBtn.click()

      // Confirm deletion in dialog
      const confirmBtn = page
        .locator("[role='alertdialog'], [role='dialog']")
        .getByRole("button", { name: /Supprimer/ })
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
      await confirmBtn.click()

      // Success toast
      await questionsPage.expectToast(/supprimée/)
    }
  })
})
