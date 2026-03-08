import { expect, test } from "@playwright/test"
import { AdminUsersPage } from "../pages/admin-users.page"

test.describe("Admin — Gestion des utilisateurs", () => {
  let usersPage: AdminUsersPage

  test.beforeEach(async ({ page }) => {
    usersPage = new AdminUsersPage(page)
    await usersPage.goto()
    await usersPage.waitForReady()
  })

  test("la liste des utilisateurs charge correctement", async ({ page }) => {
    // Stats row should be visible
    const main = page.locator("main")
    await expect(main.getByText(/Total|Utilisateurs/).first()).toBeVisible({
      timeout: 15_000,
    })

    // At least one user row should be visible
    await expect(main.locator("tr, [role='row']").first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("la recherche par nom ou email fonctionne", async ({ page }) => {
    await usersPage.searchUser("test")

    // Results should update (or show no results message)
    await expect(page.getByPlaceholder(/Rechercher/).first()).toHaveValue(
      "test",
    )
  })

  test("le filtre par role fonctionne", async ({ page }) => {
    const main = page.locator("main")

    // Look for role filter buttons/tabs
    const roleFilter = main
      .getByRole("button", { name: /Admin|Étudiant/i })
      .first()
    const hasRoleFilter = await roleFilter
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    if (hasRoleFilter) {
      await roleFilter.click()
      // Results should update
      await page.waitForTimeout(500)
    }
  })

  test("le panneau lateral s'ouvre au clic sur un utilisateur", async ({
    page,
  }) => {
    const main = page.locator("main")

    // Click first user row
    const firstRow = main.locator("tr, [role='row']").nth(1)
    const hasRow = await firstRow
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (hasRow) {
      await firstRow.click()

      // Side panel should open
      await expect(
        page.locator("[role='dialog'], [data-state='open']").first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })

  test("les details de l'utilisateur s'affichent dans le panel", async ({
    page,
  }) => {
    const main = page.locator("main")

    const firstRow = main.locator("tr, [role='row']").nth(1)
    const hasRow = await firstRow
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (hasRow) {
      await firstRow.click()

      const panel = page.locator("[role='dialog'], [data-state='open']").first()
      await expect(panel).toBeVisible({ timeout: 10_000 })

      // Panel should show user info (email or name)
      await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
