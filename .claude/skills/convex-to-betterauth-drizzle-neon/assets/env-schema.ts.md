# Gabarit → `lib/env/schema.ts` (+ `server.ts`)

Validation env centralisée par zod : fait **échouer le boot** si une variable requise manque.
Schémas purs (aucun import Next / `server-only`) → réutilisables partout. Trimé à un jeu de variables
représentatif ; ajoute les tiennes.

```ts
// lib/env/schema.ts
import { z } from "zod"

/** '' (présent mais vide) = absent. */
export const stripEmpty = (
  source: Record<string, string | undefined>,
): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(source)) out[k] = v === "" ? undefined : v
  return out
}

const required = (label: string) =>
  z.string({ error: `${label} : requise mais manquante ou vide` })
const requiredUrl = (label: string) =>
  z.url({ error: `${label} : URL invalide ou manquante` })

/** Prod-like = prod/preview Vercel, sinon NODE_ENV. */
export const isProdLike = (
  s: Record<string, string | undefined> = process.env,
): boolean =>
  s.VERCEL_ENV === "production" ||
  s.VERCEL_ENV === "preview" ||
  (!s.VERCEL_ENV && s.NODE_ENV === "production")

export const clientSchema = z.object({
  NEXT_PUBLIC_BETTER_AUTH_URL: requiredUrl("NEXT_PUBLIC_BETTER_AUTH_URL"),
  NEXT_PUBLIC_SITE_URL: requiredUrl("NEXT_PUBLIC_SITE_URL"),
})

export const buildServerSchema = (prodLike: boolean) =>
  z
    .object({
      DATABASE_URL: required("DATABASE_URL"), // pooled (runtime)
      DATABASE_URL_UNPOOLED: required("DATABASE_URL_UNPOOLED"), // direct (migrations)
      BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
      BETTER_AUTH_URL: requiredUrl("BETTER_AUTH_URL"),
      GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
      // Requise en prod uniquement (les crons n'existent qu'en prod) :
      CRON_SECRET: prodLike ? required("CRON_SECRET") : z.string().optional(),
      // ADAPT: ajoute RESEND_API_KEY, STRIPE_*, storage, etc.
    })
    .extend(clientSchema.shape) // côté serveur on a accès à tout

const formatError = (e: z.ZodError) =>
  `❌ Variables d'environnement invalides :\n` +
  e.issues.map((i) => `  • ${i.message}`).join("\n")

export type ServerEnv = z.infer<ReturnType<typeof buildServerSchema>>

let cache: ServerEnv | undefined
export const loadServerEnv = (
  source: Record<string, string | undefined> = process.env,
): ServerEnv => {
  if (cache && source === process.env) return cache
  const result = buildServerSchema(isProdLike(source)).safeParse(
    stripEmpty(source),
  )
  if (!result.success) throw new Error(formatError(result.error))
  if (source === process.env) cache = result.data
  return result.data
}
```

```ts
// lib/env/server.ts — NE PAS importer dans un fichier 'use client'.
import { loadServerEnv } from "./schema"

export const env = loadServerEnv()
```

> Côté client, faire un `lib/env/client.ts` qui accède aux `NEXT_PUBLIC_*` **littéralement**
> (`process.env.NEXT_PUBLIC_X`) — Next n'inline que les références explicites.
