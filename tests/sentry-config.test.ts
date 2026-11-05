import { beforeEach, describe, expect, it, vi } from "vitest"

const { init } = vi.hoisted(() => ({ init: vi.fn() }))

vi.mock("@sentry/nextjs", () => ({
  init,
  replayIntegration: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}))

// Valeur attendue écrite en dur, pas importée de `lib/sentry-data-collection` :
// retirer une clé rallume la collecte par défaut (corps HTTP, cookies) sans
// aucune erreur de type.
const DATA_COLLECTION = {
  databaseQueryData: false,
  httpBodies: [],
  cookies: false,
  frameContextLines: 7,
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

  it("garde chaque alerte serveur, même identique à la précédente", async () => {
    await import("@/sentry.server.config")

    const { integrations } = init.mock.calls[0][0]
    const kept = integrations([
      { name: "Dedupe" },
      { name: "LinkedErrors" },
    ]).map((integration: { name: string }) => integration.name)

    expect(kept).toEqual(["LinkedErrors"])
  })

  it("écarte côté client un rejet réseau passé par un fetch tiers, pas le même venu de notre bundle", async () => {
    await import("@/instrumentation-client")

    const { beforeSend } = init.mock.calls[0][0]
    const fetchRejection = (filenames: string[]) => ({
      exception: {
        values: [
          {
            type: "TypeError",
            value: "Failed to fetch",
            mechanism: {
              type: "auto.browser.global_handlers.onunhandledrejection",
              handled: false,
            },
            stacktrace: { frames: filenames.map((filename) => ({ filename })) },
          },
        ],
      },
    })
    const ours = fetchRejection(["app:///_next/static/chunks/a.js"])

    expect(
      beforeSend(fetchRejection(["app:///frame_ant/frame_ant.js"]), {}),
    ).toBeNull()
    expect(beforeSend(ours, {})).toBe(ours)
  })

  it("nettoie erreurs et spans serveur avant envoi", async () => {
    await import("@/sentry.server.config")

    const { beforeSend, beforeSendSpan } = init.mock.calls[0][0]
    const event = beforeSend({
      exception: { values: [{ value: "Failed query: q\nparams: secret" }] },
    })
    const span = beforeSendSpan({ attributes: { "http.target": "/?t=secret" } })

    expect(event.exception.values[0].value).toBe(
      "Failed query: q\nparams: [Filtered]",
    )
    expect(span.attributes["http.target"]).toBe("/")
  })
})
