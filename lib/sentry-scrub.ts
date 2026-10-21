import type * as Sentry from "@sentry/nextjs"
import type { ErrorEvent } from "@sentry/nextjs"

type StreamedSpan = Parameters<
  NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>["beforeSendSpan"]>
>[0]

const FILTERED = "[Filtered]"

// `DrizzleQueryError` écrit les paramètres liés dans son message
// (`Failed query: …\nparams: …`) : `dataCollection.databaseQueryData` ne
// couvre que les spans, pas le texte d'une exception ni sa trace console.
const QUERY_PARAMS = /(\nparams: )[\s\S]*$/

// Seule route Better Auth qui porte un secret dans le chemin, hors de portée
// de `dataCollection.urlQueryParams` qui ne filtre que la query.
const RESET_PASSWORD_TOKEN = /(\/reset-password\/)[^/?#]+/

const URL_ATTRIBUTES = ["url.full", "url.path"] as const

function scrubQueryParams(text: string): string {
  return text.replace(QUERY_PARAMS, `$1${FILTERED}`)
}

function scrubPathSecrets(url: string): string {
  return url.replace(RESET_PASSWORD_TOKEN, `$1${FILTERED}`)
}

export function scrubServerEvent(event: ErrorEvent): ErrorEvent {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubQueryParams(exception.value)
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) {
      breadcrumb.message = scrubQueryParams(breadcrumb.message)
    }
  }
  if (event.request?.url) {
    event.request.url = scrubPathSecrets(event.request.url)
  }
  return event
}

// `http.target` est posé brut par Next (`req.url`), query comprise ; le SDK
// filtre déjà la query de `url.full` et la reporte dans `url.query`.
export function scrubServerSpan(span: StreamedSpan): StreamedSpan {
  const { attributes } = span
  if (!attributes) return span

  const target = attributes["http.target"]
  if (typeof target === "string") {
    attributes["http.target"] = scrubPathSecrets(target.split("?", 1)[0] ?? "")
  }
  for (const key of URL_ATTRIBUTES) {
    const value = attributes[key]
    if (typeof value === "string") attributes[key] = scrubPathSecrets(value)
  }
  return span
}
