# Refonte UX du flux d'authentification email/mot de passe

**Date** : 2026-06-24
**Statut** : design validé, prêt pour le plan d'implémentation
**Auteur** : brainstorming Samuel + Claude

## Contexte et cause racine

Symptôme rapporté : impossible de se connecter en email/mot de passe avec
`astridenanou@gmail.com` (« courriel ou mot de passe incorrect »), alors que
Google fonctionne. L'inscription email/mdp affichait « Compte créé avec succès »
puis redirigeait vers la page de connexion, où la connexion échouait ensuite.

Diagnostic (base Neon `lucky-waterfall-33371811`, branche dev
`br-restless-morning-ad4uyo3t`) :

- `astridenanou@gmail.com` existe (`user`, `email_verified = true`, créée le
  2025-11-29) mais **n'a aucune ligne `account`** : ni `google`, ni `credential`.
  C'est un **compte migré de Convex/Clerk** : la migration a importé les `user`
  sans les identifiants (les mots de passe vivaient chez Clerk, non exportables).
- **183 utilisateurs sur 187 sont dans cet état** (aucun `account`). Seuls 3 ont
  un mot de passe et 1 a Google lié. C'est donc un problème **systémique**, pas un
  cas isolé.

Deux comportements de Better Auth 1.6.19 expliquent l'expérience :

1. **Inscription avec un email existant → faux succès silencieux.**
   `node_modules/better-auth/dist/api/routes/sign-up.mjs:161-208` : comme
   `requireEmailVerification: true`, `shouldReturnGenericDuplicateResponse` est
   vrai → Better Auth renvoie un utilisateur **synthétique non persisté**
   (`token: null`) **sans rien écrire**. C'est sa protection **anti-énumération
   d'emails**. D'où « Compte créé avec succès » sans qu'aucun credential ne soit
   créé.
2. **Connexion sans credential → `INVALID_EMAIL_OR_PASSWORD`.** Aucun mot de passe
   stocké → message générique « incorrect », sans guidance.
3. **Le flow reset répare le cas.** `password.mjs:152` : si aucun compte
   `credential` n'existe, `resetPassword` **en crée un**. `requestPasswordReset`
   (`password.mjs:50`) n'exige pas de credential préexistant. Et comme les migrés
   ont `email_verified = true`, ils ne sont pas bloqués par la vérification après
   reset.
4. **Connexion d'un compte non vérifié.** `sign-in.mjs:230-242` : lève
   `EMAIL_NOT_VERIFIED` (distinct de « incorrect ») ; si
   `emailVerification.sendOnSignIn` est vrai, **renvoie le lien automatiquement**.

## Objectif

Rendre l'expérience d'authentification email/mot de passe lisible et sans
cul-de-sac : guider l'utilisateur vers la bonne porte (Google, reset, vérification
d'email) **sans affaiblir l'anti-énumération ni `requireEmailVerification`**.

## Décisions de conception (validées)

| #         | Décision                                                                      | Choix retenu                                                    |
| --------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Périmètre | A guidage connexion · B flux inscription · C vérif/renvoi · D mapping erreurs | **Les quatre**                                                  |
| Q2        | Inscription doublon                                                           | **Générique honnête** (garder anti-énumération)                 |
| Q3        | Écran « vérifiez votre courriel »                                             | **État inline** dans les forms + `sendOnSignIn` + renvoi manuel |
| Q4        | Échec de connexion                                                            | **Alerte inline persistante actionnable**                       |

Rejeté : révéler « courriel déjà utilisé » (énumération + toucherait à la config
sécu M2). Reporté : campagne email « définissez votre mot de passe » aux 183
migrés.

## Architecture

Unités isolées, chacune testable seule :

- **`lib/auth-errors.ts`** — logique pure (codes → `{ kind, message }`).
- **`app/(auth)/auth/_components/check-email-notice.tsx`** — UI réutilisable
  (affichage + renvoi de lien).
