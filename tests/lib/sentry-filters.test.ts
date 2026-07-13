import type { ErrorEvent, EventHint } from "@sentry/nextjs"
import { describe, expect, it } from "vitest"
import { isThirdPartyRsCrash } from "@/lib/sentry-filters"

const eventWithFrames = (fns: (string | undefined)[]): ErrorEvent =>
  ({
    exception: {
      values: [{ stacktrace: { frames: fns.map((f) => ({ function: f })) } }],
    },
  }) as ErrorEvent

const rsError = new TypeError(
  "Cannot read properties of null (reading 'parentNode')",
)

describe("isThirdPartyRsCrash", () => {
  it("droppe le crash $RS canonique (TypeError parentNode + frame $RS)", () => {
    const event = eventWithFrames(["<anonymous>", "$RS"])
    const hint: EventHint = { originalException: rsError }
    expect(isThirdPartyRsCrash(event, hint)).toBe(true)
  })

  it("laisse passer la même erreur sans frame $RS (code applicatif)", () => {
    const event = eventWithFrames(["handleClick", "commitRoot"])
    const hint: EventHint = { originalException: rsError }
    expect(isThirdPartyRsCrash(event, hint)).toBe(false)
  })

  it("laisse passer une erreur non-TypeError même avec frame $RS", () => {
    const event = eventWithFrames(["$RS"])
    const hint: EventHint = {
      originalException: new Error(
        "Cannot read properties of null (reading 'parentNode')",
      ),
    }
    expect(isThirdPartyRsCrash(event, hint)).toBe(false)
  })

  it("laisse passer une TypeError d'un autre message", () => {
    const event = eventWithFrames(["$RS"])
    const hint: EventHint = {
      originalException: new TypeError(
        "Cannot read properties of null (reading 'appendChild')",
      ),
    }
    expect(isThirdPartyRsCrash(event, hint)).toBe(false)
  })

  it("laisse passer un événement sans stacktrace", () => {
    const event = {} as ErrorEvent
    const hint: EventHint = { originalException: rsError }
    expect(isThirdPartyRsCrash(event, hint)).toBe(false)
  })
})
