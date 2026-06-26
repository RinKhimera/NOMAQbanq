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
  z
    .object({
      DATABASE_URL: required("DATABASE_URL"), // pooled (runtime)
      DATABASE_URL_UNPOOLED: required("DATABASE_URL_UNPOOLED"), // direct (migrations)
      BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET").min(
        32,
        "BETTER_AUTH_SECRET : au moins 32 caractères requis",
      ),
      // Optionnel : sur Vercel, dérivée à l'exécution via `getBaseUrl()`
      // (lib/base-url.ts) depuis VERCEL_PROJECT_PRODUCTION_URL / VERCEL_BRANCH_URL.
      // Sert d'override explicite (dev local → http://localhost:3000, ou pin manuel).
      BETTER_AUTH_URL: z
        .url({ error: "BETTER_AUTH_URL : URL invalide" })
        .optional(),
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
      // AWS S3 (stockage médias) — optionnelles : l'app démarre sans, `lib/aws.ts`
      // lève une erreur claire à l'usage. REGION+ROLE_ARN+BUCKET vont ensemble (refine).
      // Auth via OIDC (AWS_ROLE_ARN) en prod/preview. Clés statiques = fallback dev local.
      // ⚠️ Région = `S3_REGION` (PAS `AWS_REGION`) : sur Vercel/Lambda, `AWS_REGION` est
      // une var réservée du runtime (région de la fonction) qui primerait sur la nôtre
      // → on signerait pour la mauvaise région (403). `S3_REGION` est sous notre contrôle.
      S3_REGION: z.string().optional(),
      AWS_ROLE_ARN: z.string().optional(),
      S3_BUCKET: z.string().optional(),
      AWS_ACCESS_KEY_ID: z.string().optional(),
      AWS_SECRET_ACCESS_KEY: z.string().optional(),
      // Mode maintenance (« blocus ») — `MAINTENANCE_MODE="1"` → `proxy.ts` répond
      // 503 partout (gel des écritures, ex. pendant la bascule Convex → Neon).
      // Lu DIRECTEMENT par `proxy.ts` (qui reste autonome) ; déclaré ici pour
      // documentation/validation. Token de contournement ops optionnel (smoke-test).
      MAINTENANCE_MODE: z.string().optional(),
      MAINTENANCE_BYPASS_TOKEN: z.string().optional(),
    })
    // Garde-fou déploiement : dès que le checkout peut encaisser (clé secrète
    // présente), le webhook DOIT pouvoir vérifier sa signature — sinon les
    // paiements sont débités sans fulfillment (accès jamais accordé).
    .refine((e) => !(e.STRIPE_SECRET_KEY && !e.STRIPE_WEBHOOK_SECRET), {
      error:
        "STRIPE_WEBHOOK_SECRET : requise dès que STRIPE_SECRET_KEY est définie (sinon paiements encaissés sans fulfillment)",
      path: ["STRIPE_WEBHOOK_SECRET"],
    })
    // Garde-fou S3 : un bucket exige une région + des credentials, et AWS_ROLE_ARN
    // (var S3-spécifique) exige un bucket. `S3_REGION` est INCLUS (sans région le
    // presign signe pour la mauvaise région). Credentials = OIDC (AWS_ROLE_ARN) en
    // prod/preview, OU clés statiques (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY) dev.
    .refine(
      (e) => {
        if (e.S3_BUCKET) {
          return Boolean(
            e.S3_REGION &&
            (e.AWS_ROLE_ARN ||
              (e.AWS_ACCESS_KEY_ID && e.AWS_SECRET_ACCESS_KEY)),
          )
        }
        return !e.AWS_ROLE_ARN
      },
      {
        error:
          "Configuration AWS S3 incomplète : S3_BUCKET nécessite S3_REGION + des credentials (AWS_ROLE_ARN pour OIDC prod/preview, ou AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY pour le dev local) ; et AWS_ROLE_ARN nécessite S3_BUCKET",
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
