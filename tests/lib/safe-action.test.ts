import { afterEach, describe, expect, it, vi } from "vitest"
import { NETWORK_ERROR_MESSAGE, callAction } from "@/lib/safe-action"

afterEach(() => {
  vi.useRealTimers()
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
