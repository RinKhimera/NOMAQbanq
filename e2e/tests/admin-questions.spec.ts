import { expect, test } from "@playwright/test"
import { AdminQuestionsPage } from "../pages/admin-questions.page"

const E2E_STEM =
  "[E2E] Un patient de 45 ans présente une douleur thoracique aiguë. Quel est le diagnostic le plus probable ?"

test.describe("Admin — Questions", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(60_000)

  let questionsPage: AdminQuestionsPage

  test.beforeEach(async ({ page }) => {
    questionsPage = new AdminQuestionsPage(page)
  })

  test("la liste charge avec ses onglets à compteur", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()

    await expect(page.getByTestId("tab-all")).toBeVisible()
    await expect(page.getByTestId("tab-toVerify")).toContainText(
      "Clé à vérifier",
    )
    await expect(page.getByTestId("question-row-link").first()).toBeVisible()
  })

  test("la recherche vit dans l'URL", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()
    await questionsPage.searchQuestion("cardiologie")

    await page.reload()
    await expect(
      page.getByPlaceholder(
        "Énoncé, choix de réponse, objectif ou identifiant",
      ),
    ).toHaveValue("cardiologie")
  })

  test("le détail garde la liste d'où l'on vient", async ({ page }) => {
    await questionsPage.goto("?onglet=sans-references")
    await questionsPage.waitForReady()
    await questionsPage.openRow(0)

    await expect(page).toHaveURL(/onglet=sans-references/)
    await expect(page.getByTestId("question-position")).toHaveText(/^1 sur /)
    await expect(page.getByText("Répartition des réponses")).toBeVisible()

    await page.getByRole("link", { name: "Retour à la liste" }).click()
    await expect(page).toHaveURL(/\/admin\/questions\?onglet=sans-references/)
    await expect(page.getByTestId("tab-noReferences")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  test("la création d'une question ouvre son détail", async ({ page }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()
    await questionsPage.gotoNewQuestion()

    await questionsPage.fillQuestionForm({
      question: E2E_STEM,
      options: [
        "Infarctus du myocarde",
        "Pneumothorax",
        "Embolie pulmonaire",
        "Dissection aortique",
      ],
      keyIndex: 0,
      domain: "Cardiologie",
      objective: "Douleur thoracique",
      explanation:
        "[E2E] La douleur thoracique aiguë chez un patient de 45 ans avec facteurs de risque oriente d'abord vers un infarctus du myocarde.",
    })
    await questionsPage.save()

    await questionsPage.expectToast("Question enregistrée")
    await expect(page).toHaveURL(/\/admin\/questions\/[^/]+$/)
    await expect(page.getByText(E2E_STEM)).toBeVisible()
  })

  test("la suppression d'une question E2E ramène à la liste", async ({
    page,
  }) => {
    await questionsPage.goto()
    await questionsPage.waitForReady()
    await questionsPage.searchQuestion("[E2E]")

    const row = page.getByTestId("question-row-link").first()
    if (!(await row.isVisible({ timeout: 10_000 }).catch(() => false))) return
    await row.click()

    await page.getByTestId("btn-delete-question").click()
    await page.getByTestId("btn-delete-question-confirm").click()

    await questionsPage.expectToast(/Question (supprimée|archivée)/)
    await expect(page).toHaveURL(/\/admin\/questions\?q=/)
  })
})
