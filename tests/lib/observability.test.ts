import { afterEach, describe, expect, it, vi } from "vitest"
import { captureServerError } from "@/lib/observability"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  captureException.mockClear()
})

describe("captureServerError", () => {
  it("hors prod : console.error, pas de Sentry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    captureServerError("[test]", new Error("boom"))
    expect(spy).toHaveBeenCalledOnce()
    expect(captureException).not.toHaveBeenCalled()
  })

  it("en prod : console.error + Sentry avec tag action et userId", () => {
    vi.stubEnv("NODE_ENV", "production")
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("boom")
    captureServerError("[finalizeExam]", err, { userId: "u1" })
    expect(spy).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { action: "[finalizeExam]" },
      user: { id: "u1" },
      extra: undefined,
    })
  })

  it("en prod sans userId : pas d'objet user, detail dans extra", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("boom")
    captureServerError("[cron]", err, { detail: "participation p1" })
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { action: "[cron]" },
      user: undefined,
      extra: { detail: "participation p1" },
    })
  })

  it("inclut detail dans la ligne console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("boom")
    captureServerError("[notif:resultats]", err, { detail: "participation p1" })
    expect(spy).toHaveBeenCalledWith("[notif:resultats] participation p1", err)
  })
})