- **Les deux forms** — orchestration (appellent `authClient`, branchent sur
  `kind`, rendent l'état approprié).

### 1. Config Better Auth — `lib/auth.ts`

Changements additifs, posture sécu inchangée :

```ts
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => { … }, // inchangé
  sendOnSignUp: true,                                     // inchangé
  autoSignInAfterVerification: true,                     // inchangé
  sendOnSignIn: true,                                    // AJOUT
},
rateLimit: {
  storage: "database",
  customRules: {
    "/request-password-reset": { window: 60, max: 3 }, // inchangé
    "/forget-password":        { window: 60, max: 3 }, // inchangé
    "/send-verification-email":{ window: 60, max: 3 }, // AJOUT (anti-spam SES)
  },
},
```

Inchangés : `requireEmailVerification: true`, `accountLinking`, providers.

### 2. Helper `lib/auth-errors.ts`

Fonction pure, **seule source de vérité** des messages FR. Mappe l'objet erreur du
client Better Auth (`{ code, message }`) vers un résultat structuré qui pilote
l'UI :

```ts
type AuthErrorKind = "invalid_credentials" | "email_not_verified" | "generic"
function mapAuthError(error: { code?: string; message?: string }): {
  kind: AuthErrorKind
  message: string
}
```

| `error.code`                            | `kind`                | message FR                                                                                |
| --------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `INVALID_EMAIL_OR_PASSWORD`             | `invalid_credentials` | (la copie est portée par l'alerte, cf. §5)                                                |
| `EMAIL_NOT_VERIFIED`                    | `email_not_verified`  | (déclenche `CheckEmailNotice`, cf. §3)                                                    |
| `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | `generic`             | « Ce courriel ne peut pas être utilisé pour créer un compte. Essayez de vous connecter. » |
| `TOO_MANY_REQUESTS` / 429               | `generic`             | « Trop de tentatives. Réessayez dans une minute. »                                        |
| défaut                                  | `generic`             | « Une erreur est survenue. Veuillez réessayer. »                                          |

`USER_ALREADY_EXISTS` est rarement levé (le doublon renvoie un faux succès), mais
mappé par défense.

### 3. Composant `CheckEmailNotice` (inline)

`app/(auth)/auth/_components/check-email-notice.tsx`. Props :

```ts
{
  email: string
  mode: "signup" | "verify"
}
```

- Affiche l'adresse, un bouton **Renvoyer le lien**, un pied « Pas reçu ?
  Vérifiez vos indésirables ».
- Renvoi → `authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" })`
  (nom exact de la méthode à confirmer dans `node_modules` au moment du code).
- **Cooldown** client ~45 s : bouton désactivé → « Renvoyer dans {n} s ».
- Toast succès « Lien renvoyé. » ; 429 → message du helper.
- `data-testid="auth-check-email"`, `data-testid="auth-resend"`.

Copie selon `mode` :

- `mode="signup"` (générique, anti-énumération) :
  - Titre : « Vérifiez votre boîte courriel »
  - Corps : « Si **{email}** n'est pas déjà associée à un compte, un lien de
    confirmation vient d'y être envoyé. Cliquez-le pour activer votre compte. »
  - Aide : « Vous avez déjà un compte ? Connectez-vous ou réinitialisez votre mot
    de passe. »
- `mode="verify"` (le compte existe mais n'est pas vérifié — Better Auth lève déjà
  `EMAIL_NOT_VERIFIED` pour ce cas) :
  - Titre : « Confirmez votre adresse courriel »
  - Corps : « Votre compte n'est pas encore activé. Nous venons de renvoyer un
    lien de confirmation à **{email}**. »

### 4. Form d'inscription — `sign-up-form.tsx`

- **Sur succès** : supprimer `router.push("/dashboard")` (bug : aucune session
  avec `requireEmailVerification`) → basculer l'affichage vers
  `<CheckEmailNotice email={values.email} mode="signup" />`. Couvre le nouvel
  inscrit ET le doublon de façon identique.
- Sur erreur → **alerte inline** (même composant `Alert` qu'en connexion) avec le
  message de `mapAuthError`, par cohérence. La validation de champs reste gérée par
  zod/react-hook-form.
- État local : `const [submittedEmail, setSubmittedEmail] = useState<string|null>`.
  Si non-null → rendre `CheckEmailNotice` à la place du form.

### 5. Form de connexion — `sign-in-form.tsx`

Brancher sur `kind` :

- `invalid_credentials` → **alerte inline persistante** (shadcn `Alert`,
  `variant="destructive"`, `data-testid="auth-error-alert"`) au-dessus du form :
  - Titre : « Connexion impossible »
  - « Vérifiez votre courriel et votre mot de passe. »
  - « Inscrit avec Google ? Utilisez « Continuer avec Google » ci-dessus. »
  - « Vous n'avez pas encore de mot de passe ? **Réinitialisez-le** » → lien
    `/auth/forgot-password`.
- `email_not_verified` → basculer vers
  `<CheckEmailNotice email={values.email} mode="verify" />` (le lien a déjà été
  renvoyé par `sendOnSignIn`).
- `generic` → alerte inline avec le message du helper.
- Succès → `router.push("/dashboard")` inchangé.

Remplacer le `toast.error` actuel par l'alerte inline (le toast disparaît, l'alerte
persiste et porte les liens d'action). Le toast reste pour le succès.

### 6. Cohérence forgot/reset

Vérifier que la page [forgot-password](<app/(auth)/auth/forgot-password/page.tsx>)
affiche un message **générique** (« Si ce courriel existe, un lien de
réinitialisation a été envoyé »). Better Auth renvoie déjà générique côté serveur ;
aligner uniquement la copie si nécessaire. Aucune logique serveur à changer : le
reset crée le credential pour les migrés.

## Flux de données

- **Inscription** : form → `authClient.signUp.email` → succès (`token: null`) →
  rendre `CheckEmailNotice(signup)`. Renvoi → `sendVerificationEmail`.
- **Connexion** : form → `authClient.signIn.email` → `error.code` :
  - `invalid` → alerte inline + lien reset
  - `email_not_verified` → `CheckEmailNotice(verify)`
  - succès → `/dashboard`
- **Clic sur le lien d'email** : GET `/verify-email` (géré par Better Auth) →
  `autoSignInAfterVerification` → redirige vers `callbackURL` (`/dashboard`).
  Aucune nouvelle page nécessaire.

## Gestion d'erreurs / cas limites

- **Rate-limit renvoi/reset** : borné en `customRules` ; 429 → message dédié.
- **Cooldown client** sur le renvoi pour éviter le martèlement (et le spam SES).
- **Envoi SES en arrière-plan** (`runInBackgroundOrAwait`) : un échec d'envoi n'est
  pas remonté à l'utilisateur — d'où l'affordance « Pas reçu ? Renvoyer ».
- **Lien de vérification expiré** : Better Auth redirige vers `callbackURL` avec un
  `?error=...`. Cas limite mineur : lire le param d'erreur sur la page de connexion
  et afficher un message générique invitant à se réinscrire / renvoyer. À traiter
  si peu coûteux, sinon backlog.

## Tests

- **Unit (Vitest)** : `lib/auth-errors.ts` — chaque code → `kind`/message attendu,
  défaut inclus.
- **Composant (happy-dom)** : `authClient` mocké — l'inscription bascule vers
  `CheckEmailNotice` ; la connexion rend l'alerte inline sur `invalid` et
  `CheckEmailNotice(verify)` sur `email_not_verified` ; cooldown du renvoi.
- **E2E (Playwright, Better Auth)** :
  - inscription nouvel email → écran check-email affiché ;
  - connexion mauvais mot de passe → alerte avec lien « Réinitialisez-le » visible.
  - Cas migré (user sans credential) : optionnel, nécessite un seed via l'API e2e.
- **`data-testid`** : `auth-error-alert`, `auth-check-email`, `auth-resend`.
- Respecter `bun run check` (tsc + eslint `--max-warnings 0`) et le seuil coverage
  75 %.

## Hors périmètre

- Campagne email « définissez votre mot de passe » aux 183 migrés (reporté).
- Révéler l'existence d'un compte à l'inscription (rejeté — anti-énumération).
- Modifications de schéma DB (aucune nécessaire).
