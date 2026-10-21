import { beforeEach, describe, expect, it, vi } from "vitest"

const { init } = vi.hoisted(() => ({ init: vi.fn() }))

vi.mock("@sentry/nextjs", () => ({
  init,
  replayIntegration: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}))

// Valeur attendue écrite en dur, pas importée de `lib/sentry-data-collection` :
// retirer une clé rallume la collecte par défaut (corps HTTP, cookies dont le
// jeton de session Better Auth) sans aucune erreur de type.
const DATA_COLLECTION = {
  databaseQueryData: false,
  httpBodies: [],
  cookies: false,
}

const SENTRY_CONFIGS = [
  ["client", () => import("@/instrumentation-client")],
  ["serveur", () => import("@/sentry.server.config")],
  ["edge", () => import("@/sentry.edge.config")],
] as const

describe("Sentry.init", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it.each(SENTRY_CONFIGS)(
    "ferme la collecte SQL, corps HTTP et cookies (%s)",
    async (_runtime, load) => {
      await load()

      expect(init).toHaveBeenCalledOnce()
      expect(init.mock.calls[0][0]).toMatchObject({
        dataCollection: DATA_COLLECTION,
      })
    },
  )
})
