import { test as setup, type Page } from "@playwright/test"
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
