import { expect, test } from "@playwright/test"

test.describe("Pages marketing (publiques)", () => {
  test("la page d'accueil affiche le héros, les CTAs et la carte de question", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Préparez l'EACMC Partie I avec méthode.",
      }),
    ).toBeVisible({ timeout: 15_000 })

    const main = page.locator("main")
    await expect(
      main.getByRole("link", { name: "Essayer l'évaluation gratuite" }).first(),
    ).toHaveAttribute("href", "/evaluation")

    // Stats dynamiques : on matche le libellé, pas le nombre.
    await expect(main.getByText(/candidats inscrits/).first()).toBeVisible()

    // La carte de démonstration corrige le choix, sans explication.
    await page.getByTestId("answer-option-2").click()
    await expect(page.getByTestId("answer-option-2")).toHaveAttribute(
      "data-state",
      "correct",
    )
    await expect(page.getByTestId("panel-explanation")).toHaveCount(0)
  })

  test("la page d'accueil affiche les fonctionnalités", async ({ page }) => {
    await page.goto("/")

    for (const title of [
      "Démarrage instantané",
      "Points de synthèse",
      "Modes chronométré et tuteur",
      "Disciplines",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible({
        timeout: 15_000,
      })
    }
  })

  test("la page tarifs affiche les offres et les garanties", async ({
    page,
  }) => {
    await page.goto("/tarifs")

    await expect(
      page.getByRole("heading", { level: 1, name: "Choisissez votre accès." }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole("button", { name: /^(Choisir|Prolonger)/ }).first(),
    ).toBeVisible()
    await expect(page.getByText(/Paiement sécurisé/).first()).toBeVisible()
  })

  test("la page FAQ affiche les accordéons et la recherche", async ({
    page,
  }) => {
    await page.goto("/faq")

    await expect(
      page.getByRole("heading", { level: 1, name: "Questions fréquentes" }),
    ).toBeVisible({ timeout: 15_000 })

    const searchInput = page.getByPlaceholder("Rechercher une question")
    await expect(searchInput).toBeVisible()

    const trigger = page.getByRole("button", {
      name: "Qu'est-ce que NOMAQbanq ?",
    })
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")

    await searchInput.fill("xyznonexistent999")
    await expect(page.getByText("Aucune question ne correspond.")).toBeVisible()
  })

  test("la page domaines mène aux pages domaine, sans nombre de questions", async ({
    page,
  }) => {
    await page.goto("/domaines")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "22 domaines, organisés selon les objectifs du CMC.",
      }),
    ).toBeVisible({ timeout: 15_000 })

    await page.getByRole("link", { name: /^Cardiologie/ }).click()
    await expect(page).toHaveURL(/\/domaines\/cardiologie$/)
    await expect(
      page.getByRole("heading", { level: 1, name: "Cardiologie" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Ce que couvre ce domaine" }),
    ).toBeVisible()
    await expect(page.locator("main")).not.toContainText(/\d+ questions?\b/)
  })

  test("la page à propos affiche les valeurs", async ({ page }) => {
    await page.goto("/a-propos")

    await expect(
      page.getByRole("heading", { name: "Ce qui nous anime" }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("la page Comment ça marche présente les quatre étapes", async ({
    page,
  }) => {
    await page.goto("/fonctionnement")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Une méthode en quatre temps.",
      }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole("heading", { name: "Quel mode choisir ?" }),
    ).toBeVisible()
  })

  test("la page évaluation mène au quiz", async ({ page }) => {
    await page.goto("/evaluation")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Testez vos connaissances en conditions réelles.",
      }),
    ).toBeVisible({ timeout: 15_000 })

    const quizLink = page
      .getByRole("link", { name: "Commencer l'évaluation" })
      .first()
    await expect(quizLink).toHaveAttribute("href", "/evaluation/quiz")
  })

  test("les pages légales (confidentialité, conditions, cookies) chargent", async ({
    page,
  }) => {
    // Smoke test unique pour les 3 pages légales au lieu de 3 tests séparés.
    // Ces pages sont statiques, une assertion minimale suffit.
    const legalPages = [
      { url: "/confidentialite", heading: "Politique de confidentialité" },
      { url: "/conditions", heading: "Conditions d'utilisation" },
      { url: "/cookies", heading: "Politique de cookies" },
    ]

    for (const { url, heading } of legalPages) {
      await page.goto(url)
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible({ timeout: 15_000 })
    }
  })
})
