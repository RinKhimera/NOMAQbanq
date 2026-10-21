import { describe, expect, it, vi } from "vitest"
import {
  SERVER_TRACE_SAMPLE_RATE,
  serverTracesSampler,
} from "@/lib/sentry-sampling"

const context = (name: string, attributes: Record<string, unknown> = {}) => ({
  name,
  attributes,
  inheritOrSampleWith: vi.fn((fallback: number) => fallback),
})

describe("serverTracesSampler", () => {
  it("trace le webhook Stripe à 100 % quand seul http.target porte la route", () => {
    const ctx = context("POST", { "http.target": "/api/stripe/webhook" })

    expect(serverTracesSampler(ctx)).toBe(1)
    expect(ctx.inheritOrSampleWith).not.toHaveBeenCalled()
  })

  it("trace le cron à 100 % quand seul url.path porte la route", () => {
    const ctx = context("GET", { "url.path": "/api/cron/close-expired" })

    expect(serverTracesSampler(ctx)).toBe(1)
  })

  it("se replie sur le nom du span quand aucun attribut ne porte la route", () => {
    const ctx = context("POST /api/stripe/webhook")

    expect(serverTracesSampler(ctx)).toBe(1)
  })

  it("trace à 100 % un webhook reçu avec une query string", () => {
    const ctx = context("POST", { "http.target": "/api/stripe/webhook?a=1" })

    expect(serverTracesSampler(ctx)).toBe(1)
  })

  it("ne laisse pas une query string forcer une page à 100 %", () => {
    const ctx = context("GET", {
      "http.target": "/tableau-de-bord?x=/api/cron/close-expired",
    })

    expect(serverTracesSampler(ctx)).toBe(SERVER_TRACE_SAMPLE_RATE)
  })

  it("ne trace pas à 100 % un chemin qui contient seulement la route", () => {
    const ctx = context("GET", { "url.path": "/blog/api/stripe/webhook" })

    expect(serverTracesSampler(ctx)).toBe(SERVER_TRACE_SAMPLE_RATE)
  })

  it("hérite de la décision amont, sinon 10 %, quand le span ne porte que la méthode", () => {
    const ctx = context("POST")

    expect(serverTracesSampler(ctx)).toBe(SERVER_TRACE_SAMPLE_RATE)
    expect(ctx.inheritOrSampleWith).toHaveBeenCalledWith(
      SERVER_TRACE_SAMPLE_RATE,
    )
  })

  it("hérite de la décision amont, sinon 10 %, pour une page", () => {
    const ctx = context("GET", {
      "http.target": "/tableau-de-bord/examen-blanc",
    })

    expect(serverTracesSampler(ctx)).toBe(SERVER_TRACE_SAMPLE_RATE)
    expect(ctx.inheritOrSampleWith).toHaveBeenCalledWith(
      SERVER_TRACE_SAMPLE_RATE,
    )
  })

  it("ignore un attribut de route qui n'est pas une chaîne", () => {
    const ctx = context("POST", { "http.target": ["/api/stripe/webhook"] })

    expect(serverTracesSampler(ctx)).toBe(SERVER_TRACE_SAMPLE_RATE)
  })

  it("expose un taux serveur de 10 %", () => {
    expect(SERVER_TRACE_SAMPLE_RATE).toBe(0.1)
  })
})
