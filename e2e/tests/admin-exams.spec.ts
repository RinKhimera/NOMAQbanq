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

    await expect(page).toHaveURL(/\/admin\/examens\/creer/)
  })

  test("le formulaire de creation affiche tous les champs", async ({
    page,
  }) => {
    await page.goto("/admin/examens/creer")
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

    // Click on an exam card (if exams exist)
    const examCard = page.getByTestId("exam-card").first()
    const hasExam = await examCard
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (hasExam) {
      await examCard.click()

      // Side panel should open
      await expect(page.getByTestId("exam-side-panel")).toBeVisible({
        timeout: 10_000,
      })
    }
  })

  test("le formulaire de creation a le champ pause configurable", async ({
    page,
  }) => {
    await page.goto("/admin/examens/creer")

    const main = page.locator("main")
    await expect(main.getByText("Pause pendant l'examen")).toBeVisible({
      timeout: 15_000,
    })

    // Toggle pause switch
    const pauseSwitch = main.getByRole("switch")
    await expect(pauseSwitch).toBeVisible()
    await pauseSwitch.click()

    // After enabling pause, duration input should appear (cibler le label seul ;
    // /minutes/ matchait aussi le suffixe d'unité du champ).
    await expect(main.getByText("Durée de la pause")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("F2 — le selecteur d'audience revele le picker d'utilisateurs en mode restreint", async ({
    page,
  }) => {
    await page.goto("/admin/examens/creer")
    const main = page.locator("main")

    // Carte audience présente ; « abonnés » est l'option par défaut → le picker
    // « Utilisateurs autorisés » (UserMultiSelect) est masqué tant qu'on n'a pas
    // basculé sur « restreint ».
    await expect(
      main.getByText("Tous les abonnés aux examens blancs"),
    ).toBeVisible({ timeout: 15_000 })
    await expect(main.getByText("Utilisateurs autorisés")).toHaveCount(0)

    // Bascule sur « Utilisateurs spécifiques » → le picker d'audience apparaît
    // (sémantique F2 : audience restreinte gérée côté admin).
    await main.getByText("Utilisateurs spécifiques").click()
    await expect(main.getByText("Utilisateurs autorisés")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("le résumé des candidats éligibles est contextuel à l'audience", async ({
    page,
  }) => {
    await page.goto("/admin/examens/creer")
    const main = page.locator("main")

    // Mode abonnés (défaut) : résumé du compte d'éligibles + bouton « Voir la
    // liste ». global.setup octroie l'accès examen au student → ≥1 éligible
    // garanti, donc le bouton est présent.
    await expect(main.getByText(/candidats? éligibles?/)).toBeVisible({
      timeout: 15_000,
    })
    const voirListe = main.getByRole("button", { name: "Voir la liste" })
    await expect(voirListe).toBeVisible()

    // Le Dialog s'ouvre avec sa recherche (EligibleCandidatesSection embarquée).
    await voirListe.click()
    await expect(
      page
        .getByRole("dialog")
        .getByPlaceholder("Rechercher par nom ou email..."),
    ).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press("Escape")

    // Bascule restreint : le résumé devient le compte de sélection ; le pool
    // d'abonnés n'est plus présenté comme liste (« Voir la liste » disparaît).
    await main.getByText("Utilisateurs spécifiques").click()
    await expect(main.getByText("Aucun utilisateur sélectionné")).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      main.getByRole("button", { name: "Voir la liste" }),
    ).toHaveCount(0)
  })
})
