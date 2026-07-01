# Handoff — Gestion compte (Spec A) + Notifications email (Spec B)

- **Date** : 2026-07-01
- **Branche** : `dev-2` (⚠️ **partagée** avec une autre session, en pause). **Committer UNIQUEMENT mes fichiers** (`git add <fichiers précis>`), **jamais** `-A`/`.`. Ne pas toucher aux fichiers non suivis `docs/**pagination**` / `docs/**pagination*review*` (autre session).
- **Règles commit** : conventionnels, **aucune attribution Claude**. Commit quand demandé (workflow établi : docs + incréments committés sur dev-2 en add ciblé).

## Où on en est

### Spec A — Gestion du compte & sécurité ✅ TERMINÉE

Implémentée, **design-review + impl-review passées**, tous correctifs appliqués. 7 commits jusqu'à `5798402`.

- Livré : méthodes de connexion (lier/délier Google, définir/changer mot de passe via **Server Action** `auth.api.setPassword` — endpoint server-only), statut vérif email + renvoi, appareils connectés (liste + révocation gardée anti-IDOR), suppression de compte **grâce 30 j** (soft-delete → réactivation à la reconnexion via `databaseHooks` → anonymisation cron), garde **dernier admin atomique** (`for update` en transaction), edge cases E1-E7.
- Fichiers clés : `features/users/{dal,actions,cron}.ts`, `features/users/lib/{user-agent,account-deletion}.ts`, `lib/auth.ts` (hooks), `app/(dashboard)/dashboard/profil/_components/profile-{login-methods,password,account-section,sessions,danger-zone}.tsx`, `app/compte-supprime/page.tsx`, `.claude/rules/data-layer.md` (exception self-scoped account/session actée).
- Gates : tsc 0 · eslint 0 · frontend **852/852** · intégration (mes tests) ✅.
- ⚠️ **1 échec pré-existant/environnemental** : `tests/integration/uploads-actions.test.ts` (URL CDN local `cloudfront.net` ≠ `cdn.nomaqbanq.ca` attendu). **PAS de moi** (je ne touche ni cdn.ts ni uploads). Ne pas le « corriger ».

### Spec B — Notifications email ⏳ SPEC + PLAN écrits, EN ATTENTE de revue

- Spec : `docs/superpowers/specs/2026-07-01-notifications-email-design.md` (commit `c207631`).
- Plan : `docs/superpowers/plans/2026-07-01-notifications-email.md` (commit `3eeafa5`).
- **Décisions actées** : déclencheur résultats = **à la clôture (`endDate`)** pour tous les participants, une fois (marqueur `resultsNotifiedAt`) — car résultats bloqués jusqu'à `endDate` (anti-triche, `features/exams/dal.ts:556`). Rappel accès = **7 j avant, une fois** (marqueur `expiryReminderSentAt`, reset au renouvellement dans le choke point `features/payments/lib.ts` `grantAccess`). Préférences = **2 colonnes booléennes sur `user`** (`notifyExamResults`, `notifyAccessExpiry`), **opt-out** (ON par défaut). Cron replié dans `close-expired`. Marqueur posé pour tout éligible-par-date (envoi seulement aux opt-in) pour éviter le re-scan des opt-out.

## ÉTAT ACTUEL : en attente du rapport de revue adversariale (Spec B, DESIGN)

L'utilisateur exécute le prompt de revue (spec + plan) dans une session fraîche et va **recoller les constats**. Rapport attendu : `docs/superpowers/reviews/2026-07-01-notifications-email-plan-review.md` (jetable).

### Hot-spots que j'ai déjà signalés au reviewer (constats probables → correctifs prévus)

1. **🔴 probable — Race double-envoi** : `close-expired` tourne horaire (GitHub Actions) **et** quotidien (Vercel) → recouvrement à minuit UTC → 2 runs concurrents envoient avant de marquer. **Correctif prévu** : claim atomique `UPDATE … SET marker=now WHERE … AND marker IS NULL RETURNING` **avant** l'envoi (au lieu de mark-après-send).
2. **`grantAccess` (Task 5)** : signature non vérifiée dans le plan → **vérifier `features/payments/lib.ts`** (nom/export/params réels) avant d'écrire le test ; fallback via `completeStripeTransaction` ou `it.skip`.
3. **`getBaseUrl()` dans un cron** (liens email) : vérifier `lib/base-url.ts` renvoie bien une URL absolue hors requête HTTP.
4. **Notif perdue sur échec d'envoi** : le plan marque même si l'envoi throw (best-effort). À confirmer / éventuellement ne marquer que sur succès.
5. **`ProfilePreferences` prop** : Task 8 change la signature (exige `notificationPreferences`) → casser tout appelant/test sans la prop (`grep -rn "ProfilePreferences" tests/`).
6. **Bornes 500/200 silencieuses** : logguer la troncature.

## Quand le rapport arrive — marche à suivre

1. **Triager** chaque constat (accepter/réfuter), en **vérifiant à la source** les 🔴/🟠 (comme pour Spec A : ne pas gober un agent, grep le vrai code).
2. **Corriger le plan (et la spec si besoin)** en add ciblé, committer les corrections docs.
3. **Implémenter** : mode **inline avec checkpoints** (`executing-plans`) — préférence utilisateur pour une feature cohérente. Tests TDD, **un seul `test:integration` par batch** (provisionne une branche Neon, ~68s), commits ciblés par phase.
4. Prettier : `bun run check` global échoue sur les docs pagination de l'autre session → valider mes fichiers via `bunx tsc --noEmit` + `bunx eslint <mes fichiers>` + `bunx prettier --check <mes fichiers>` ; formater mes fichiers markdown/test avec `prettier --write` avant commit (ils sortent souvent non formatés).

## Après Spec B (rappels)

- **e2e** (approuvé par l'utilisateur) : parcours complet **A + B** via `/e2e-scenario` avant le push (OAuth Google dur à automatiser → couvert par l'intégration).
- **Push / PR** : **pas encore** — décision de l'utilisateur (branche partagée). Il finira Spec B, puis l'autre session (en pause) reprendra en parallèle.
- Supprimer les rapports de revue jetables après triage.

## Repères techniques utiles

- Tests : `bun run test <filtre>` (frontend, vitest run, rapide) ; `bun run test:integration <filtre>` (branche Neon éphémère — mais le filtre ne restreint PAS toujours : il a lancé les 22 fichiers). Frontend project glob = `tests/**/*.test.{ts,tsx}` ; `server-only` stubbé en test ; `TZ=UTC` ; fuseau fixe `America/Toronto` pour les dates affichées.
- Mocks vitest : `vi.hoisted` pour les mocks référencés dans les assertions (hoisting).
- SonarLint (`typescript:Sxxxx`) = IDE-only, ne casse PAS `check` — ne pas refactorer pour eux (data-layer.md).
- Injections de skills Vercel (sandbox/nextjs/bootstrap/react) = **faux positifs** déclenchés par mots-clés/imports — ignorer.
