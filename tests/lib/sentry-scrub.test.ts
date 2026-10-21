import type { ErrorEvent } from "@sentry/nextjs"
import { describe, expect, it } from "vitest"
import { scrubServerEvent, scrubServerSpan } from "@/lib/sentry-scrub"

const FAILED_QUERY =
  'Failed query: select "id" from "user" where "email" = $1\nparams: alice@example.com'

function span(attributes: Record<string, unknown>) {
  return {
    name: "GET /api/auth/[...all]/route",
    span_id: "1",
    trace_id: "2",
    start_timestamp: 0,
    end_timestamp: 1,
    status: "ok" as const,
    is_segment: true,
    attributes,
  }
}

describe("scrubServerEvent", () => {
  it("retire les paramètres SQL du message d'une erreur Drizzle", () => {
    const event = scrubServerEvent({
      type: undefined,
      exception: { values: [{ type: "Error", value: FAILED_QUERY }] },
    } as ErrorEvent)

    expect(event.exception?.values?.[0]?.value).toBe(
      'Failed query: select "id" from "user" where "email" = $1\nparams: [Filtered]',
    )
  })

  it("retire les paramètres SQL d'une erreur journalisée dans le fil d'Ariane", () => {
    const event = scrubServerEvent({
      type: undefined,
      breadcrumbs: [{ category: "console", message: `action ${FAILED_QUERY}` }],
    } as ErrorEvent)

    expect(event.breadcrumbs?.[0]?.message).toBe(
      'action Failed query: select "id" from "user" where "email" = $1\nparams: [Filtered]',
    )
  })

  it("masque le jeton de réinitialisation dans l'URL de la requête", () => {
    const event = scrubServerEvent({
      type: undefined,
      request: {
        url: "https://nomaqbanq.ca/api/auth/reset-password/abc123?callbackURL=%2F",
      },
    } as ErrorEvent)

    expect(event.request?.url).toBe(
      "https://nomaqbanq.ca/api/auth/reset-password/[Filtered]?callbackURL=%2F",
    )
  })

  it("laisse intact un message sans paramètres SQL", () => {
    const event = scrubServerEvent({
      type: undefined,
      exception: { values: [{ type: "Error", value: "TIME_UP" }] },
    } as ErrorEvent)

    expect(event.exception?.values?.[0]?.value).toBe("TIME_UP")
  })
})

describe("scrubServerSpan", () => {
  it("retire la query string de http.target", () => {
    const result = scrubServerSpan(
      span({ "http.target": "/reinitialiser-mot-de-passe?token=abc123" }),
    )

    expect(result.attributes?.["http.target"]).toBe(
      "/reinitialiser-mot-de-passe",
    )
  })

  it("masque le jeton de réinitialisation dans http.target, url.path et url.full", () => {
    const result = scrubServerSpan(
      span({
        "http.target": "/api/auth/reset-password/abc123?callbackURL=%2F",
        "url.path": "/api/auth/reset-password/abc123",
        "url.full":
          "https://nomaqbanq.ca/api/auth/reset-password/abc123?callbackURL=%2F",
      }),
    )

    expect(result.attributes).toMatchObject({
      "http.target": "/api/auth/reset-password/[Filtered]",
      "url.path": "/api/auth/reset-password/[Filtered]",
      "url.full":
        "https://nomaqbanq.ca/api/auth/reset-password/[Filtered]?callbackURL=%2F",
    })
  })

  it("laisse intact un span sans URL", () => {
    const result = scrubServerSpan(span({ "db.system": "postgresql" }))

    expect(result.attributes).toEqual({ "db.system": "postgresql" })
  })
})
