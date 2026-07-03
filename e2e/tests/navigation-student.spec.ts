import { expect, test } from "@playwright/test"

test.describe("Navigation sidebar — etudiant", () => {
  test("tous les liens du sidebar etudiant naviguent correctement", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord")
    await expect(page.getByText(/Bonjour|Bon après-midi|Bonsoir/)).toBeVisible({
      timeout: 15_000,
    })

    const navLinks = [
      { title: "Tableau de bord", url: "/tableau-de-bord" },
      { title: "Examen Blanc", url: "/tableau-de-bord/examen-blanc" },
      { title: "Entraînement", url: "/tableau-de-bord/entrainement" },
    ]

    for (const link of navLinks) {
      const nav = page.locator('[data-sidebar="content"]')
      await nav.getByRole("link", { name: link.title }).click()
      await expect(page).toHaveURL(new RegExp(link.url), {
        timeout: 15_000,
      })
    }
  })

  test("les liens secondaires du sidebar etudiant fonctionnent", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord")
    await expect(page.getByText(/Bonjour|Bon après-midi|Bonsoir/)).toBeVisible({
      timeout: 15_000,
    })

    // Profil
    const nav = page.locator('[data-sidebar="content"]')
    await nav.getByRole("link", { name: "Profil" }).click()
    await expect(page).toHaveURL(/\/tableau-de-bord\/profil/, {
      timeout: 15_000,
    })

    // Go back and navigate to Abonnements
    await page.goto("/tableau-de-bord")
    await nav.getByRole("link", { name: "Abonnements" }).click()
    await expect(page).toHaveURL(/\/tableau-de-bord\/abonnements/, {
      timeout: 15_000,
    })
  })
})
