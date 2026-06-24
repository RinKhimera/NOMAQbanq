import { z } from "zod"

/** '' (present but empty) counts as absent. */
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

export const buildServerSchema = () =>
  z.object({
    DATABASE_URL: required("DATABASE_URL"), // pooled (runtime)
    DATABASE_URL_UNPOOLED: required("DATABASE_URL_UNPOOLED"), // direct (migrations)
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET").min(
      32,
      "BETTER_AUTH_SECRET : au moins 32 caractères requis",
    ),
    BETTER_AUTH_URL: requiredUrl("BETTER_AUTH_URL"),
    // Filled in Phase 4 (Better Auth Google provider); optional until then.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    // AWS SES (emails transactionnels) — optionnelles : l'app démarre sans,
    // `sendEmail` lève une erreur claire à l'usage si une valeur requise manque.
    SES_REGION: z.string().optional(),
    SES_ACCESS_KEY_ID: z.string().optional(),
    SES_SECRET_ACCESS_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SES_CONFIGURATION_SET: z.string().optional(),
    EMAIL_OVERRIDE_TO: z.string().optional(),
    // Stripe (paiements) — optionnelles : l'app démarre sans, le code Stripe
    // (`getStripe`/webhook) lève une erreur claire à l'usage si une valeur manque.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
  })
    // Garde-fou déploiement : dès que le checkout peut encaisser (clé secrète
    // présente), le webhook DOIT pouvoir vérifier sa signature — sinon les
    // paiements sont débités sans fulfillment (accès jamais accordé).
    .refine((e) => !(e.STRIPE_SECRET_KEY && !e.STRIPE_WEBHOOK_SECRET), {
      error:
        "STRIPE_WEBHOOK_SECRET : requise dès que STRIPE_SECRET_KEY est définie (sinon paiements encaissés sans fulfillment)",
      path: ["STRIPE_WEBHOOK_SECRET"],
    })

const formatError = (e: z.ZodError) =>
  `❌ Variables d'environnement invalides :\n` +
  e.issues.map((i) => `  • ${i.message}`).join("\n")

export type ServerEnv = z.infer<ReturnType<typeof buildServerSchema>>

let cache: ServerEnv | undefined
export const loadServerEnv = (
  source: Record<string, string | undefined> = process.env,
): ServerEnv => {
  if (cache && source === process.env) return cache
  const result = buildServerSchema().safeParse(stripEmpty(source))
  if (!result.success) throw new Error(formatError(result.error))
  if (source === process.env) cache = result.data
  return result.data
}
