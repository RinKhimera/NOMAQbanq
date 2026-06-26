# 02 — Better Auth (remplace l'auth Convex)

Better Auth possède ses propres tables (`user`, `session`, `account`, `verification`) et s'appuie
sur l'adaptateur Drizzle. Gabarits : `assets/auth.ts.md` (instance serveur), `assets/auth-guards.ts.md`
(gardes), `assets/permissions.ts.md` (rôles/permissions), `assets/schema-auth.ts.md` (tables).

> Versions : facts ci-dessous vérifiés contre **better-auth ^1.6.9**. Pour toute autre version, lis
> `node_modules/better-auth` / la doc de ta version — les signatures changent.

## Installation

```bash
bun add better-auth
```

## Mise en place (4 pièces)

1. **Instance serveur** `lib/auth.ts` — `betterAuth({ database: drizzleAdapter(db, { provider: 'pg', schema }), ... })`.
   Voir le gabarit. Éléments clés :
   - `emailAndPassword: { enabled: true, requireEmailVerification: true }`
   - `emailVerification: { sendVerificationEmail, sendOnSignUp, sendOnSignIn, autoSignInAfterVerification }`
   - `socialProviders: { google: { clientId, clientSecret } }`
   - `rateLimit: { storage: 'database' }` (voir gotcha)
   - `plugins: [adminPlugin({ ac, roles, defaultRole, adminRoles }), nextCookies()]` — **`nextCookies()`
     DOIT être le dernier plugin**.
2. **Handler unique** `app/api/auth/[...all]/route.ts` :

   ```ts
   import { toNextJsHandler } from "better-auth/next-js"
   import { auth } from "@/lib/auth"

   export const { GET, POST } = toNextJsHandler(auth)
   ```

3. **Client** `lib/auth-client.ts` :

   ```ts
   import { adminClient } from "better-auth/client/plugins"
   import { createAuthClient } from "better-auth/react"

   export const authClient = createAuthClient({ plugins: [adminClient()] })
   export const { signIn, signOut, signUp, useSession } = authClient
   ```

4. **Tables** dans `db/schema/auth.ts` (gabarit `assets/schema-auth.ts.md`), incluses dans le glob
   du schéma → migration générée par drizzle-kit.

## Rôles & permissions (plugin admin + Access Control)

Le projet source définit un Access Control typé (`createAccessControl`) fusionné avec les
`defaultStatements` du plugin admin, puis des rôles. Gabarit : `assets/permissions.ts.md`.

> **Piège critique** : `ac` et `roles` **doivent être passés au plugin admin**
> (`adminPlugin({ ac, roles, ... })`). Sinon l'AC est créé mais ignoré → permissions silencieusement
> inactives.

Gardes serveur (`assets/auth-guards.ts.md`) : `requireSession()`, `requireRole([...])`,
`requirePermission({ resource: ['action'] })`. À appeler dans **chaque** Server Action sensible
(défense en profondeur même avec un proxy/middleware).

## Migrer depuis l'auth Convex — réalités

| Tu venais de…                        | À faire                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Convex Auth** (`@convex-dev/auth`) | Recréer users dans la table `user`. Mots de passe : hash différent → **impossible à importer** ; forcer un _reset password_ au 1er login (ou ré-inscription).                                     |
| **Clerk via Convex**                 | Idem : pas d'import des hashes Clerk. Pour l'OAuth (Google…), l'utilisateur se reconnecte et Better Auth recrée la ligne `account`. Mapper Clerk `userId` → nouvel `user.id` si tu gardes des FK. |
| **Auth0 via Convex**                 | Idem. Réutiliser le même `clientId/secret` OAuth côté Better Auth pour ne pas re-consentir côté Google.                                                                                           |

**Les sessions ne se transfèrent jamais** : tout le monde se re-loggue après bascule. Planifie-le
(bannière, email). Le `user.id` peut être conservé si tu réinsères les users avec leur ancien id —
utile pour ne pas casser les FK des données migrées.

## Gotchas Better Auth (durement gagnés)

1. **`cookieCache` ne cache PAS les `additionalFields`** (ex. `role`) : chaque accès à
   `session.user.role` fait un hit DB. Les guards par rôle refetchent à chaque appel — pas un bug,
   juste pas de cache. Ne compte pas dessus pour la perf.
