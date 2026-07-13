import { type APIRequestContext, type Route } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Rejoue le scénario Sentry NOMAQBANQ-1B : onglet d'examen ouvert pendant un
 * déploiement → le POST d'action du bundle périmé reçoit
 * `x-nextjs-action-not-found: 1` → le client Next lève
 * `UnrecognizedActionError`. Attendu : toast central « Recharger » persistant,
 * AUCUN retry (même avec `retries: 1` sur saveExamAnswer), rollback vers la
 * réponse persistée, reprise normale une fois l'interception levée.
 */

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] DeploySkew"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

const isActionPost = (route: Route) =>
  route.request().method() === "POST" &&
  route.request().url().includes("/evaluation")

let examId = ""

test.describe("Examen Blanc — deploy skew pendant la passation", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} Passation`,
      questionCount: 5,
    })
    examId = (await seed.json()).examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test("skew : toast Recharger, un seul POST, rollback ; levée : la réponse persiste", async ({
    examen,
    page,
    context,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    expect(examId).toBeTruthy()

    await examen.goto()
    await examen.clickStartExamById(examId)
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Commencer l'examen" }).click()
    await page.waitForURL(/\/evaluation/, { timeout: 15_000 })
    await examen.acceptWarningOrResume()
    await examen.waitForQuestion(1)

    // Réponse en ligne persistée = valeur attendue du rollback.
    const option0 = page.getByTestId("answer-option-0")
    const option1 = page.getByTestId("answer-option-1")
    await option0.scrollIntoViewIfNeeded()
    const saved = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/evaluation"),
      { timeout: 15_000 },
    )
    await option0.click()
    await expect(option0).toHaveAttribute("data-selected", "true")
    await saved

    // « Déploiement » : le serveur ne reconnaît plus l'ID d'action.
    let intercepted = 0
    await context.route("**/*", (route) => {
      if (!isActionPost(route)) return route.continue()
      intercepted++
      return route.fulfill({
        status: 404,
        headers: { "x-nextjs-action-not-found": "1" },
        body: "",
      })
    })
    await option1.scrollIntoViewIfNeeded()
    await option1.click()

    // Toast central persistant, avec le remède.
    const skewToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Une nouvelle version de l'application" })
    await expect(skewToast).toBeVisible({ timeout: 10_000 })
    await expect(
      skewToast.getByRole("button", { name: "Recharger" }),
    ).toBeVisible()

    // Pas de retry : le retry réseau (1 s) de saveExamAnswer ne doit PAS
    // s'appliquer au skew — on laisse passer la fenêtre avant de compter.
    await page.waitForTimeout(1_500)
    expect(intercepted).toBe(1)

    // Rollback vers la réponse persistée.
    await expect(option1).not.toHaveAttribute("data-selected", "true")
    await expect(option0).toHaveAttribute("data-selected", "true")

    // Interception levée → le re-clic persiste (parité bundle restaurée).
    await context.unroute("**/*")
    await option1.click()
    await expect(option1).toHaveAttribute("data-selected", "true", {
      timeout: 10_000,
    })
  })
})
