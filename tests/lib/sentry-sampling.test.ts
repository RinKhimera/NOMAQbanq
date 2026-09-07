import { describe, expect, it, vi } from "vitest"
import {
  SERVER_TRACE_SAMPLE_RATE,
  serverTracesSampler,
} from "@/lib/sentry-sampling"

const context = (name: string) => ({
  name,
  inheritOrSampleWith: vi.fn((fallback: number) => fallback),
})

describe("serverTracesSampler", () => {
  it("trace le webhook Stripe à 100 %", () => {
    const ctx = context("POST /api/stripe/webhook")

    expect(serverTracesSampler(ctx)).toBe(1)
    expect(ctx.inheritOrSampleWith).not.toHaveBeenCalled()
  })

  it("trace le cron à 100 %", () => {
    const ctx = context("GET /api/cron/close-expired")

    expect(serverTracesSampler(ctx)).toBe(1)
  })

  it("hérite de la décision amont, sinon 10 %, pour tout le reste", () => {
    const ctx = context("GET /tableau-de-bord/examen-blanc")

    expect(serverTracesSampler(ctx)).toBe(SERVER_TRACE_SAMPLE_RATE)
    expect(ctx.inheritOrSampleWith).toHaveBeenCalledWith(
      SERVER_TRACE_SAMPLE_RATE,
    )
  })

  it("expose un taux serveur de 10 %", () => {
    expect(SERVER_TRACE_SAMPLE_RATE).toBe(0.1)
  })
})
