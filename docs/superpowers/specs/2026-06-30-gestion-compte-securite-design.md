# Spec A — Gestion du compte & sécurité (pages profil)

- **Date** : 2026-06-30
- **Statut** : design validé, prêt pour plan d'implémentation
- **Portée** : `/dashboard/profil` et `/admin/profil`
- **Suite** : Spec B — Notifications email (résumée en annexe, à détailler plus tard)

## 1. Contexte & objectif

L'app utilise **Better Auth v1.6.20** (Drizzle + Neon) avec deux moyens de
connexion : **email/mot de passe** et **Google**. Les pages profil savent
aujourd'hui éditer nom/username/bio, l'avatar et changer le mot de passe. Deux
zones sont des placeholders « bientôt » :

- [profile-security.tsx:182](<app/(dashboard)/dashboard/profil/_components/profile-security.tsx#L182>) — « Comptes connectés (Google) »
- [profile-preferences.tsx:209](<app/(dashboard)/dashboard/profil/_components/profile-preferences.tsx#L209>) — « Notifications par email » (→ Spec B)

**Objectif** : donner à l'utilisateur connecté un centre de gestion moderne de son
authentification — lier/délier Google, définir/changer un mot de passe (y compris
pour un compte Google-only), voir le statut de vérification de son email, gérer
ses appareils connectés, et supprimer son compte (avec délai de grâce). Le tout
en couvrant explicitement les **edge cases d'identité** (email déjà existant,
mélange Google + email/mot de passe).

Better Auth fournit **nativement** toutes les briques nécessaires ; aucun plugin
supplémentaire n'est requis.

## 2. Périmètre

**Inclus (Spec A)**

- Méthodes de connexion : lier / délier Google ; définir / changer le mot de passe.
- Statut de vérification email + renvoi de l'email de vérification.
- Appareils connectés (sessions) : liste + révocation (une session, ou toutes les
  autres).
- Suppression de compte avec **délai de grâce 30 jours** (soft-delete réversible →
  anonymisation par cron).
- Messages d'edge case sur les pages d'auth (inscription avec email déjà existant).

**Exclus (repoussés)**

- Notifications email → **Spec B** (annexe §11).
- Changement d'adresse email, 2FA/TOTP, journal d'activité de sécurité détaillé
  → non retenus pour l'instant (voir §12 « Suggestions futures »).

## 3. Principes

- **Emails transactionnels toujours actifs** (vérification, reset, sécurité) — non
  concernés par des préférences.
- **Liaison Google = même email uniquement** : `account.accountLinking.allowDifferentEmails`
  reste `false` (défaut). C'est déjà le comportement actuel.
- **Impossible de s'enfermer dehors** : Better Auth bloque nativement le retrait du
  **dernier** moyen de connexion (`FAILED_TO_UNLINK_LAST_ACCOUNT`,
  `account.accountLinking.allowUnlinkingAll` reste `false`). On s'appuie dessus +
  messages FR.
- **Mêmes sections pour dashboard et admin** : l'admin gère aussi son propre
  compte. La page admin réutilise déjà les composants profil du dashboard
  ([admin/profil/page.tsx:1-4](<app/(admin)/admin/profil/page.tsx>)).
- **Aucun secret vers le client** (voir §8) : `token`, `password`,
  `accessToken`/`refreshToken`/`idToken` ne quittent jamais le serveur.

## 4. Matrice des edge cases d'identité

| #   | Situation                                                           | Comportement cible                                                                                                                                                | Mécanisme                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Inscription email/mdp avec un email **déjà utilisé**                | **Déjà géré** : `signUp` échoue → message FR **neutre** existant (« …Essayez de vous connecter. ») ; raffinement de libellé optionnel (ne pas imposer « Google ») | `mapAuthError` (`USER_ALREADY_EXISTS` / `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`) déjà mappé ([lib/auth-errors.ts](lib/auth-errors.ts)) ; bouton Google déjà présent sur l'inscription           |
| E2  | Connexion Google avec un email **déjà en email/mdp** (même email)   | **Auto-liaison** transparente (1 user, 2 comptes)                                                                                                                 | déjà en place : `trustedProviders:["google"]` — à documenter/tester                                                                                                                             |
| E3  | User **Google-only** veut aussi un login email/mdp                  | Profil → « Définir un mot de passe »                                                                                                                              | **Server Action** `setAccountPassword` → `auth.api.setPassword` (endpoint **server-only**, absent de `authClient`) ; email déjà `emailVerified=true` → aucun blocage `requireEmailVerification` |
| E4  | User **email/mdp** veut ajouter Google                              | Profil → « Lier Google » (redirection OAuth)                                                                                                                      | `authClient.linkSocial({ provider:"google", callbackURL })` (même email imposé)                                                                                                                 |
| E5  | Délier Google alors que c'est le **seul** moyen                     | Refus + message : « Définissez d'abord un mot de passe pour ne pas perdre l'accès. »                                                                              | erreur native `FAILED_TO_UNLINK_LAST_ACCOUNT`                                                                                                                                                   |
| E5b | Délier avec une session **> 24 h**                                  | `unlinkAccount` exige une session « fraîche » (`freshAge` défaut 24 h) → message FR « reconnectez-vous puis réessayez ». Échappatoire : `session.freshAge:0`      | `freshSessionMiddleware` (Better Auth) ; erreur `SESSION_NOT_FRESH` gérée                                                                                                                       |
| E6  | Email non vérifié (rare : un utilisateur connecté est déjà vérifié) | Badge « Non vérifié » + « Renvoyer l'email »                                                                                                                      | `authClient.sendVerificationEmail({ email })`, bouton affiché seulement si `emailVerified=false`                                                                                                |
| E7  | Mot de passe oublié                                                 | Flux non-authentifié **existant** (`/auth`, `sendResetPassword`)                                                                                                  | vérifier qu'il est bien branché ; lien depuis le formulaire « changer le mot de passe »                                                                                                         |

> Note E3/E7 : `requestPasswordReset`/`setPassword` créent un compte `credential`
> si absent — un utilisateur Google peut donc obtenir un mot de passe des deux
> façons. `setPassword` (authentifié) est le chemin nominal depuis le profil.

## 5. Architecture UI

L'actuel [profile-security.tsx](<app/(dashboard)/dashboard/profil/_components/profile-security.tsx>)
concentre trop de responsabilités. On le **décompose** en composants isolés,
rendus dans les deux pages profil (dashboard + admin) :

1. **`profile-login-methods.tsx`** (nouveau) — remplace le placeholder « Comptes
   connectés ». Affiche :
   - **Google** : « Connecté » (+ date de liaison) avec bouton _Délier_, ou bouton
     _Lier Google_.
   - **Mot de passe** : « Défini » + _Modifier_, ou _Définir un mot de passe_
     (cas Google-only).
   - **Email** : adresse + badge _Vérifié_ / _Non vérifié_ (+ _Renvoyer l'email_).
2. **`profile-password.tsx`** (extrait de l'actuel `profile-security`) — formulaire
   de mot de passe. Champ « mot de passe actuel » **masqué** si l'utilisateur n'a
   pas encore de mot de passe (→ `setPassword`), sinon présent (→ `changePassword`
   avec `revokeOtherSessions:true`, comportement actuel conservé).
3. **`profile-sessions.tsx`** (nouveau) — **Appareils connectés** : par session,
   appareil (parse léger du `userAgent` → ex. « Chrome · Windows »), IP, dernière
   activité, badge _Cet appareil_ pour la session courante. Actions : _Déconnecter_
   (désactivé sur la session courante) + _Déconnecter partout ailleurs_.
4. **`profile-danger-zone.tsx`** (nouveau) — **Supprimer mon compte** (voir §7).

`profile-security.tsx` devient un léger conteneur (ou est retiré au profit des 4
composants ci-dessus, câblés directement dans les pages). Décision d'implémentation
laissée au plan ; les deux pages doivent rendre le même ensemble.

**Conventions UI réutilisées** (existant) : shadcn/ui, `react-hook-form` + `zod`
(schémas dans [schemas/auth.ts](schemas/auth.ts)), toasts `sonner`, animations
`motion/react`, icônes `@tabler/icons-react`. `data-testid` sur les actions
sensibles (ex. `login-method-google-link`, `session-revoke-{id}`,
`danger-delete-account`).

## 6. Architecture backend (`features/users`)

### DAL — [features/users/dal.ts](features/users/dal.ts)

`import "server-only"` + `cache()` + self-guard + **colonnes non-secrètes uniquement** :

- `getLoginMethods()` → `{ hasPassword: boolean; google: { linked: boolean; linkedAt: Date | null }; emailVerified: boolean }`
  Lit `account` filtré sur l'utilisateur courant, en sélectionnant **seulement**
  `providerId` (+ `createdAt`). `hasPassword` = présence d'une ligne
  `providerId="credential"` ; `google.linked` = présence d'une ligne
  `providerId="google"`. `emailVerified` vient de `user`.
  **Jamais** de `password`, `accessToken`, `refreshToken`, `idToken`, `scope`.
- `getUserSessions()` → `Array<{ id; deviceLabel; ipAddress; lastActiveLabel; isCurrent }>`
  Lit `session` filtré sur l'utilisateur courant **et sur les sessions actives**
  (`expiresAt > now` — pas d'appareil expiré listé comme actif), colonnes
  **non-secrètes** (`id`, `ipAddress`, `userAgent`, `updatedAt`) — **jamais
  `token`**. `deviceLabel` dérivé du `userAgent` (helper de parse léger).
  `lastActiveLabel` = date pré-formatée **côté serveur** avec un fuseau fixe
  (`America/Toronto`) → pas de mismatch d'hydratation. `isCurrent` par comparaison
  de `id` à l'id de la session courante (`getCurrentSession()`).

Types partagés vers le client via `import type` (module effacé à la compilation).

### Server Actions — [features/users/actions.ts](features/users/actions.ts)

`"use server"` → guard `requireSession` → (`zod.safeParse`) → écriture → `revalidatePath` :

- `revokeUserSession(sessionId: string)` : `DELETE FROM session WHERE id = ? AND user_id = <courant>` (garde d'appartenance anti-IDOR). Refuse de révoquer la session courante (message : utiliser la déconnexion).
- `revokeOtherUserSessions()` : `DELETE FROM session WHERE user_id = <courant> AND id <> <courant>`.
- `setAccountPassword({ newPassword })` : appelle `auth.api.setPassword` (endpoint **server-only**). Pour un compte Google-only.
- `deleteMyAccount(input)` : voir §7 (inclut la garde **« dernier admin »**).

> **Révocation par suppression de ligne** : valable car les sessions sont
> DB-backed (pas de `secondaryStorage` ni `session.cookieCache` configurés) →
> la source de vérité est la table `session`. Le plan pourra alternativement
> passer par `auth.api.revokeSession` côté serveur si besoin.

### Mutations côté **client** (`authClient.*`)

Restent des appels client (redirection OAuth / CSRF gérés par Better Auth) — pas
de proxy Server Action :
`changePassword`, `linkSocial`, `unlinkAccount`, `sendVerificationEmail`.
`lib/auth-client.ts` n'a **rien à ajouter** (méthodes cœur déjà disponibles).

> ⚠️ **Exception `setPassword`** (constat F1 de la revue) : c'est un endpoint
> **`serverOnly`** de Better Auth ([update-user.mjs:185](node_modules/better-auth/dist/api/routes/update-user.mjs)),
> **absent de `authClient`**. Il passe donc par la Server Action `setAccountPassword`
> (`auth.api.setPassword`), pas côté client.

### Config auth — [lib/auth.ts](lib/auth.ts)

Ajout de `databaseHooks` (voir §7 pour la logique complète) :

- `session.create.before` → **bloque** la connexion d'un compte dont le
  `deletedAt` a dépassé la fenêtre de grâce (30 j).
- `session.create.after` → **réactive** (efface `deletedAt`) un compte supprimé
  qui se reconnecte **dans** la fenêtre de grâce.

`allowDifferentEmails` et `allowUnlinkingAll` restent à `false` (défauts). Rate
limiting existant conservé ; ajout ciblé optionnel sur `/delete-user`,
`/set-password`, `/unlink-account`.

### Cron — [features/users/cron.ts](features/users/cron.ts) (nouveau)

- `anonymizeExpiredDeletedAccounts()` : voir §7. Câblé dans la route cron
  existante [close-expired/route.ts](app/api/cron/close-expired/route.ts) au sein
  du `Promise.all` (réutilise l'auth bearer `CRON_SECRET` fail-closed et la
  planification quotidienne/horaire déjà en place).

## 7. Suppression de compte — délai de grâce 30 jours

Modèle **soft-delete réversible → anonymisation différée**, exploitant les colonnes
déjà présentes `user.deletedAt` et `user.anonymizedAt`.

### 7.1 Déclenchement (`deleteMyAccount`)

1. Guard `requireSession`.
2. Confirmation : l'utilisateur doit **saisir son adresse email** (friction
   anti-erreur ; la session active prouve déjà l'identité). _(Ré-authentification
   par mot de passe = durcissement futur, hors périmètre.)_
3. **Garde « dernier admin »** : si l'utilisateur est `admin`, refuser s'il ne
   reste aucun autre admin actif (`count(*) admin, deletedAt IS NULL, id ≠ courant`)
   → évite de laisser l'app sans administrateur.
4. Transaction :
   - `UPDATE user SET deleted_at = now() WHERE id = <courant>` (marqueur soft-delete ;
     **pas** d'anonymisation immédiate).
   - `DELETE FROM session WHERE user_id = <courant>` (déconnexion partout).
5. Retour succès → côté client `authClient.signOut()` + redirection vers une page
   d'adieu (`/compte-supprime` ou équivalent) indiquant la date limite de
   réactivation (`deletedAt + 30 j`).

L'email **reste intact** pendant la grâce (donc toujours « pris » : une
ré-inscription avec la même adresse renverra « compte déjà existant », cohérent).

### 7.2 Réactivation (se reconnecter annule la suppression)

- `databaseHooks.session.create.before(session)` : charge l'utilisateur ; si
  `deletedAt != null` **et** `now - deletedAt >= 30 j` → **retourne `false`**
  (connexion bloquée : la grâce est expirée).
- `databaseHooks.session.create.after(session)` : charge l'utilisateur ; si
  `deletedAt != null` (donc forcément dans la grâce, sinon `before` a bloqué) →
  `UPDATE user SET deleted_at = NULL` → **compte réactivé**. Un toast/bandeau
  informe l'utilisateur à la prochaine page.

> Les hooks n'ajoutent qu'une lecture user au moment du **sign-in** (rare), pas à
> chaque requête (`session.create` ne se déclenche qu'à la connexion).

### 7.3 Anonymisation définitive (`anonymizeExpiredDeletedAccounts`, cron quotidien)

Cible : `deletedAt < now - 30 j AND anonymizedAt IS NULL`. Pour chaque, en
transaction :

- `UPDATE user SET name = 'Utilisateur supprimé', email = 'deleted-' || id || '@deleted.invalid', username = NULL, bio = NULL, image = NULL, anonymized_at = now()`
  (`.invalid` = TLD réservé RFC 2606, non délivrable ; `id` garantit l'unicité de
  l'email).
- `DELETE FROM account WHERE user_id = <id>` (purge des secrets OAuth /
  hash de mot de passe).
- Sessions déjà supprimées à l'étape 7.1.

L'`id` de l'utilisateur est **conservé** → l'historique agrégé (examens,
paiements) reste intègre, mais dépersonnalisé. Après anonymisation, l'email
d'origine étant remplacé, une reconnexion Google/mot de passe ne matche plus →
un nouveau compte propre serait créé (acceptable).

## 8. Sécurité & garde-fous

- **Aucun secret vers le client** : `session.token`, `account.password`,
  `account.{accessToken,refreshToken,idToken}` ne sont **jamais** sélectionnés
  pour de la donnée destinée au client (cf. [data-layer.md](.claude/rules/data-layer.md)).
- **Lectures self-scoped** : `getLoginMethods` / `getUserSessions` filtrent
  **toujours** sur l'utilisateur de la session courante — jamais de lecture
  cross-user. Toute action de révocation vérifie l'appartenance (`user_id`)
  → anti-IDOR.
- **Exposition assumée** : afficher à l'utilisateur ses **propres** appareils
  (IP + `userAgent` dérivé) est un affichage volontaire, dans l'esprit de
  l'exception « activity feed / profil » de la règle data-layer. Le `token` reste
  strictement serveur. _(Masquage partiel de l'IP possible plus tard ; on affiche
  l'IP propre telle quelle par défaut.)_
- **Mise à jour de règle nécessaire** : [data-layer.md](.claude/rules/data-layer.md)
  affirme que les tables `account`/`session` « ne sont lues par aucun DAL métier ».
  On introduit deux lectures **self-scoped, colonnes non-secrètes** → amender la
  règle pour acter cette exception (lecture par le propriétaire de
  `account.providerId` et de `session.{ipAddress,userAgent,timestamps}` autorisée ;
  `token`/secrets toujours interdits).
- **Dernier moyen de connexion** : protégé nativement (E5).
- **Comptes supprimés** : impossibilité de connexion post-grâce (hook `before`) ;
  réactivation contrôlée (hook `after`).

## 9. Env / config

Aucune nouvelle variable requise. Rappels :

- Google actif seulement si `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` présents
  (sinon l'UI « Lier Google » doit être masquée/inactive).
- Emails via AWS SES (`EMAIL_FROM`, `SES_*`) — déjà en place.
- Cron via `CRON_SECRET` — déjà en place.

## 10. Tests

- **Intégration (branche Neon éphémère, `bun run test:integration`)** :
  - `getLoginMethods` : 4 combinaisons Google×mot de passe ; `emailVerified` ; **aucun secret** dans le retour.
  - `getUserSessions` : `isCurrent` correct ; **pas de `token`** dans le retour.
  - `revokeUserSession` : garde d'appartenance (un user ne peut pas révoquer la session d'un autre) ; refus sur session courante.
  - `deleteMyAccount` : pose `deletedAt`, supprime les sessions, n'anonymise pas ; puis `anonymizeExpiredDeletedAccounts` anonymise + purge `account` après la fenêtre.
  - Réactivation : simulate un `deletedAt` dans la grâce → hook `after` efface `deletedAt` ; hors grâce → hook `before` bloque.
- **Frontend (happy-dom, `bun run test`)** : états de `profile-login-methods`
  (link/unlink/set/change) ; `profile-sessions` (badge courant, révocation) ;
  `profile-danger-zone` (confirmation par email).
- **E2E (optionnel, Playwright)** : définir/changer le mot de passe ; révoquer une
  session ; parcours de suppression. (OAuth Google difficile à E2E → couvert par
  l'intégration.)

## 11. Découpage suggéré (pour le plan)

1. **Backend socle** : DAL (`getLoginMethods`, `getUserSessions`) + helper parse
   userAgent + actions de révocation + tests intégration.
2. **UI méthodes de connexion + mot de passe + vérification email** (câblage
   `authClient` + `getLoginMethods`).
3. **UI appareils connectés** (câblage `getUserSessions` + révocation).
4. **Suppression de compte** : action `deleteMyAccount` + `profile-danger-zone` +
   hooks `lib/auth.ts` (before/after) + `features/users/cron.ts` + câblage route
   cron + page d'adieu + réactivation + tests.
5. **Messages edge case auth** (inscription email déjà existant → guide Google).
6. **Mise à jour des règles/docs** ([data-layer.md](.claude/rules/data-layer.md)).

Chaque phase est livrable et testable indépendamment ; revue adversariale possible
entre les phases.

## 12. Suggestions futures (non retenues maintenant)

- **Changement d'adresse email** (`authClient.changeEmail`, avec re-vérification).
- **2FA / TOTP** (plugin `twoFactor` Better Auth + codes de secours).
- **Journal d'activité de sécurité** (historique de connexions + alerte email
  « nouvelle connexion »).
- **Ré-authentification par mot de passe** avant suppression de compte.
- **Masquage partiel de l'IP** dans la liste d'appareils.

---

## Annexe — Spec B (Notifications email) : décisions capturées

À détailler dans sa propre spec après la Spec A. Éléments déjà arbitrés :

- **Toggles proposés à l'utilisateur** (non-critiques, opt-in) :
  1. **Résultats d'examen prêts** — déclencheur : clôture/correction d'examen par
     le cron [close-expired](app/api/cron/close-expired/route.ts) (via
     [features/exams/cron.ts](features/exams/cron.ts)).
  2. **Rappel de fin d'accès** — abonnement/accès bientôt expiré (nécessite un
     nouveau cron de balayage des fenêtres d'accès).
- **Non retenus** : récap de session d'entraînement, rappels d'étude/inactivité.
- **Toujours actifs (transactionnels, non désactivables)** : vérification email,
  reset de mot de passe, reçu/confirmation de paiement, alertes de sécurité.
- **Stockage** : table (ou colonnes) de préférences de notification par
  utilisateur (aucune n'existe aujourd'hui).
- **UI** : remplace le toggle désactivé « Bientôt » de
  [profile-preferences.tsx:209](<app/(dashboard)/dashboard/profil/_components/profile-preferences.tsx#L209>).
- **Infra** : AWS SES + react-email déjà en place ([email/](email/)).
