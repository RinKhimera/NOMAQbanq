import { expect, test } from "@playwright/test"
import { ProfilPage } from "../pages/profil.page"

test.describe("Profil utilisateur", () => {
  let profil: ProfilPage

  test.beforeEach(async ({ page }) => {
    profil = new ProfilPage(page)
    await profil.goto()
    await profil.waitForReady()
  })

  test("la page profil charge avec les informations personnelles", async ({
    page,
  }) => {
    await expect(page.getByText("Informations personnelles")).toBeVisible()

    // User name should be displayed
    const main = page.locator("main")
    await expect(main.getByText("Nom complet")).toBeVisible()
  })

  test("l'edition inline du nom fonctionne", async ({ page }) => {
    const main = page.locator("main")

    // Find the Name field section
    const nameSection = main
      .locator("text=Nom complet")
      .locator("xpath=ancestor::div[contains(@class, 'group')]")
      .first()

    // Hover to reveal edit button
    await nameSection.hover()

    // Click edit pencil (force: true to bypass opacity-0)
    const editBtn = nameSection.getByRole("button").first()
    await editBtn.click({ force: true })

    // Input should appear
    const input = nameSection.locator("input").first()
    await expect(input).toBeVisible({ timeout: 5_000 })

    // Store current value, edit, then restore
    const currentValue = await input.inputValue()
    await input.clear()
    await input.fill("E2E Test Name")

    // Save
    const saveBtn = nameSection
      .getByRole("button")
      .filter({ hasText: /✓|Enregistrer|check/i })
      .first()
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click()
    } else {
      // Try pressing Enter
      await input.press("Enter")
    }

    await profil.expectToast("Modification enregistrée")

    // Restore original name
    await nameSection.hover()
    await editBtn.click({ force: true })
    const input2 = nameSection.locator("input").first()
    await input2.clear()
    await input2.fill(currentValue)
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click()
    } else {
      await input2.press("Enter")
    }
  })

  test("l'edition inline de la bio fonctionne", async ({ page }) => {
    const main = page.locator("main")

    // Find Bio section
    const bioSection = main
      .locator("text=Biographie")
      .locator("xpath=ancestor::div[contains(@class, 'group')]")
      .first()

    await bioSection.hover()
    const editBtn = bioSection.getByRole("button").first()
    await editBtn.click({ force: true })

    // Textarea should appear
    const textarea = bioSection.locator("textarea").first()
    const visible = await textarea
      .isVisible({ timeout: 5_000 })
      .catch(() => false)
    if (!visible) {
      const input = bioSection.locator("input").first()
      await expect(input).toBeVisible({ timeout: 5_000 })
    }
  })

  test("la carte d'abonnement est visible", async ({ page }) => {
    const main = page.locator("main")

    // ProfileSubscriptionCard should be present
    await expect(
      main.getByText(/Abonnement|Accès|Sécurité/).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
