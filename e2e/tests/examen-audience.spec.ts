import { type APIRequestContext, expect, test } from "@playwright/test"

/**
 * Couverture F2 — audience d'examen (sélection = accès).
 *
 * Sémantique : un examen `restricted` est masqué aux non-membres ; un membre de
 * l'audience peut le démarrer MÊME SANS abonnement (l'appartenance octroie
 * l'accès). On pilote l'état via `/api/e2e` :
 *  - `seed-restricted-exam` crée un examen restreint actif + son audience ;
 *  - `set-access` révoque/restaure l'abonnement examen du compte test.
 *
 * Compte test = `E2E_USER` (student). Le test « membre » révoque son abonnement
 * pour prouver que l'appartenance seule suffit (régression du bug `isEligible`
 * qui calculait l'éligibilité globalement et non par-examen).
 */

const SECRET = process.env.E2E_RESET_SECRET
const STUDENT_EMAIL =
  process.env.E2E_USER_EMAIL ?? "e2e.student@nomaqtest.local"
const PREFIX = "[E2E] Audience"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

test.describe("Examens — audience restreinte (F2)", () => {
  test.describe.configure({ mode: "serial" })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    // Nettoie les examens seedés + restaure l'abonnement examen du student
    // (un test a pu le révoquer) pour ne pas polluer les autres fichiers.
    await post(request, { action: "cleanup", prefix: PREFIX })
    await post(request, {
      action: "set-access",
      userEmail: STUDENT_EMAIL,
      accessType: "exam",
      grant: true,
    })
  })

  test("membre sans abonnement : examen restreint visible et démarrable", async ({
    page,
    request,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    // Examen restreint avec le student dans l'audience.
    const seed = await post(request, {
      action: "seed-restricted-exam",
      title: `${PREFIX} Membre`,
      audienceUserEmails: [STUDENT_EMAIL],
      questionCount: 3,
    })
    const { examId } = await seed.json()
    expect(examId).toBeTruthy()

    // Révoque l'abonnement examen : le student n'a AUCUN accès `subscribers`.
    await post(request, {
      action: "set-access",
      userEmail: STUDENT_EMAIL,
      accessType: "exam",
      grant: false,
    })

    await page.goto("/tableau-de-bord/examen-blanc")
    const card = page.getByTestId(`exam-card-${examId}`)
    await expect(card).toBeVisible({ timeout: 15_000 })

    // L'appartenance octroie l'accès → bouton actif, pas de « Non éligible ».
    await expect(
      card.getByRole("button", { name: "Commencer l'examen" }),
    ).toBeVisible()
    await expect(card.getByText("Non éligible")).toHaveCount(0)
  })

  test("outsider : examen restreint absent de la liste", async ({
    page,
    request,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")

    // Examen restreint SANS le student (audience vide → il en est exclu).
    const seed = await post(request, {
      action: "seed-restricted-exam",
      title: `${PREFIX} Outsider`,
      audienceUserEmails: [],
      questionCount: 3,
    })
    const { examId } = await seed.json()
    expect(examId).toBeTruthy()

    await page.goto("/tableau-de-bord/examen-blanc")
    await expect(
      page.getByRole("heading", { name: "Examens Blancs" }),
    ).toBeVisible({ timeout: 15_000 })

    // Masqué au non-membre (filtre d'audience de getExamsWithParticipation).
    await expect(page.getByTestId(`exam-card-${examId}`)).toHaveCount(0)
  })
})
