import { defaultStackParser } from "@sentry/browser"
import type { ErrorEvent, EventHint } from "@sentry/nextjs"
import { describe, expect, it } from "vitest"
import {
  isHostBridgeRejection,
  isThirdPartyFetchRejection,
  isThirdPartyRsCrash,
} from "@/lib/sentry-filters"

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

const NEXT_FETCH_FRAMES = [
  "app:///_next/static/chunks/server-action-reducer.js",
  "app:///_next/static/chunks/segment-cache-fetch.js",
]

const rejection = ({
  type = "TypeError",
  value = "Failed to fetch",
  mechanism = "auto.browser.global_handlers.onunhandledrejection",
  filenames = [...NEXT_FETCH_FRAMES, "app:///frame_ant/frame_ant.js"],
}: {
  type?: string
  value?: string
  mechanism?: string
  filenames?: string[]
} = {}): ErrorEvent =>
  ({
    exception: {
      values: [
        {
          type,
          value,
          mechanism: { type: mechanism, handled: false },
          stacktrace: { frames: filenames.map((filename) => ({ filename })) },
        },
      ],
    },
  }) as ErrorEvent

describe("isThirdPartyFetchRejection", () => {
  it("droppe l'échec réseau d'une Server Action passé par un fetch enveloppé par une extension", () => {
    expect(isThirdPartyFetchRejection(rejection())).toBe(true)
  })

  it.each([
    "Load failed",
    "NetworkError when attempting to fetch resource.",
    "Failed to fetch (cdn.nomaqbanq.ca)",
  ])("reconnaît le message réseau « %s »", (value) => {
    expect(isThirdPartyFetchRejection(rejection({ value }))).toBe(true)
  })

  it.each(["signal is aborted without reason", "Failed to fetch dynamically"])(
    "laisse passer « %s », qui n'est pas un échec réseau",
    (value) => {
      expect(isThirdPartyFetchRejection(rejection({ value }))).toBe(false)
    },
  )

  it.each([
    "fetch@safari-web-extension://3F2A/frame_ant/frame_ant.js:12:34",
    "    at safari-extension:(//3284871F/topee-content.js):3313:26",
  ])(
    "reconnaît la frame d'extension Safari telle que le parseur du SDK la rend (%s)",
    (stackLine) => {
      const filenames = defaultStackParser(stackLine).map((f) => f.filename!)
      const event = rejection({
        filenames: [...NEXT_FETCH_FRAMES, ...filenames],
      })
      expect(isThirdPartyFetchRejection(event)).toBe(true)
    },
  )

  it("laisse passer une Error portant le même message (levée par notre code)", () => {
    expect(isThirdPartyFetchRejection(rejection({ type: "Error" }))).toBe(false)
  })

  it("laisse passer le même rejet quand toute la pile est notre bundle", () => {
    const event = rejection({ filenames: NEXT_FETCH_FRAMES })
    expect(isThirdPartyFetchRejection(event)).toBe(false)
  })

  it("ne prend pas un script inline (URL de page, sans .js) pour un script étranger", () => {
    const event = rejection({
      filenames: [...NEXT_FETCH_FRAMES, "app:///tableau-de-bord/entrainement"],
    })
    expect(isThirdPartyFetchRejection(event)).toBe(false)
  })

  it("laisse passer une erreur applicative même avec un script étranger dans la pile", () => {
    const event = rejection({ value: "Cannot read properties of undefined" })
    expect(isThirdPartyFetchRejection(event)).toBe(false)
  })

  it("laisse passer un échec réseau capturé par un autre mécanisme", () => {
    const event = rejection({
      mechanism: "auto.browser.global_handlers.onerror",
    })
    expect(isThirdPartyFetchRejection(event)).toBe(false)
  })

  it("laisse passer un événement sans exception", () => {
    expect(isThirdPartyFetchRejection({} as ErrorEvent)).toBe(false)
  })
})

const BRIDGE_VALUE =
  "Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4"

const stringRejection = (
  value: string,
  mechanism = "auto.browser.global_handlers.onunhandledrejection",
): ErrorEvent =>
  ({
    exception: {
      values: [
        {
          type: "UnhandledRejection",
          value,
          mechanism: { type: mechanism, handled: false },
        },
      ],
    },
  }) as ErrorEvent

describe("isHostBridgeRejection", () => {
  it("droppe le rejet du pont CefSharp d'un analyseur de liens", () => {
    expect(isHostBridgeRejection(stringRejection(BRIDGE_VALUE))).toBe(true)
  })

  it("reconnaît d'autres identifiants, méthodes et nombres de paramètres", () => {
    const value = BRIDGE_VALUE.replace(
      "Id:3, MethodName:update, ParamCount:4",
      "Id:12, MethodName:simulateEvent, ParamCount:1",
    )
    expect(isHostBridgeRejection(stringRejection(value))).toBe(true)
  })

  it.each([
    "Non-Error promise rejection captured with value: Object Not Found",
    "Non-Error promise rejection captured with value: undefined",
    `${BRIDGE_VALUE} dans notre code`,
  ])("laisse passer « %s », un autre rejet sans Error", (value) => {
    expect(isHostBridgeRejection(stringRejection(value))).toBe(false)
  })

  it("laisse passer le même message capturé par un autre mécanisme", () => {
    const event = stringRejection(
      BRIDGE_VALUE,
      "auto.browser.global_handlers.onerror",
    )
    expect(isHostBridgeRejection(event)).toBe(false)
  })

  it("laisse passer un événement sans exception", () => {
    expect(isHostBridgeRejection({} as ErrorEvent)).toBe(false)
  })
})
