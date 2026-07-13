import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEPLOY_SKEW_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  callAction,
} from "@/lib/safe-action"

vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: (err: unknown) =>
    err instanceof Error && err.name === "UnrecognizedActionError",
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("callAction", () => {
  it("laisse passer un succès inchangé", async () => {
    const fn = vi.fn().mockResolvedValue({ success: true, data: 42 })
    await expect(callAction(fn)).resolves.toEqual({ success: true, data: 42 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("laisse passer une erreur serveur inchangée, sans la retenter", async () => {
    const fn = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Examen introuvable." })
    await expect(callAction(fn, { retries: 2 })).resolves.toEqual({
      success: false,
      error: "Examen introuvable.",
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("convertit un rejet réseau en ActionFailure", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(callAction(fn)).resolves.toEqual({
      success: false,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("sans opts, ne retente jamais", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await callAction(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries: 1 → retente après 1 s et réussit", async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ success: true })
    const p = callAction(fn, { retries: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toEqual({ success: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries: 1 → deux échecs = ActionFailure", async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    const p = callAction(fn, { retries: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toEqual({
      success: false,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

const skewError = () => {
  const e = new Error('Server Action "40dfe0" was not found on the server.')
  e.name = "UnrecognizedActionError"
  return e
}

describe("callAction — deploy skew", () => {
  it("convertit le skew en message dédié, sans jamais retenter", async () => {
    const fn = vi.fn().mockRejectedValue(skewError())
    await expect(callAction(fn, { retries: 2 })).resolves.toEqual({
      success: false,
      error: DEPLOY_SKEW_MESSAGE,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("affiche le toast central dédupliqué avec l'action Recharger", async () => {
    const fn = vi.fn().mockRejectedValue(skewError())
    await callAction(fn)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      DEPLOY_SKEW_MESSAGE,
      expect.objectContaining({
        id: "deploy-skew",
        duration: Infinity,
        action: expect.objectContaining({ label: "Recharger" }),
      }),
    )
  })

  it("un rejet réseau ordinaire ne déclenche pas le toast central", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(callAction(fn)).resolves.toEqual({
      success: false,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
