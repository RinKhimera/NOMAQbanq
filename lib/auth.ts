import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins/admin"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { sendResetPassword, sendVerificationEmail } from "@/email"
import { isGraceExpired } from "@/features/users/lib/account-deletion"
import { getBaseUrl } from "@/lib/base-url"
import { env } from "@/lib/env/server"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: getBaseUrl(),
  // Serverless: la table rate_limit (déjà créée) survit aux instances. Actif en prod uniquement.
  // customRules : l'endpoint de reset n'est pas couvert par les limites par défaut → on le
  // borne (3 demandes / minute / IP) pour éviter le spam de courriels SES (review M4).
  rateLimit: {
    storage: "database",
    customRules: {
      "/request-password-reset": { window: 60, max: 3 },
      "/forget-password": { window: 60, max: 3 },
      // Renvoi de vérification : borné comme le reset (anti-spam SES).
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  // Rattache automatiquement Google aux users migrés (même email) en préservant leur id.
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  // Suppression douce (grâce 30 j) :
  //  - before : bloque la connexion d'un compte dont la grâce est expirée
  //    (en attente d'anonymisation par le cron).
  //  - after  : réactive (efface deletedAt) un compte supprimé qui se reconnecte
  //    DANS la fenêtre de grâce → « se reconnecter annule la suppression ».
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [u] = await db
            .select({ deletedAt: schema.user.deletedAt })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .limit(1)
          if (u?.deletedAt && isGraceExpired(u.deletedAt, Date.now())) {
            return false
          }
        },
        after: async (session) => {
          const [u] = await db
            .select({ deletedAt: schema.user.deletedAt })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .limit(1)
          if (u?.deletedAt) {
            await db
              .update(schema.user)
              .set({ deletedAt: null })
              .where(eq(schema.user.id, session.userId))
          }
        },
      },
    },
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
    // Bloque la connexion d'un compte email/mdp non vérifié (review M2). N'affecte
    // PAS Google (emailVerified=true) ni les users migrés (déjà email_verified=true) ;
    // ne concerne que les nouvelles inscriptions email.
    requireEmailVerification: true,
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
    // Compte non vérifié qui tente de se connecter → renvoi auto du lien (puis
    // erreur EMAIL_NOT_VERIFIED). Débloque la « zone grise » des nouveaux inscrits.
    sendOnSignIn: true,
  },
  // Google configuré UNIQUEMENT si les deux creds sont présents — évite le
  // `clientId: ""` qui cassait Google silencieusement (review N3).
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
  // Le plugin admin n'est configuré que pour porter `role` sur session.user :
  // ses endpoints HTTP ne sont pas utilisés par l'app et contournent les
  // gardes applicatives (auto-modification, dernier admin) de updateUserRole /
  // deleteMyAccount → fermés au routeur (404). Match EXACT : re-vérifier la
  // liste à chaque montée de version de better-auth.
  disabledPaths: [
    "/admin/set-role",
    "/admin/get-user",
    "/admin/create-user",
    "/admin/update-user",
    "/admin/list-users",
    "/admin/list-user-sessions",
    "/admin/unban-user",
    "/admin/ban-user",
    "/admin/impersonate-user",
    "/admin/stop-impersonating",
    "/admin/revoke-user-session",
    "/admin/revoke-user-sessions",
    "/admin/remove-user",
    "/admin/set-user-password",
    "/admin/has-permission",
  ],
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // ⚠️ DOIT rester le dernier plugin
  ],
})

export type Session = typeof auth.$Infer.Session
