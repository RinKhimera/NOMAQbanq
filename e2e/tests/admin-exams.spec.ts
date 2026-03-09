import { expect, test } from "@playwright/test"
import { AdminExamsPage } from "../pages/admin-exams.page"

test.describe("Admin — Gestion des Examens", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(60_000)

  let examsPage: AdminExamsPage

  test.beforeEach(async ({ page }) => {
    examsPage = new AdminExamsPage(page)
  })

  test("la liste des examens charge correctement", async ({ page }) => {
    await examsPage.goto()
    await examsPage.waitForReady()

    // Stats row should be visible
    await expect(page.getByText(/Examens actifs|Total/).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("la navigation vers creer un examen fonctionne", async ({ page }) => {
    await examsPage.goto()
    await examsPage.waitForReady()
    await examsPage.gotoCreateExam()

    await expect(page).toHaveURL(/\/admin\/exams\/create/)
  })

  test("le formulaire de creation affiche tous les champs", async ({
    page,
  }) => {
    await page.goto("/admin/exams/create")
    await examsPage.expectCreateFormFields()
  })

  test("la row de stats est visible", async ({ page }) => {
    await examsPage.goto()
    await examsPage.waitForReady()

    // Exams stats should be visible
    const main = page.locator("main")
    await expect(main.getByText(/Total|Actifs|À venir/).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("le panneau lateral s'ouvre au clic sur un examen", async ({ page }) => {
    await examsPage.goto()
    await examsPage.waitForReady()

    // Click on an exam card/row (if exams exist)
    const main = page.locator("main")
    const examCard = main.locator("[role='button'], .cursor-pointer").first()
    const hasExam = await examCard
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (hasExam) {
      await examCard.click()

      // Side panel should open
      await expect(
        page.locator("[role='dialog'], [data-state='open']").first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })

  test("le formulaire de creation a le champ pause configurable", async ({
    page,
  }) => {
    await page.goto("/admin/exams/create")

    const main = page.locator("main")
    await expect(main.getByText("Pause pendant l'examen")).toBeVisible({
      timeout: 15_000,
    })

    // Toggle pause switch
    const pauseSwitch = main.getByRole("switch")
    await expect(pauseSwitch).toBeVisible()
    await pauseSwitch.click()

    // After enabling pause, duration input should appear
    await expect(main.getByText(/Durée de la pause|minutes/)).toBeVisible({
      timeout: 5_000,
    })
  })
})
