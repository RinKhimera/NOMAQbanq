import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { expect, test } from "@playwright/test"

test.describe("Pages marketing (publiques)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page })
  })

  test("la page d'accueil affiche le hero et les CTAs", async ({ page }) => {
    await page.goto("/")

    // Hero heading
    await expect(
      page.locator("h1").filter({ hasText: "PRÉPAREZ-VOUS" }),
    ).toBeVisible({ timeout: 15_000 })

    // CTAs
    await expect(
      page.getByRole("link", { name: "Inscrivez-vous gratuitement" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Essayez NOMAQbanq" }),
    ).toBeVisible()

    // Trust indicator
    await expect(page.getByText("2000+ candidats satisfaits")).toBeVisible()
  })

  test("la page d'accueil affiche les features", async ({ page }) => {
    await page.goto("/")

    // At least 4 feature titles visible
    const featureTitles = [
      "Démarrage instantané",
      "Points de synthèse",
      "Modes chronométré / tuteur",
      "Disciplines",
    ]

    for (const title of featureTitles) {
      await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 })
    }
  })

  test("la page tarifs affiche les plans et les garanties", async ({
    page,
  }) => {
    await page.goto("/tarifs")

    await expect(
      page.getByText("Choisissez votre plan de préparation"),
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page
        .getByRole("button", { name: /Acheter maintenant|Prolonger/ })
        .first(),
    ).toBeVisible()

    await expect(page.getByText(/Paiement sécurisé/)).toBeVisible()
  })

  test("la page FAQ affiche les accordeons et la recherche", async ({
    page,
  }) => {
    await page.goto("/faq")

    await expect(page.getByText("Foire Aux Questions")).toBeVisible({
      timeout: 15_000,
    })

    // Search input
    const searchInput = page.getByPlaceholder("Rechercher une question...")
    await expect(searchInput).toBeVisible()

    // Open an accordion
    const firstTrigger = page.locator('[data-state="closed"]').first()
    await firstTrigger.click()
    await expect(page.locator('[data-state="open"]').first()).toBeVisible()

    // Search with nonsense → no results
    await searchInput.fill("xyznonexistent999")
    await expect(page.getByText("Aucun résultat trouvé")).toBeVisible()
  })

  test("la page domaines affiche la grille des domaines", async ({ page }) => {
    await page.goto("/domaines")

    await expect(page.getByText("Domaines d'évaluation")).toBeVisible({
      timeout: 15_000,
    })

    // Multiple domain cards should be visible
    await expect(page.getByText("Cardiologie")).toBeVisible()
  })

  test("la page a propos affiche la mission", async ({ page }) => {
    await page.goto("/a-propos")

    await expect(
      page.getByText("Notre mission et nos engagements"),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("la page evaluation affiche le CTA du quiz", async ({ page }) => {
    await page.goto("/evaluation")

    await expect(page.getByText("Testez vos connaissances")).toBeVisible({
      timeout: 15_000,
    })

    const quizLink = page.getByRole("link", { name: "Commencer le Quiz" })
    await expect(quizLink).toBeVisible()
    await expect(quizLink).toHaveAttribute("href", "/evaluation/quiz")
  })

  test("la page confidentialite charge correctement", async ({ page }) => {
    await page.goto("/confidentialite")

    await expect(page.getByText("Politique de confidentialité")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("la page conditions charge correctement", async ({ page }) => {
    await page.goto("/conditions")

    await expect(page.getByText("Conditions d'utilisation")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("la page cookies charge correctement", async ({ page }) => {
    await page.goto("/cookies")

    await expect(page.getByText("Politique de cookies")).toBeVisible({
      timeout: 15_000,
    })
  })
})
