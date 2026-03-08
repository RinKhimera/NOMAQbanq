import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { test as setup } from "@playwright/test"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

setup.describe.configure({ mode: "serial" })

setup("clerk setup", async ({}) => {
  await clerkSetup()
})

const userAuthFile = path.join(__dirname, ".auth/user.json")

setup("authenticate as user", async ({ page }) => {
  await page.goto("/")
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  })
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
  await page.context().storageState({ path: userAuthFile })
})

const adminAuthFile = path.join(__dirname, ".auth/admin.json")

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/")
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_ADMIN_USERNAME!,
      password: process.env.E2E_CLERK_ADMIN_PASSWORD!,
    },
  })
  await page.waitForURL(/dashboard|admin/, { timeout: 15_000 })
  await page.context().storageState({ path: adminAuthFile })
})

// Reset exam state so there's an active exam and no prior participations
setup("reset exam state for e2e", async ({ request }) => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const resetSecret = process.env.E2E_RESET_SECRET

  if (!convexUrl || !resetSecret) {
    console.log("Skipping exam reset: missing CONVEX_URL or E2E_RESET_SECRET")
    return
  }

  const resetUrl = convexUrl.replace(".convex.cloud", ".convex.site")

  // Reset for both user and admin
  for (const email of [
    process.env.E2E_CLERK_USER_USERNAME!,
    process.env.E2E_CLERK_ADMIN_USERNAME!,
  ]) {
    try {
      const response = await request.post(`${resetUrl}/e2e/reset-exam`, {
        headers: { "Content-Type": "application/json" },
        data: { secret: resetSecret, userEmail: email },
      })
      if (response.ok()) {
        const body = await response.json()
        console.log(`E2E reset for ${email}:`, body)
      } else {
        console.warn(`E2E reset failed for ${email}:`, response.status())
      }
    } catch (error) {
      console.warn(`E2E reset error for ${email} (non-blocking):`, error)
    }
  }
})
