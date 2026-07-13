import { test as teardown } from "@playwright/test"

// Réinitialise l'état d'examen + nettoie les données de test préfixées via la
// route support `/api/e2e`.

teardown("reset exam participation", async ({ request }) => {
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
    console.log(`Exam reset for ${userEmail}: ${response.status()}`)
  }
})

teardown("cleanup e2e test data", async ({ request }) => {
  const secret = process.env.E2E_RESET_SECRET
  if (!secret) {
    console.log("Skipping E2E cleanup: E2E_RESET_SECRET manquant")
    return
  }

  const response = await request.post("/api/e2e", {
    data: { secret, action: "cleanup", prefix: "[E2E]" },
    failOnStatusCode: false,
  })
  if (response.ok()) {
    console.log("E2E cleanup:", await response.json())
  } else {
    console.warn("E2E cleanup failed:", response.status())
  }
})
