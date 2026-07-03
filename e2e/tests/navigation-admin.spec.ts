import { expect, test } from "@playwright/test"

test.describe("Navigation sidebar — admin", () => {
  test("tous les liens du sidebar admin naviguent correctement", async ({
    page,
  }) => {
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { name: "Tableau de bord" }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })

    const navLinks = [
      { title: "Questions", url: "/admin/questions" },
      { title: "Examens", url: "/admin/examens" },
      { title: "Utilisateurs", url: "/admin/utilisateurs" },
      { title: "Transactions", url: "/admin/transactions" },
    ]

    for (const link of navLinks) {
      const nav = page.locator('[data-sidebar="content"]')
      await nav.getByRole("link", { name: link.title }).click()
      await expect(page).toHaveURL(new RegExp(link.url), {
        timeout: 15_000,
      })
    }
  })

  test("le lien profil admin fonctionne", async ({ page }) => {
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { name: "Tableau de bord" }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })

    const nav = page.locator('[data-sidebar="content"]')
    await nav.getByRole("link", { name: "Profil" }).click()
    await expect(page).toHaveURL(/\/admin\/profil/, {
      timeout: 15_000,
    })
  })
})
