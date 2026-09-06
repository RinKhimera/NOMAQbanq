# Bannissement d'un compte et retrait d'accès après remboursement

Branche : `feat/bannissement` (worktree `../NOMAqBANK-bannissement`, créé depuis
`origin/main` le 2026-09-05).
Revue de design : `docs/superpowers/reviews/2026-09-05-revue-design-bannissement.md`
(11 constats, tous vérifiés et intégrés ci-dessous).

## Contexte

Un litige Stripe `fraudulent` de 200 $ CA (achat `exam_access_promo`, Sentry
NOMAQBANQ-1H) a été **perdu** malgré un dossier solide. La cliente a récupéré la
somme, ne répond à aucun message, et continue d'utiliser la plateforme avec
l'accès de six mois que l'achat lui avait ouvert. L'application n'a aujourd'hui
aucun moyen ni de lui retirer cet accès, ni de lui fermer la porte.

Faits vérifiés dans le code le 2026-09-05 :

- **Aucun bannissement n'existe**, mais la table `user` porte déjà `banned`,
  `ban_reason` et `ban_expires`, colonnes du plugin admin de Better Auth
  (`db/schema/auth.ts`), jamais écrites.
- **Le plugin refuse déjà la création de session d'un compte `banned`** dans
  son hook `session.create.before` (`node_modules/better-auth/dist/plugins/admin/admin.mjs`),
  avec l'erreur `FORBIDDEN` / code `BANNED_USER`, et efface tout seul un ban
  dont `ban_expires` est passé. Il ne revérifie **jamais** une session
  existante : un ban doit supprimer les sessions lui-même.
- Les 15 endpoints HTTP du plugin, dont `/admin/ban-user` et
  `/admin/unban-user`, sont fermés en 404 par `disabledPaths`
  (`lib/auth.ts`) parce qu'ils contournent les gardes applicatives. Le ban
  passe donc par une Server Action maison, comme `updateUserRole`.
- **Sans `cookieCache`, Better Auth relit l'utilisateur en base à chaque
  `getSession`** : `session.user.banned` est frais à chaque requête.
- **Connexion Google** : quand le hook refuse la session dans le callback
  OAuth, Better Auth redirige vers l'`errorCallbackURL` passée à l'appel, avec
  `?error=BANNED_USER` (`callback.mjs`, `redirectOnError`). L'app n'en passe
  aucune aujourd'hui : un banni tomberait sur `/api/auth/error`, page brute du
  framework.
- **Le retrait d'accès a déjà son moteur** : `recomputeAccess`
  (`features/payments/lib.ts`) reconstruit `user_access` depuis les
  transactions `completed`. Passer une transaction en `refunded` retire
  l'accès qu'elle portait. Seules les transactions **manuelles** sont
  aujourd'hui modifiables (`updateManualTransaction`).
- **Le webhook** (`app/api/stripe/webhook/route.ts`) reçoit
  `charge.dispute.closed` avec `dispute.status = "lost"` et se contente
  d'alerter Sentry. Il n'écoute pas `charge.refunded` : un remboursement fait
  depuis le Dashboard, par exemple le remboursement proactif recommandé après
  une alerte `radar.early_fraud_warning.created`, laisse l'accès en place.
- **Aucune trace des actions admin** n'existe (pas de table de journal). Le
  précédent de « réversible » est la suppression douce (`deletedAt` + grâce de
  30 j).
- `mapAuthError` (`lib/auth-errors.ts`) ne connaît pas `BANNED_USER` ; le
  formulaire de connexion afficherait le message générique.

## Décisions

- **Deux gestes distincts, combinables.** *Rembourser* est un fait comptable
  déclenché par Stripe : la transaction passe en `refunded` et l'accès qu'elle
  portait est retiré, banni ou non. *Bannir* est une décision humaine : le
  compte ne peut plus se connecter, ses données restent intactes. Dans le cas
  déclencheur, l'admin fera les deux. Dans le cas d'un litige perdu sans
  fraude, seul le premier s'applique.
- **Le ban est un gel, pas une révocation.** Aucune ligne `user_access` ni
  `transactions` n'est touchée par un ban. Lever le ban restaure l'état exact
  d'avant, sans recalcul. C'est ce qui rend une mauvaise manipulation
  réparable à coût nul. Le service est néanmoins bien coupé : sans session, il
  n'y a aucun accès.
