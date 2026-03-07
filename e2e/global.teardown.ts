import { test as teardown } from "@playwright/test"

teardown("reset exam participation", async ({ request }) => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const resetSecret = process.env.E2E_RESET_SECRET

  if (!convexUrl || !resetSecret) {
    console.log("Skipping exam reset: missing CONVEX_URL or E2E_RESET_SECRET")
    return
  }

  const resetUrl = convexUrl.replace(".convex.cloud", ".convex.site")

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
        console.log(`Exam reset for ${email}: OK`)
      } else {
        console.warn(`Exam reset failed for ${email}:`, response.status())
      }
    } catch (error) {
      console.warn(`Exam reset error for ${email} (non-blocking):`, error)
    }
  }
})
