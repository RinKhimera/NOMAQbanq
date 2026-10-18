import { expect, test } from "@playwright/test"
import { AdminProgressionPage } from "../pages/admin-progression.page"

// Lecture seule : aucune écriture sur develop.
test.describe("Admin — Progression des étudiants", () => {
  let progression: AdminProgressionPage

  test.beforeEach(async ({ page }) => {
    progression = new AdminProgressionPage(page)
  })

  test("le tableau charge ses colonnes et ses étudiants", async ({ page }) => {
    await progression.goto()
    await progression.waitForReady()
    const main = page.locator("main")
    for (const column of [
      "Étudiant",
      "Accès",
      "Score moyen",
      "Examens réussis",
      "Questions pratiquées",
      "Jours d'activité",
      "Dernière activité",
    ])
      await expect(
        main.getByRole("columnheader", { name: column }),
      ).toBeVisible()
    await expect(progression.table.locator("tbody tr").first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("ouvrir un étudiant, passer au suivant, revenir avec les filtres", async ({
    page,
  }) => {
    await progression.goto("?periode=tout&actifs=1")
    await progression.waitForReady()

    await progression.openFirstStudent()
    await expect(
      page.getByRole("navigation", { name: "Fil d'Ariane" }),
    ).toContainText("Progression")
    await expect(progression.position).toHaveText(/^1 sur \d+/)
    await expect(
      page.getByRole("heading", { name: "Résultats par domaine" }),
    ).toBeVisible()
    const first = page.url()

    await page.getByRole("link", { name: "Étudiant suivant" }).click()
    await expect(progression.position).toHaveText(/^2 sur \d+/)
    expect(page.url()).not.toBe(first)

    await page.getByRole("link", { name: "Retour à la liste" }).click()
    await expect(page).toHaveURL(/\/admin\/progression\?/)
    await expect(page).toHaveURL(/periode=tout/)
    await expect(page).toHaveURL(/actifs=1/)
    await expect(page.getByTestId("filter-active-only")).toBeChecked()
  })

  test("ouverte sans le tableau, la progression est « Hors de la liste filtrée »", async ({
    page,
  }) => {
    await progression.goto("?periode=tout&actifs=1")
    await progression.waitForReady()
    const href = await progression.table
      .locator("a[href^='/admin/progression/']")
      .first()
      .getAttribute("href")
    await page.goto(href!.split("?")[0]!)

    await expect(progression.position).toHaveText("Hors de la liste filtrée")
    await expect(
      page.getByRole("link", { name: "Étudiant suivant" }),
    ).toHaveCount(0)
  })
})
