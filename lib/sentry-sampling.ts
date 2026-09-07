import type * as Sentry from "@sentry/nextjs"

// Type dérivé des options de `Sentry.init` : `@sentry/core` n'est pas une
// dépendance directe et `@sentry/nextjs` ne réexporte pas le type du contexte.
type TracesSampler = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>["tracesSampler"]
>
type SamplingContext = Parameters<TracesSampler>[0]

export const SERVER_TRACE_SAMPLE_RATE = 0.1

// Les seuls chemins où un span complet a une valeur d'enquête (litiges,
// fulfillment, clôtures) — tout le reste est du rendu de page. `ctx.name`
// vaut `<MÉTHODE> <chemin>` pour un span serveur.
const FULL_TRACE_ROUTES = [/\/api\/stripe\/webhook/, /\/api\/cron\//]

// Un trace initié par le navigateur hérite de la décision client (5 % en
// prod) ; les 10 % ne s'appliquent qu'aux traces sans parent.
export function serverTracesSampler(ctx: SamplingContext): number {
  if (FULL_TRACE_ROUTES.some((re) => re.test(ctx.name))) return 1
  return ctx.inheritOrSampleWith(SERVER_TRACE_SAMPLE_RATE)
}
