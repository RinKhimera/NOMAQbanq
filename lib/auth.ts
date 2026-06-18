import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins/admin"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { sendResetPassword, sendVerificationEmail } from "@/email"
import { env } from "@/lib/env/server"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  // Serverless: la table rate_limit (déjà créée) survit aux instances. Actif en prod uniquement.
  rateLimit: { storage: "database" },
  // Rattache automatiquement Google aux users migrés (même email) en préservant leur id.
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  // Colonnes hors-cœur exposées sur `session.user` (le rôle vient du plugin admin).
  // `input: false` → non modifiables au sign-up ; mises à jour via l'action profil.
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    // ⚠️ requireEmailVerification : NON défini ici. L'enforcement de la vérification et
    //    le backfill `emailVerified` des users migrés sont gérés par la session migration.
    sendResetPassword: async ({ user, url }) => {
      await sendResetPassword({ to: user.email, url })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url })
    },
    sendOnSignUp: true, // l'email part à l'inscription ; n'impose rien sans requireEmailVerification
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // ⚠️ DOIT rester le dernier plugin
  ],
})

export type Session = typeof auth.$Infer.Session