- **Remboursement automatique via le webhook**, même doctrine que l'octroi :
  Stripe est la source de vérité pour l'argent, personne n'a de bouton à
  cliquer, un litige perdu un dimanche ne laisse pas l'accès ouvert. Pour le
  litige déjà perdu, l'admin **renvoie l'événement `charge.dispute.closed`
  depuis le Dashboard Stripe** (Développeurs → Webhooks → événement →
  « Renvoyer ») : aucun écran rétroactif n'est construit.
- **Journal des bans dans une table dédiée**, pas un journal d'audit général.
  `user.banned` reste le verrou lu par le plugin ; la table est l'historique.
- **Ban permanent seulement**, levée manuelle. `ban_expires` reste nul : une
  levée automatique par le plugin n'apparaîtrait dans aucun journal.
- **Le motif reste interne.** La page vue par le banni est neutre et donne
  l'adresse de contact ; elle n'affiche jamais le motif saisi par l'admin.
- **Un admin ne se bannit pas et ne bannit pas un admin.** Il faut d'abord
  rétrograder la cible. Cela règle sans compteur le problème « dernier admin
  banni », comme `updateUserRole` règle « dernier admin rétrogradé ».
- **Aucun changement ne peut faire échouer un fulfillment ni allonger la
  réponse webhook au-delà d'une transaction SQL.** Le remboursement suit le
  contrat de réponse existant : 200 traité ou ignoré, 500 sur erreur
  inattendue (Stripe réessaie), idempotent au rejeu.

## Lot 1 — Données (`db/schema/auth.ts`, `db/schema/payments.ts`, migration `0017`)

### Table `user_bans`

