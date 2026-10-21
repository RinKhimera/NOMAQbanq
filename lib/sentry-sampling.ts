import type * as Sentry from "@sentry/nextjs"

// Type dérivé des options de `Sentry.init` : `@sentry/core` n'est pas une
// dépendance directe et `@sentry/nextjs` ne réexporte pas le type du contexte.
type TracesSampler = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>["tracesSampler"]
>
type SamplingContext = Parameters<TracesSampler>[0]

export const SERVER_TRACE_SAMPLE_RATE = 0.1

// Les seuls chemins où un span complet a une valeur d'enquête (litiges,
// fulfillment, clôtures) — tout le reste est du rendu de page.
const FULL_TRACE_ROUTES = [/^\/api\/stripe\/webhook\/?$/, /^\/api\/cron\//]

// Le sampler tourne AVANT le démarrage du span : le span racine de Next ne
// s'appelle alors que `POST` et la route n'est posée qu'ensuite. Seuls les
// attributs initiaux (`http.target` chez Next, `url.path` en convention
// Sentry) portent déjà le chemin ; le nom (`<MÉTHODE> <chemin>`) reste un
// repli. `http.target` inclut la query : sans la retirer, `?x=/api/cron/`
// forcerait n'importe quelle page à 100 %.
function requestPath(ctx: SamplingContext): string {
  const { attributes } = ctx
  const target =
    [attributes["url.path"], attributes["http.target"]].find(
      (value): value is string => typeof value === "string",
    ) ?? ctx.name.replace(/^[A-Z]+ /, "")
  return target.split("?", 1)[0] ?? ""
}

// Un trace initié par le navigateur hérite de la décision client (5 % en
// prod) ; les 10 % ne s'appliquent qu'aux traces sans parent.
export function serverTracesSampler(ctx: SamplingContext): number {
  const path = requestPath(ctx)
  if (FULL_TRACE_ROUTES.some((re) => re.test(path))) return 1
  return ctx.inheritOrSampleWith(SERVER_TRACE_SAMPLE_RATE)
}
