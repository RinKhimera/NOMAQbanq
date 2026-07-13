import { type APIRequestContext, type Route } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Rejoue le scénario du post-mortem Sentry NOMAQBANQ-1A : coupure réseau
 * pendant la passation → le clic de réponse doit échouer PROPREMENT (toast +
 * rollback vers la dernière réponse persistée, pas d'unhandled rejection) puis
 * réussir au retour du réseau.
 *
 * La coupure est simulée par `route.abort()` sur les POST de Server Actions
 * (rejet immédiat du fetch, comme en prod) plutôt que `context.setOffline` :
 * hors ligne, le dev server Turbopack laisse la requête PENDRE (websocket HMR
 * mort, « Compiling… » bloqué) au lieu de la rejeter — le scénario ne se
 * déclenche jamais.
 */

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] Offline"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

const isActionPost = (route: Route) =>
  route.request().method() === "POST" &&
  route.request().url().includes("/evaluation")

let examId = ""

test.describe("Examen Blanc — coupure réseau pendant la passation", () => {
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

  test("hors ligne : toast + rollback ; retour en ligne : la réponse persiste", async ({
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

    // Réponse en ligne — on attend la réponse du POST : garantit que A est
    // PERSISTÉE côté serveur (c'est la valeur attendue du rollback).
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

    // « Coupure réseau » : les POST de Server Actions rejettent immédiatement
    await context.route("**/*", (route) =>
      isActionPost(route)
        ? route.abort("internetdisconnected")
        : route.continue(),
    )
    await option1.scrollIntoViewIfNeeded()
    await option1.click()
    // retry 1× à 1 s inclus avant l'échec définitif
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Réponse non enregistrée" }),
    ).toBeVisible({ timeout: 10_000 })
    // Rollback vers la dernière réponse persistée : option 0 re-sélectionnée
    await expect(option1).not.toHaveAttribute("data-selected", "true")
    await expect(option0).toHaveAttribute("data-selected", "true")

    // Retour en ligne → le re-clic persiste
    await context.unroute("**/*")
    await option1.click()
    await expect(option1).toHaveAttribute("data-selected", "true", {
      timeout: 10_000,
    })

    // La sélection survit à une navigation (preuve de persistance serveur)
    await examen.nextQuestion()
    await examen.waitForQuestion(2)
    await examen.prevQuestion()
    await examen.waitForQuestion(1)
    await expect(
      page.locator('[data-testid="answer-option-1"][data-selected="true"]'),
    ).toBeVisible()
  })
})