2. **`requireEmailVerification` ne bloque que `signInEmail`** ; les providers OAuth posent
   `emailVerified` depuis leur claim (Google : toujours vrai) → jamais bloqués.
3. **Sign-up avec vérification : aucune session créée** (`token: null`) et **réponse générique** si
   l'email est déjà pris (anti-énumération intégrée) → `USER_ALREADY_EXISTS` n'est plus émis sur ce
   chemin. L'UI doit rediriger vers une page « vérifie ton courriel », pas vers l'espace membre.
4. **Renvoi auto du lien au sign-in non vérifié** exige `emailVerification.sendOnSignIn: true`.
5. **Rate limit : `storage: 'database'`** obligatoire en serverless (le `memory` par défaut ne
   survit pas aux instances → limites contournables). Table `rate_limit` requise (`id`, `key`,
   `count`, `lastRequest` bigint). **Le rate limit n'est actif qu'en production** (défaut Better
   Auth) — invisible en dev. Endpoints sensibles déjà limités à 3 req/10 s (`/sign-in/*`,
   `/sign-up/*`, `/change-password`, `/change-email`).
6. **Ban (plugin admin)** : `auth.api.banUser({ body: { userId, banReason, banExpiresIn } })` —
   **`banExpiresIn` est en SECONDES**, **omis ⇒ ban permanent**. Sign-in d'un banni → `APIError`
   code `BANNED_USER` (le body n'inclut pas le motif). **Réactivation auto à l'expiration, pas de
   cron.** Les champs `banned`/`ban_reason`/`ban_expires` sont la source de vérité de l'accès.
7. **`setPassword` vs `changePassword`** : un user OAuth-only n'a pas de `account.password`. Pour un
   form de sécurité, dispatcher : a un password → `changePassword` (current+new) ; pas de password →
   `setPassword` (new). **Garde défensive obligatoire** : re-vérifier en DB qu'aucun password
   n'existe avant `setPassword` (sinon un session-hijacker bypasse le check de mot de passe actuel).
8. **`verifyPassword` > `signInEmail`** pour ré-authentifier (suppression de compte, action
   sensible) : `signInEmail` crée une nouvelle session comme effet de bord. Utiliser
   `auth.api.verifyPassword({ body: { password }, headers })` → `{ status: boolean }`.
9. **`auth.api.unlinkAccount` garde déjà contre le lockout** (refuse de délier le dernier provider).
   Garder un double-check DB par convention.
10. **Imports de plugins par chemin dédié** pour le tree-shaking :
    `import { admin } from 'better-auth/plugins/admin'` — pas `from 'better-auth/plugins'`.
11. **Table `verification` (Better Auth, singulier)** ≠ une éventuelle table métier `verifications`
    (pluriel). Ne pas confondre.
12. **OAuth tokens stockés en clair** par défaut dans `account`. Si tu appelles des API tierces au
    nom de l'user, activer `account: { encryptOAuthTokens: true }` (AES-256-GCM).
13. **Routes API ≠ guards qui redirigent** : `requireSession`/`requireRole`/`requirePermission`
    **redirigent** (inutilisables dans un route handler qui doit renvoyer 401/403). Pour une route
    handler, faire une garde dédiée qui **retourne `null`** (`auth.api.getSession` +
    `auth.api.userHasPermission`) puis `new Response(..., { status: 403 })`.
14. **Vercel + emails** : pour ne pas bloquer la réponse HTTP sur l'envoi d'email, configurer
    `advanced: { backgroundTasks: { handler: (p) => waitUntil(p) } }` (`@vercel/functions`).
15. **`auth.api.createUser` exige une session admin** — il ne peut pas bootstrapper le premier
    admin. Pour le premier admin : `signUpEmail` + UPDATE direct du rôle en DB via un script.
16. **Emails avec diacritiques dans la local-part** rejetés par `signUpEmail`
    (`amina.touré@x.com` → 400). Utiliser de l'ASCII avant le `@` dans les seeds/tests.

## Critère de fin de phase

Sign-up email + vérification fonctionnent, sign-in Google fonctionne, `requireSession()` protège une
page de test, et un `requireRole(['admin'])` redirige bien un non-admin.
