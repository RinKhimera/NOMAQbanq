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

export const buildServerSchema = () =>
  z.object({
    DATABASE_URL: required("DATABASE_URL"), // pooled (runtime)
    DATABASE_URL_UNPOOLED: required("DATABASE_URL_UNPOOLED"), // direct (migrations)
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET").min(
      32,
      "BETTER_AUTH_SECRET : au moins 32 caractères requis",
    ),
    // Optionnel : sur Vercel, dérivée à l'exécution via `getBaseUrl()`
    // (lib/base-url.ts) depuis VERCEL_PROJECT_PRODUCTION_URL / VERCEL_BRANCH_URL.
    // Sert d'override explicite (dev local → http://localhost:3000, ou pin manuel).
    BETTER_AUTH_URL: z.url({ error: "BETTER_AUTH_URL : URL invalide" }).optional(),
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
    // Cron Vercel — secret partagé (Vercel l'envoie en `Authorization: Bearer`).
    // Optionnel : sans lui, la route cron répond 401 (fail-closed).
    CRON_SECRET: z.string().optional(),
    // Support E2E (reset/cleanup des données de test sur develop). Optionnel :
    // sans lui la route `/api/e2e` répond 404. NE JAMAIS définir en prod Vercel
    // (la route refuse aussi si `VERCEL_ENV === "production"`).
    E2E_RESET_SECRET: z.string().optional(),
    // Bunny.net (stockage médias avatars/images questions) — optionnelles :
    // l'app démarre sans, `getBunnyConfig()` lève une erreur claire à l'usage si
    // une valeur manque. Les trois vont ensemble (cf. `.refine` ci-dessous).
    BUNNY_STORAGE_ZONE_NAME: z.string().optional(),
    BUNNY_STORAGE_API_KEY: z.string().optional(),
    BUNNY_CDN_HOSTNAME: z.string().optional(),
    // AWS S3 (stockage médias) — optionnelles : l'app démarre sans, `lib/aws.ts`
    // lève une erreur claire à l'usage. ROLE_ARN+BUCKET vont ensemble (refine).
    // Auth via OIDC (AWS_ROLE_ARN) en prod/preview. AWS_REGION pinné (Vercel le
    // définit dynamiquement sinon). Clés statiques = fallback dev local.
    AWS_REGION: z.string().optional(),
    AWS_ROLE_ARN: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
  })
    // Garde-fou déploiement : dès que le checkout peut encaisser (clé secrète
    // présente), le webhook DOIT pouvoir vérifier sa signature — sinon les
    // paiements sont débités sans fulfillment (accès jamais accordé).
    .refine((e) => !(e.STRIPE_SECRET_KEY && !e.STRIPE_WEBHOOK_SECRET), {
      error:
        "STRIPE_WEBHOOK_SECRET : requise dès que STRIPE_SECRET_KEY est définie (sinon paiements encaissés sans fulfillment)",
      path: ["STRIPE_WEBHOOK_SECRET"],
    })
    // Garde-fou : la config Bunny est tout-ou-rien. Dès qu'une des trois vars est
    // présente, les trois doivent l'être (sinon `getBunnyConfig` lèverait à
    // l'usage avec une config partielle trompeuse).
    .refine(
      (e) => {
        const set = [
          e.BUNNY_STORAGE_ZONE_NAME,
          e.BUNNY_STORAGE_API_KEY,
          e.BUNNY_CDN_HOSTNAME,
        ].filter(Boolean).length
        return set === 0 || set === 3
      },
      {
        error:
          "Configuration Bunny incomplète : BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY et BUNNY_CDN_HOSTNAME doivent être définies ensemble",
        path: ["BUNNY_STORAGE_ZONE_NAME"],
      },
    )
    // Garde-fou : ROLE_ARN et BUCKET vont ensemble. (AWS_REGION exclu du refine :
    // Vercel le définit automatiquement, donc sa présence seule n'indique rien.)
    .refine(
      (e) => {
        const set = [e.AWS_ROLE_ARN, e.S3_BUCKET].filter(Boolean).length
        return set === 0 || set === 2
      },
      {
        error:
          "Configuration AWS S3 incomplète : AWS_ROLE_ARN et S3_BUCKET doivent être définis ensemble (et AWS_REGION pinné)",
        path: ["S3_BUCKET"],
      },
    )

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
