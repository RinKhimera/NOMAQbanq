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
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
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
    // Prod Vercel : ARN du rôle IAM assumé via OIDC (remplace les clés statiques). Vide en local.
    AWS_ROLE_ARN: z.string().optional(),
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
