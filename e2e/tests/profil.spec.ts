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
    // Testids stables sur InlineEditField (l'ancien xpath ancestor remontait trop
    // haut et ciblait le file input de l'avatar).
    const field = page.getByTestId("profile-field-name")
    await field.hover()
    await page.getByTestId("profile-field-name-edit").click({ force: true })

    const input = page.getByTestId("profile-field-name-input")
    await expect(input).toBeVisible({ timeout: 5_000 })

    // Store current value, edit, then restore
    const currentValue = await input.inputValue()
    await input.clear()
    await input.fill("E2E Test Name")
    await page.getByTestId("profile-field-name-save").click()

    await profil.expectToast("Modification enregistrée")

    // Restore original name
    await field.hover()
    await page.getByTestId("profile-field-name-edit").click({ force: true })
    const input2 = page.getByTestId("profile-field-name-input")
    await input2.clear()
    await input2.fill(currentValue)
    await page.getByTestId("profile-field-name-save").click()
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
