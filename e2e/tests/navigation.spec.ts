import { expect, test } from "@playwright/test"

test.describe("Navigation sidebar — etudiant", () => {
  test("tous les liens du sidebar etudiant naviguent correctement", async ({
    page,
  }) => {
    await page.goto("/dashboard")
    await expect(page.getByText(/Bonjour|Bon après-midi|Bonsoir/)).toBeVisible({
      timeout: 15_000,
    })

    const navLinks = [
      { title: "Tableau de bord", url: "/dashboard" },
      { title: "Examen Blanc", url: "/dashboard/examen-blanc" },
      { title: "Entraînement", url: "/dashboard/entrainement" },
    ]

    for (const link of navLinks) {
      const nav = page.locator("nav")
      await nav.getByRole("link", { name: link.title }).click()
      await expect(page).toHaveURL(new RegExp(link.url), {
        timeout: 15_000,
      })
    }
  })

  test("les liens secondaires du sidebar etudiant fonctionnent", async ({
    page,
  }) => {
    await page.goto("/dashboard")
    await expect(page.getByText(/Bonjour|Bon après-midi|Bonsoir/)).toBeVisible({
      timeout: 15_000,
    })

    // Profil
    const nav = page.locator("nav")
    await nav.getByRole("link", { name: "Profil" }).click()
    await expect(page).toHaveURL(/\/dashboard\/profil/, {
      timeout: 15_000,
    })

    // Go back and navigate to Abonnements
    await page.goto("/dashboard")
    await nav.getByRole("link", { name: "Abonnements" }).click()
    await expect(page).toHaveURL(/\/dashboard\/abonnements/, {
      timeout: 15_000,
    })
  })
})

test.describe("Navigation sidebar — admin", () => {
  test("tous les liens du sidebar admin naviguent correctement", async ({
    page,
  }) => {
    await page.goto("/admin")
    await expect(page.getByText("Tableau de bord")).toBeVisible({
      timeout: 15_000,
    })

    const navLinks = [
      { title: "Questions", url: "/admin/questions" },
      { title: "Examens", url: "/admin/exams" },
      { title: "Utilisateurs", url: "/admin/users" },
      { title: "Transactions", url: "/admin/transactions" },
    ]

    for (const link of navLinks) {
      const nav = page.locator("nav")
      await nav.getByRole("link", { name: link.title }).click()
      await expect(page).toHaveURL(new RegExp(link.url), {
        timeout: 15_000,
      })
    }
  })

  test("le lien profil admin fonctionne", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.getByText("Tableau de bord")).toBeVisible({
      timeout: 15_000,
    })

    const nav = page.locator("nav")
    await nav.getByRole("link", { name: "Profil" }).click()
    await expect(page).toHaveURL(/\/admin\/profil/, {
      timeout: 15_000,
    })
  })
})