| Colonne       | Type                      | Contrainte                                      |
| ------------- | ------------------------- | ----------------------------------------------- |
| `id`          | text                      | PK, `createId()`                                |
| `user_id`     | text                      | FK `user.id` `onDelete: cascade`, NOT NULL      |
| `reason`      | text                      | NOT NULL (motif interne, 5 à 500 caractères)    |
| `banned_by`   | text                      | FK `user.id` `onDelete: set null`, nullable (toujours renseignée à l'écriture) |
| `banned_at`   | timestamptz               | NOT NULL, `defaultNow()`                        |
| `lifted_by`   | text                      | FK `user.id` `onDelete: set null`, nullable     |
| `lifted_at`   | timestamptz               | nullable                                        |
| `lift_reason` | text                      | nullable (0 à 500 caractères)                   |

Index :

- `user_bans_user_id_idx` sur `user_id` (historique d'un compte).
- **`user_bans_active_uidx`, unique partiel sur `user_id` `where lifted_at is
  null`** : au plus un ban actif par compte. C'est le filet contre deux clics
  concurrents ; la transaction de `banUser` reste la garde principale.

`banned_by` et `lifted_by` sont `set null` et non `restrict`, comme
`transactions.recorded_by` : un filet de FK, pas un chemin produit. Aucun code
ne supprime une ligne `user` : la suppression d'un compte est douce puis
**anonymisée par UPDATE** (`features/users/cron.ts`, `name = "Utilisateur
supprimé"`). L'auteur d'un ban dont le compte a été supprimé se lit donc
« Utilisateur supprimé » via la jointure normale ; l'UI affiche le nom tel
quel et ne réserve un repli (« un compte supprimé ») qu'au cas du `null`,
inatteignable hors suppression physique.

### Colonnes existantes de `user`

`banned` (défaut `false`, NOT NULL) et `ban_reason` sont **tenues en phase avec
le journal dans la même transaction** : `banned = true` + `ban_reason = reason`
à l'ouverture, `banned = false` + `ban_reason = null` à la levée. `ban_expires`
n'est jamais écrit. Le plugin lit ces colonnes ; le journal fait foi pour
l'historique.

### `transactions.refunded_at`

`timestamptz` nullable. Posée quand le statut passe à `refunded` via le
webhook. `updateManualTransaction` la pose aussi lors d'une transition manuelle
`completed → refunded`, et la remet à `null` sur `refunded → completed`, pour
que la colonne ait un seul sens quel que soit le chemin.

Consommateur : la **reconstitution a posteriori** d'un dossier (litige,
réclamation, comptabilité). Sans elle, la date du retour de fonds n'existe
que dans le Dashboard Stripe, et `transactions.created_at` est la création de
la session Checkout, pas un instant de paiement ni de remboursement. Elle
n'est pas affichée dans l'admin pour l'instant (consultable en base et dans
l'export) ; les lignes déjà `refunded` ne sont pas remplies rétroactivement.

## Lot 2 — Bannir et lever (`features/users`)

### Schémas (`features/users/schemas.ts`)

```ts
banUserSchema   = { userId: string min 1, reason: string trim min 5 max 500 }
unbanUserSchema = { userId: string min 1, reason?: string trim max 500 }
```

Messages d'erreur en français, comme `profileSchema`.

### Server Actions (`features/users/actions.ts`)

`banUser({ userId, reason })` et `unbanUser({ userId, reason? })`, retour
`AccountActionResult`. Squelette identique à `updateUserRole` :

1. `requireRole(["admin"])`.
2. `safeParse`, premier message d'issue en erreur.
3. `targetId === caller.id` → « Vous ne pouvez pas suspendre votre propre
   compte. » (respectivement « … lever votre propre suspension. »).
4. `db.transaction` :
   - `SELECT id, role, deletedAt, banned FROM user WHERE id IN (caller, target)
     ORDER BY id FOR UPDATE` : verrou ordonné, pas d'interblocage entre deux
     appels croisés.
   - Appelant absent, non admin ou supprimé → « Votre compte n'a plus les
     droits administrateur. »
   - Cible absente ou supprimée → « Utilisateur introuvable. »
   - **`banUser`** : cible `role = "admin"` → « Retirez d'abord le rôle
     administrateur de ce compte. » ; cible déjà `banned` → « Ce compte est
     déjà suspendu. » Sinon : `INSERT user_bans`, `UPDATE user SET banned =
     true, ban_reason = reason`, `DELETE session WHERE user_id = target`.
   - **`unbanUser`** : cible non `banned` → « Ce compte n'est pas suspendu. »
     Sinon : `UPDATE user_bans SET lifted_by, lifted_at = now(), lift_reason
     WHERE user_id = target AND lifted_at IS NULL`, puis `UPDATE user SET
     banned = false, ban_reason = null`. Si l'UPDATE du journal ne touche
     aucune ligne (drapeau posé sans journal, état incohérent), on lève quand
     même le drapeau et on `captureServerError` avec le `userId` : la levée
     ne doit pas être bloquée par un journal cassé.
5. `revalidatePath("/admin/utilisateurs")` et
   `revalidatePath(\`/admin/utilisateurs/${targetId}\`)`.

Une violation de l'index unique partiel (23505) au `INSERT` est mappée en
« Ce compte est déjà suspendu. » via `isPgUniqueViolation`, sans capture
Sentry : c'est la course perdue, pas une anomalie.

Ordre des verrous : `banUser`/`unbanUser` ne verrouillent que des lignes
`user`, dans l'ordre des id. Le webhook de remboursement verrouille une seule
ligne `user`. Aucun cycle possible.

### Un admin suspendu n'est pas un admin utilisable

L'invariant « il reste toujours un admin capable de se connecter » ne tient
que si l'état « admin ET suspendu » ne compte jamais comme un admin :

- `updateUserRole` **refuse de promouvoir un compte suspendu**
  (« Levez d'abord la suspension de ce compte. »). Le helper de verrou partagé
  lit déjà `banned`.
- `deleteMyAccount` ajoute `banned = false` au décompte des « autres admins »
  actifs. Sans cela : A suspend B, promeut B, supprime son compte → plus aucun
  admin ne peut se connecter, et `unbanUser` exige un admin.

### Garde de session (`lib/dal.ts`)

`getCurrentSession` renvoie `null` quand `session.user.banned === true`. Tous
les consommateurs (`requireSession`, `requireRole`, `getSessionForRoute`, les
DAL qui appellent `getCurrentSession` directement, `hasAccess`, le prop
`isAuthenticated` des pages marketing) voient un utilisateur non connecté.
Une session résiduelle (requête en vol au moment du ban) mène donc à
`/connexion`, où la tentative de reconnexion aboutit à `/compte-suspendu`.
Zéro requête supplémentaire : le champ est déjà sur l'objet session.

### Crons de courriels (`features/notifications/cron.ts`)

Les deux requêtes (résultats d'examen, rappel de fin d'accès) ajoutent
`eq(user.banned, false)` à côté de `isNull(user.deletedAt)`. Un compte
suspendu ne reçoit aucun courriel de la plateforme. Le rappel de fin d'accès
n'est pas « réclamé » (`expiryReminderSentAt` reste nul) : si le ban est levé
avant l'expiration, le rappel partira normalement.

La règle est formulée dans `.claude/rules/data-layer.md` comme portant sur
**tout expéditeur** qui sélectionne des destinataires (« même filtre que
`deletedAt` »), pas comme deux `where` ponctuels. **Vigilance de merge** : la
branche `feat/socle-courriels` (campagne #116, en cours en parallèle) ajoute
un courriel de bienvenue, une relance d'inactivité et un rappel de panier
abandonné (`features/notifications/{cron,welcome}.ts`) ; à la fusion des deux
branches, chacun doit recevoir le garde `banned = false`, avec un cas de test.

### Ce qui ne change pas

- `createStripeCheckout`, `startExam`, `createTrainingSession` : gardés par
  `requireSession`, donc inaccessibles sans session. Rien à ajouter.
- Inscription avec le même courriel : déjà refusée (`USER_ALREADY_EXISTS`).
  Un banni peut créer un compte sous un autre courriel ; hors périmètre.
- Réinitialisation de mot de passe : le courriel part encore ; la connexion
  reste refusée. Accepté.
- Un compte banni qui demande la suppression de son compte : impossible sans
  session. Un compte supprimé (`deletedAt`) ne peut pas être banni
  (« Utilisateur introuvable. »).

## Lot 3 — Parcours du banni (`app/(auth)`, `lib/auth.ts`, `lib/auth-errors.ts`)

### Page `/compte-suspendu` (`app/(auth)/compte-suspendu/page.tsx`)

Server Component statique dans le groupe `(auth)` (donc dans `MarketingShell`),
sans session, `metadata: { title: "Compte suspendu", robots: { index: false,
follow: false } }`. Contenu :

- Icône `ShieldOff`, titre « Compte suspendu ».
- Texte : « L'accès à ce compte a été suspendu par l'équipe NOMAQbanq. Si vous
  pensez qu'il s'agit d'une erreur, écrivez-nous à {adresse}. »
- Adresse : `env.SUPPORT_EMAIL`, repli sur l'adresse du pied de page
  (`nomaqbanq@outlook.com`), en lien `mailto:`.
- Bouton « Retour à l'accueil » vers `/`.

Aucun motif, aucune donnée du compte : la page ne sait pas qui la regarde.

### Formulaire courriel (`sign-in-form.tsx`, `lib/auth-errors.ts`)

`mapAuthError` gagne le cas `code === "BANNED_USER"` → `{ kind: "banned",
message: "Ce compte est suspendu." }`. Dans `onSubmit`, `kind === "banned"` →
`router.replace("/compte-suspendu")` (pas d'alerte, pas d'entrée d'historique
sur laquelle revenir).

### Connexion Google

`authClient.signIn.social` reçoit `errorCallbackURL: "/connexion"`. La page
`/connexion` monte, dans un `<Suspense>` (la page reste statique), un petit
composant client `OAuthErrorHandler` qui lit `useSearchParams().get("error")` :

- `BANNED_USER` → `router.replace("/compte-suspendu")` ;
- toute autre valeur non nulle → `toast.error("La connexion avec Google a
  échoué. Réessayez.")` puis `router.replace("/connexion")` pour nettoyer
  l'URL ;
- nulle → rien.

L'`errorCallbackURL` s'ajoute aussi au bouton Google du formulaire
d'inscription, qui partage le même parcours OAuth.

### Message du plugin (`lib/auth.ts`)

`admin({ …, bannedUserMessage: "Ce compte est suspendu." })` : si le message
brut fuit un jour (client tiers, réponse API), il est en français.

## Lot 4 — Remboursement par le webhook (`features/payments/stripe.ts`, `route.ts`)

### `refundStripeTransaction` (`features/payments/stripe.ts`)

```ts
refundStripeTransaction({ stripePaymentIntentId, refundedAt: Date })
  → { status: "refunded", userId, accessReducedOrRemoved }
  | { status: "skipped", currentStatus }   // pending, failed, refunded
  | { status: "not_found" }
```

Dans `db.transaction` :

1. `SELECT id, userId, status FROM transactions WHERE stripe_payment_intent_id
   = ?` (limite 1). Absent → `not_found`.
2. **Verrou `user FOR UPDATE` avant toute écriture sur `transactions`**, même
   ordre que `updateManualTransaction` (user → ligne transaction).
3. `UPDATE transactions SET status = 'refunded', refunded_at = ? WHERE id = ?
   AND status = 'completed'` avec `returning`. Zéro ligne → `skipped` avec le
   statut lu (un rejeu Stripe retombe ici : `refunded`).
4. `recomputeAccess(tx, { userId })` → `accessReducedOrRemoved`.

`refundedAt` vient de l'événement (`event.created`, instant où Stripe a émis
le remboursement ou la clôture du litige), pas de `now()`, pour que la colonne
reflète la date Stripe et reste stable au rejeu.

### Prérequis : abonner l'endpoint à `charge.refunded`

L'endpoint webhook du Dashboard est en « événements sélectionnés » (la
campagne du 2026-09-02 y a coché les événements de litige à la main). Un type
non coché n'est **jamais livré** en production, alors que `stripe listen`
relaie tout en développement : sans cette étape, le remboursement passerait
tous les tests et ne ferait rien en prod. Seul l'endpoint **live** existe au
Dashboard (aucun endpoint de test : en local, `stripe listen --forward-to`
relaie tous les événements) : **fait sur l'endpoint live le 2026-09-05**.

### Route webhook

Invariant conservé du 2026-09-02 : **l'alerte humaine part AVANT toute
écriture en base**, pour qu'une panne Neon ne la prive pas de son détail (le
`catch` général ne connaît que `event.type`). Après l'écriture, seules les
anomalies alertent.

