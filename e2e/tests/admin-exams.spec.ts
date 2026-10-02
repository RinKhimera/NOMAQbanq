import { expect, test } from "@playwright/test"
import { AdminExamsPage } from "../pages/admin-exams.page"

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] Admin examens"

test.describe("Admin — examens blancs", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

  let examsPage: AdminExamsPage

  test.beforeEach(async ({ page }) => {
    examsPage = new AdminExamsPage(page)
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await request.post("/api/e2e", {
      data: { secret: SECRET, action: "cleanup", prefix: PREFIX },
      failOnStatusCode: false,
    })
  })

  test("la vue de pilotage charge ses sections et mène à la création", async () => {
    await examsPage.goto()
    await examsPage.waitForReady()
    await examsPage.gotoCreateExam()
  })

  test("le formulaire : pause réglable, audience restreinte", async ({
    page,
  }) => {
    await page.goto("/admin/examens/creer")
    await examsPage.expectCreateFormFields()

    await expect(page.getByTestId("exam-pause-minutes")).toHaveCount(0)
    await page.getByTestId("exam-pause-switch").click()
    await expect(page.getByTestId("exam-pause-minutes")).toBeVisible()

    await page.getByTestId("exam-audience-restricted").click()
    await expect(page.getByTestId("exam-audience-help")).toContainText(
      "Une liste vide est acceptée en préparation.",
    )
  })

  test("enregistrer en préparation, composer le jeu, puis supprimer", async ({
    page,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis pour le nettoyage")
    const title = `${PREFIX} ${Date.now()}`

    // Titre et visé suffisent : l'examen s'enregistre en préparation et
    // l'écran revient sur sa fiche.
    await page.goto("/admin/examens/creer")
    await page.getByTestId("exam-title-input").fill(title)
    await page.getByTestId("exam-target-input").fill("10")
    await page.getByTestId("btn-save-exam").click()
    await page.waitForURL(/\/admin\/examens\/(?!creer)[^/]+$/, {
      timeout: 20_000,
    })
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible()
    await expect(page.getByTestId("exam-badges")).toContainText(
      "En préparation",
    )

    // Compositeur : la complétion remplit les 10 places, « Terminé » revient
    // sur la fiche.
    await page.getByTestId("btn-compose-questions").click()
    await page.waitForURL(/\/questions\?retour=fiche/)
    await expect(page.getByTestId("composer-count")).toContainText("0 / 10")
    await page.getByTestId("btn-composer-complete").click()
    const dialog = page.getByTestId("composer-completion-dialog")
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await dialog.getByTestId("btn-composer-apply-completion").click()
    await expect(page.getByTestId("composer-count")).toContainText("10 / 10", {
      timeout: 15_000,
    })
    await page.getByTestId("btn-composer-done").click()
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("exam-badges")).toContainText("10 / 10")

    // Sans participation : suppression directe, retour à la liste.
    await page.getByTestId("btn-delete-exam").click()
    await page.getByTestId("btn-delete-exam-confirm").click()
    await page.waitForURL(/\/admin\/examens$/, { timeout: 15_000 })
    await expect(page.getByText(title)).toHaveCount(0)
  })
})
