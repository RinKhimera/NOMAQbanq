import { type Page, test as setup } from "@playwright/test"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

setup.describe.configure({ mode: "serial" })

// Connexion via le formulaire Better Auth réel (email/mot de passe), puis
// sauvegarde du cookie de session dans le storageState. Remplace `clerk.signIn`.
const signIn = async (page: Page, email: string, password: string) => {
  await page.goto("/auth/sign-in")
  await page.getByTestId("auth-email").fill(email)
  await page.getByTestId("auth-password").fill(password)
  await page.getByTestId("auth-submit").click()
  // Le formulaire redirige vers /dashboard ; l'admin y a aussi accès.
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20_000 })
}

setup("authenticate as user", async ({ page }) => {
  await signIn(
    page,
    process.env.E2E_USER_EMAIL!,
    process.env.E2E_USER_PASSWORD!,
  )
  await page
    .context()
    .storageState({ path: path.join(__dirname, ".auth/user.json") })
})

setup("authenticate as admin", async ({ page }) => {
  await signIn(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  )
  await page
    .context()
    .storageState({ path: path.join(__dirname, ".auth/admin.json") })
})

// Octroie au compte étudiant de test un accès `exam` + `training` actif via la
// route support Drizzle `/api/e2e`. Les comptes de test n'ont aucun `userAccess`
// par défaut (paywall) → sans ça, toutes les specs examen/entraînement échouent
// ou skippent. Idempotent (prolonge l'accès s'il existe déjà). L'admin bypasse
// `hasAccess`, il n'a donc pas besoin d'octroi.
setup("grant access for e2e student", async ({ request }) => {
  const secret = process.env.E2E_RESET_SECRET
  if (!secret) {
    console.log("Skipping grant access: E2E_RESET_SECRET manquant")
    return
  }

  for (const accessType of ["exam", "training"] as const) {
    const response = await request.post("/api/e2e", {
      data: {
        secret,
        action: "set-access",
        userEmail: process.env.E2E_USER_EMAIL!,
        accessType,
        grant: true,
      },
      failOnStatusCode: false,
    })
    if (response.ok()) {
      console.log(`E2E grant ${accessType}:`, await response.json())
    } else {
      console.warn(`E2E grant ${accessType} failed:`, response.status())
    }
  }
})

// Réinitialise l'état d'examen (participation + sessions en cours) via la route
// support Drizzle `/api/e2e` (remplace l'ancienne route Convex `/e2e/reset-exam`).
setup("reset exam state for e2e", async ({ request }) => {
  const secret = process.env.E2E_RESET_SECRET
  if (!secret) {
    console.log("Skipping exam reset: E2E_RESET_SECRET manquant")
    return
  }

  for (const userEmail of [
    process.env.E2E_USER_EMAIL!,
    process.env.E2E_ADMIN_EMAIL!,
  ]) {
    const response = await request.post("/api/e2e", {
      data: { secret, action: "reset-exam", userEmail },
      failOnStatusCode: false,
    })
    if (response.ok()) {
      console.log(`E2E reset for ${userEmail}:`, await response.json())
    } else {
      console.warn(`E2E reset failed for ${userEmail}:`, response.status())
    }
  }
})