Nouveau cas **`charge.refunded`** (`event.data.object` : `Stripe.Charge`) :

- `charge.payment_intent` absent → alerte « remboursement sans
  payment_intent », 200.
- `charge.refunded === false` (partiel) → alerte « remboursement partiel,
  accès conservé » avec `amount_refunded` / `amount`, 200. Un geste commercial
  de 10 $ ne coupe pas un client.
- `charge.refunded === true` → alerte « remboursement Stripe complet » avec le
  détail (charge, montants, `payment_intent`) **puis** `refundStripeTransaction`.
  Résultat `refunded` → log console (l'alerte est déjà partie) ; `skipped`
  avec `currentStatus = "refunded"` → log console (rejeu) ; `skipped` avec
  tout autre statut (`pending`, `failed`) → alerte « retour de fonds sur une
  transaction non complétée » ; `not_found` → alerte « remboursement sans
  transaction correspondante ». Toujours 200.

Le cas `pending` mérite son alerte : un paiement différé reste `pending`
jusqu'à `async_payment_succeeded`, et l'ordre des événements n'est pas
garanti. Sans alerte, les fonds partent, puis la complétion arrive et octroie
l'accès sans que personne ne le sache. Le rattrapage est humain, mais visible.

Branche **`charge.dispute.closed` avec `dispute.status === "lost"`** : l'alerte
« litige perdu » existante reste **inchangée et à sa place** (avant
`recordStripeDispute`). Après `recordStripeDispute` (inchangé), appel de
`refundStripeTransaction` avec le même `payment_intent` et `refundedAt = new
Date(event.created * 1000)`, puis une **seconde alerte** de message distinct,
« litige perdu · retrait d'accès », dont le détail porte l'issue (« accès
retiré » / « accès conservé, une autre transaction couvre » / « déjà
refunded » / « transaction non complétée (pending) » / « transaction
introuvable »). Un litige perdu **sans** `payment_intent` reste une alerte
seule, comme aujourd'hui.

`charge.dispute.funds_reinstated` : alerte seule, inchangé. Le re-crédit d'une
transaction Stripe est humain et hors périmètre (voir plus bas).

Toute exception remonte au `catch` existant → `captureServerError` + 500 →
Stripe réessaie. Le rejeu retombe en `skipped`.

### Documentation (`.claude/rules/payments.md`)

Le point « L'accès n'est jamais révoqué sur litige » devient : jamais **pendant**
le litige ; à la **perte** (`charge.dispute.closed` / `lost`) et à tout
**remboursement complet** (`charge.refunded`), la transaction passe en
`refunded` et `recomputeAccess` retire l'accès. Ajouter la nuance partiel /
complet, le rejeu depuis le Dashboard pour un événement passé, l'abonnement
obligatoire de l'endpoint à `charge.refunded`, et rappeler que l'alerte
humaine précède toujours l'écriture (les alertes d'issue viennent après).

