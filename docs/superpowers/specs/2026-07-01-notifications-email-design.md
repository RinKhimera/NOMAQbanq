# Spec B — Notifications email

- **Date** : 2026-07-01
- **Statut** : design validé, prêt pour plan d'implémentation
- **Portée** : notifications email opt-out (résultats d'examen, fin d'accès) + préférences profil
- **Prérequis** : Spec A (gestion compte & sécurité) livrée sur `dev-2`

## 1. Contexte & objectif

L'infra email (AWS SES + react-email) et les crons existent déjà ; seuls les
**emails transactionnels** (vérification, reset) partent aujourd'hui. Le toggle
« Notifications par email » du profil est **désactivé** (« Bientôt »,
[profile-preferences.tsx:209](<app/(dashboard)/dashboard/profil/_components/profile-preferences.tsx#L209>)).

**Objectif** : activer un système de notifications email **opt-out** avec deux
notifications utiles, contrôlables par l'utilisateur depuis son profil :

1. **Résultats d'examen prêts**
2. **Rappel de fin d'accès** (abonnement bientôt expiré)

## 2. Découverte déterminante — visibilité des résultats d'examen

Les résultats d'examen blanc (score, review, classement) sont **bloqués jusqu'à
`exam.endDate`** (anti-triche). Preuve : [features/exams/dal.ts:556](features/exams/dal.ts#L556)
`if (!isAdmin && Date.now() < exam.endDate.getTime()) return null` ; commentaires
anti-triche « résultats visibles après `endDate` » (lignes 703-710) ; classement
idem (ligne 1116). **Un candidat qui termine manuellement ne voit donc pas son
score** avant la clôture. (L'affichage immédiat du score n'existe qu'en mode
entraînement — hors périmètre.)

**Conséquence sur le déclencheur** : la notification « résultats prêts » part
**quand l'examen clôture** (`endDate` passée), pour **tous les participants**
(`completed` finis tôt **et** `auto_submitted`), **une seule fois** — pas à la
fin manuelle.

## 3. Principes & décisions

- **Résultats d'examen** : balayage gardé sur `endDate < now`, marqueur
  `resultsNotifiedAt` par participation → idempotence.
- **Rappel de fin d'accès** : **7 jours** avant expiration, **une seule fois**,
  marqueur `expiryReminderSentAt` sur `userAccess`, **réinitialisé au
  renouvellement** (re-arme le prochain cycle).
- **Transactionnels toujours actifs** (vérification, reset) — hors préférences.
- **Opt-out** : les 2 notifications **activées par défaut**, désactivables.
- **Stockage** : **2 colonnes booléennes sur `user`** (cohérent avec les colonnes
  app déjà présentes : `role`, `bio`, `deletedAt`…). Pas de table dédiée (YAGNI).

## 4. Schéma (migration Drizzle)

- `user` (`db/schema/auth.ts`) :
  - `+ notifyExamResults boolean not null default true`
  - `+ notifyAccessExpiry boolean not null default true`
- `examParticipations` (`db/schema/exams.ts`) :
  - `+ resultsNotifiedAt timestamptz null` (+ index partiel utile : voir §5)
- `userAccess` (`db/schema/payments.ts`) :
  - `+ expiryReminderSentAt timestamptz null`

Générer via `bun run db:generate`, appliquer via `bun run db:migrate`. Les
défauts `true`/`null` rendent la migration sûre (pas de backfill nécessaire).

## 5. Backend

### Cron — `features/notifications/cron.ts` (nouveau)

Deux fonctions **bornées** et **résilientes** (`try/catch` par ligne — un envoi qui
échoue ne bloque ni le lot ni les runs suivants, cf. l'anonymisation de la Spec A) :

- `sendExamResultsNotifications()` :
  - Requête (**sans filtre de préférence** — voir encadré) : participations où
    `exams.endDate < now`, `status IN ('completed','auto_submitted')`,
    `resultsNotifiedAt IS NULL`, jointes à `user` (non supprimé — lit `email` +
    `notifyExamResults`) et `exams` (`title`). Bornée à 500, triée par `completedAt`.
  - Pour chaque ligne : **si `notifyExamResults`** → `sendExamResultsEmail(...)` ;
    **toujours** → `UPDATE resultsNotifiedAt = now`.
- `sendAccessExpiryReminders()` :
  - Requête (**sans filtre de préférence**) : `userAccess` où `expiresAt` entre
    `now` et `now + 7j`, `expiryReminderSentAt IS NULL`, jointe à `user` (non
    supprimé — lit `email` + `notifyAccessExpiry`). Bornée à 200 (pattern
    `getExpiringAccess` existant).
  - Pour chaque ligne : **si `notifyAccessExpiry`** → `sendAccessExpiringEmail(...)` ;
    **toujours** → `UPDATE expiryReminderSentAt = now`.

> **Marqueur posé pour TOUT éligible-par-date, envoi seulement aux opt-in.** Ne
> PAS filtrer la préférence dans la requête : sinon les lignes des utilisateurs
> opt-out (jamais notifiées) restent `IS NULL` et sont **re-scannées à chaque run**,
> finissant par **saturer la borne de 500/200** au détriment des envois réels. On
> lit donc la pref par ligne et on pose le marqueur même sans envoi. Conséquence
> voulue : réactiver la préférence ne renvoie PAS les anciens événements (pas de
> spam d'historique).

### Câblage cron — [close-expired/route.ts](app/api/cron/close-expired/route.ts)

Exécuter le balayage notifications **après** les clôtures (pour inclure les
`auto_submitted` du même run) :

```
const [exam, training, anon] = await Promise.all([...clôtures existantes...])
const notif = await sendPendingNotifications() // examens + accès
```

Cadence : horaire via GitHub Actions → notification ≤ 1 h après clôture. Auth
`CRON_SECRET` inchangée. Ajouter les compteurs au log + à la réponse JSON.

### Emails — `email/`

- `email/templates/exam-results-email.tsx` (nouveau) — via `EmailLayout`, bouton
  vers `/dashboard/examen-blanc/{examId}/resultats`.
- `email/templates/access-expiring-email.tsx` (nouveau) — via `EmailLayout`,
  bouton vers `/dashboard/abonnements`.
- `email/index.tsx` : `+ sendExamResultsEmail({ to, examTitle, score, resultUrl })`,
  `+ sendAccessExpiringEmail({ to, accessType, daysRemaining, renewUrl })`.

### Préférences — `features/notifications/{dal,actions}.ts` (nouveaux)

- `dal.ts` : `getNotificationPreferences()` → `{ examResults, accessExpiry }` lus
  sur l'`user` courant (`import type` partagé vers le client). `server-only` + `cache()` + self-guard.
- `actions.ts` : `updateNotificationPreferences({ examResults, accessExpiry })` —
  `"use server"` → `requireSession` → `zod` → `UPDATE user SET …` → `revalidatePath`.

### Reset du marqueur au renouvellement — `features/payments/stripe.ts`

Quand un paiement prolonge `userAccess.expiresAt` (`completeStripeTransaction`) **et**
dans le grant manuel admin, poser `expiryReminderSentAt = null` dans le même UPDATE
(re-arme le rappel pour le nouveau cycle).

## 6. UI — `profile-preferences.tsx`

Remplacer le bloc désactivé « Bientôt » par **deux `Switch` fonctionnels** (via
`PreferenceItem`, pattern du toggle thème existant) :

- « Résultats d'examen » → `notifyExamResults`
- « Fin d'accès » → `notifyAccessExpiry`

Chaque changement appelle `updateNotificationPreferences` (optimistic + toast ;
`router.refresh()`), préférences initiales passées en props depuis la page profil
(dashboard + admin). **Composant client dédié `profile-notifications.tsx`** pour
isoler l'état des switchs (rendu à l'intérieur de `ProfilePreferences`, à la place
du bloc désactivé). `data-testid` : `notif-toggle-exam-results`,
`notif-toggle-access-expiry`.

## 7. Idempotence & sécurité

- Marqueurs (`resultsNotifiedAt`, `expiryReminderSentAt`) = envoi **une fois**.
- Cron gardé par `CRON_SECRET` (fail-closed) ; requêtes **bornées** ; **résilience**
  par ligne.
- Préférence respectée à l'envoi ; comptes supprimés (`deletedAt`) exclus.
- Sandbox dev : `EMAIL_OVERRIDE_TO` redirige tous les envois (déjà en place).
- Pas de secret exposé (les crons/DAL ne renvoient pas de token).

## 8. Tests

- **Intégration (`tests/integration/`)** :
  - `sendExamResultsNotifications` : envoie pour un participant d'examen **clos**,
    pose le marqueur, **2e run = no-op** ; examen **non clos** = rien ; user
    **opt-out** = pas d'envoi mais marqueur posé ; `sendEmail` mocké (assert appelé/non).
  - `sendAccessExpiryReminders` : accès à ≤ 7 j = envoi + marqueur ; > 7 j = rien ;
    2e run = no-op ; **reset au renouvellement** re-arme.
  - `updateNotificationPreferences` : persiste les 2 booléens (garde session).
- **Frontend (`tests/`)** : les 2 switchs (état initial, appel de l'action au toggle).

## 9. Découpage suggéré (pour le plan)

1. **Schéma + migration** (colonnes user + marqueurs) + `bun run db:generate/migrate`.
2. **Templates + helpers email** (`exam-results`, `access-expiring`).
3. **Cron notifs** (`features/notifications/cron.ts`) + câblage route + **reset au
   renouvellement** (`stripe.ts` + grant manuel) + tests intégration.
4. **DAL/action préférences** + **UI** (switchs) + tests frontend.
5. **Revue** (auto + adversariale) avant push.

## 10. Hors périmètre (non retenu)

- Récap de session d'entraînement, rappels d'étude/inactivité.
- Reçu de paiement / alerte sécurité « nouvelle connexion » (transactionnels — à
  ajouter plus tard si besoin, toujours-actifs).
- Table de notifications générique / centre de notifications in-app.