## Lot 5 — Admin (`features/users/dal.ts`, `app/(admin)/admin/utilisateurs`)

### DAL

- `AdminUserDetail` et `AdminUserRow` gagnent `banned: boolean`
  (`getUserForAdmin`, `getUsersWithFilters`).
- Nouveau `getUserBans(userId)` (garde admin) : lignes de `user_bans` du
  compte, jointes deux fois à `user` (alias) pour les noms de `banned_by` et
  `lifted_by`, triées `banned_at desc`, **limite 20**. Forme :

```ts
type UserBanView = {
  id: string
  reason: string
  bannedAt: number          // epoch ms
  bannedByName: string | null   // null = admin supprimé
  liftedAt: number | null
  liftedByName: string | null
  liftReason: string | null
}
```

L'épisode actif est celui dont `liftedAt` est nul (au plus un).

### Fiche utilisateur (`[id]/page.tsx`, `user-detail-client.tsx`)

Nouveau composant `_components/user-ban-section.tsx`, monté sous
`UserRoleSection` dans la colonne de gauche, même carte `motion.div` que les
sections voisines. Props : `user` (`id`, `name`, `email`, `role`, `banned`),
`bans: UserBanView[]`, `currentUserId`.

- **Compte actif** : titre « Suspension », texte « Suspendre ce compte le
  déconnecte partout et lui interdit toute connexion. Ses accès et ses
  transactions sont conservés et reviennent à la levée. » Bouton destructif
  « Suspendre ce compte » → `AlertDialog` avec `Textarea` motif obligatoire
  (compteur 5–500), confirmation rouge « Suspendre ». Cas `isSelf` : note
  italique « Vous ne pouvez pas suspendre votre propre compte. » Cas
  `role === "admin"` : note « Retirez d'abord le rôle administrateur. », pas
  de bouton.
- **Compte suspendu** : badge rouge « Suspendu », « depuis le {date} par
  {nom} », motif en bloc citation. Le nom de l'auteur est celui de la
  jointure, tel quel (« Utilisateur supprimé » après anonymisation). Bouton
  « Lever la suspension » → `AlertDialog` avec `Textarea` motif facultatif,
  confirmation « Lever ».
- **Historique** : sous le bloc courant, liste des épisodes précédents
  (`liftedAt` non nul) : dates d'ouverture et de levée, motifs, auteurs.
  Vide → rien (pas de « Aucun historique »).
- Après succès : `toast.success`, fermeture, `router.refresh()`. Erreur :
  `toast.error(result.error)`. Appels via `callAction`.

Dates formatées via `lib/format.ts` (fuseau de l'Est), jamais `format()` de
date-fns direct.

### Liste (`users-table.tsx`)

Badge « Suspendu » (rouge, `ShieldOff`) à côté du badge de rôle quand
`banned`. Pas de filtre dédié, pas de nouvelle stat card. (`user-table-row.tsx`
n'est importé nulle part : code mort, non touché.)

### `data-testid`

`ban-open`, `ban-reason`, `ban-confirm`, `unban-open`, `unban-reason`,
`unban-confirm`, `ban-self-note`, `ban-admin-note`, `ban-badge`.

## Tests

### Intégration (branche Neon, `tests/integration/`)

`users-ban.test.ts`, sur le modèle de `users-role.test.ts` (guards mockés,
base réelle) :

- ban : `user.banned`/`ban_reason` posés, ligne `user_bans` avec
  `banned_by`, **toutes les sessions de la cible supprimées**, sessions
  d'un autre compte intactes, `user_access` intact ;
- refus : auto-ban, cible admin, cible supprimée, cible déjà bannie, appelant
  rétrogradé entre le guard et la transaction, motif trop court ;
- **deux `banUser` concurrents** sur la même cible : une seule ligne
  `user_bans`, le second reçoit « déjà suspendu » ;
- levée : ligne clôturée avec `lifted_by`/`lift_reason`, drapeau effacé,
  `hasAccess(type, userId)` identique avant ban et après levée ;
- levée d'un compte non banni refusée ; levée avec drapeau sans journal :
  drapeau effacé, `captureServerError` appelé ;
- `getUserBans` : ordre, **limite à 20** (25 épisodes insérés), noms des
  admins, « Utilisateur supprimé » après passage du cron d'anonymisation sur
  l'auteur (seul scénario atteignable) ;
- `updateUserRole` refuse de promouvoir un compte suspendu
  (`users-role.test.ts`) ; `deleteMyAccount` refuse le dernier admin quand
  l'autre admin est suspendu (`users-account.test.ts`).

`payments-refund.test.ts` :

- remboursement complet d'une transaction `completed` : statut `refunded`,
  `refunded_at` = date fournie, `user_access` retiré (ou raccourci si une
  autre transaction couvre encore le type) ;
- rejeu : second appel → `skipped` avec `refunded`, rien ne bouge ;
- transaction `pending` → `skipped`, accès intact ; `payment_intent` inconnu →
  `not_found` ;
- `updateManualTransaction` : `refunded_at` posé puis effacé sur aller-retour.

`notifications-cron.test.ts` (existant) : cas ajouté « compte banni exclu des
deux envois, marqueur non posé ».

### Unitaires (`tests/`)

- `lib/auth-errors` : `BANNED_USER` → `kind: "banned"`.
- `stripe-webhook-errors.test.ts` (existant, mocks étendus) : `charge.refunded`
  complet (alerte AVANT l'appel, puis log) / partiel / sans payment_intent /
  `not_found` / `skipped: pending` (alerte) / `skipped: refunded` (silence) ;
  `dispute.closed lost` : l'`it.each` existant reste vrai tel quel (première
  alerte inchangée), le remboursement est appelé et une seconde alerte porte
  l'issue ; `won` n'appelle pas le remboursement ; exception → 500.
- `SignInForm` : `BANNED_USER` → `router.replace("/compte-suspendu")`, sans
  alerte.
- `OAuthErrorHandler` : trois branches.
- `SuspendedPage` : rendu, lien mailto, absence de tout motif.
- `UserBanSection` : quatre états (actif, suspendu, self, admin), motif trop
  court bloque la confirmation, appels d'action et toasts.
- `lib/dal` : `getCurrentSession` renvoie `null` si `banned`.

### Manuel / e2e (après implémentation, via `/e2e-scenario`)

Bannir un compte de test connecté dans un second navigateur : sa prochaine
navigation le renvoie à `/connexion`, la reconnexion courriel et Google mènent
à `/compte-suspendu`. Lever : reconnexion possible, accès inchangé.

Remboursement : avec `stripe listen` en route, rembourser intégralement un
paiement de test depuis le Dashboard ; `charge.refunded` arrive en 200 et
`user_access` disparaît. Ce test ne prouve pas l'abonnement de l'endpoint
live (fait au Dashboard le 2026-09-05), que `stripe listen` contourne.

## Hors périmètre (à ouvrir en issue si le besoin apparaît)

- Courriel au compte suspendu ou levé.
- Ban temporaire (`ban_expires`).
- Journal d'audit général des actions admin.
- Blocage à l'inscription par courriel, domaine ou IP.
- Remise en `completed` d'une transaction Stripe depuis l'admin (fonds
  restitués après litige, remboursement annulé) : alerte Sentry seule.
- Filtre « suspendus » et stat card dans la liste des utilisateurs.
- Exclusion des bannis des sélecteurs admin (paiement manuel, audience
  d'examen) : un octroi manuel à un banni est inoffensif tant qu'il est banni.
