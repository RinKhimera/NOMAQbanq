# Passation — Migration Convex→Drizzle, Phase 7 (suite : 7d uploaders + 7e taint, puis purge)

> **À lire en premier.** Contexte durable COMPLET = **mémoire projet**
> `project_convex_to_drizzle_migration.md` (chargée auto via `MEMORY.md`, **à jour :
> Phase 5 + 5.6 + 7a/7b Stripe + 7c crons TERMINÉS**) + skill
> `convex-to-betterauth-drizzle-neon`. **Conventions** = `.claude/rules/data-layer.md`
> + handoffs précédents (`docs/superpowers/handoffs/2026-06-23-phase5.5-handoff.md`
> §2 conventions, §3 pièges — toujours valides). Ne PAS redemander ce qui y est.

Branche : `migration/drizzle-neon` (jamais déployée). Neon dev = `develop`
(`br-restless-morning-ad4uyo3t`, projet `lucky-waterfall-33371811`). **NE JAMAIS**
toucher `production` (`br-blue-moon-adhu1l69`) ni imprimer `.env.local`.

---

## 1. Où on en est

**Tout le cœur fonctionnel + Stripe + crons sont migrés.** Tous les écrans actifs
sont hors Convex (`useQuery`/`useAction`). Derniers commits :
`… bd7b94b (7a) → 4a8ac55 (7b-1) → 4f32dc7 (7b-2) → 130e9b0 (remédiation revue Stripe)
→ ef52911 (7c crons)`. Gates à chaque commit : **check 0, build 0, frontend+convex
1284, intégration 14 fichiers/126**.

- **Stripe (7a+7b) FAIT + REVU** (verdict OUI, aucun 🔴, remédié `130e9b0`). Détail
  complet en mémoire. ⚠️ **Différé avant prod** : #4 remboursements/litiges Stripe non
  gérés (accès persiste après refund — décision PRODUIT ; le refund MANUEL admin
  révoque déjà) ; #5 portail = lookup customer par email.
- **7c crons FAIT** (`ef52911`, **PAS encore revu**) : 2 crons Convex → 1 cron Vercel
  horaire (`vercel.json` `0 * * * *`), `features/{exams,training}/cron.ts`, route
  `app/api/cron/close-expired` (auth `Bearer ${CRON_SECRET}` fail-closed). ⚠️ déploiement :
  `CRON_SECRET` côté Vercel + **fréquence horaire ⇒ plan Pro** (Hobby = 1×/jour).

## 2. Revue antagoniste — RECOMMANDATION

**NE PAS réviser 7c seul.** Il est à faible surface, testé, et réutilise des patterns
déjà validés (UPDATE gardé `status='in_progress'` = fix #2 revue Stripe ; cron auth
fail-closed = pattern webhook). **Grouper une seule revue antagoniste sur 7c + 7d + 7e**
(cluster « infra/durcissement Phase 7 ») **juste avant la purge finale**. Le vrai
terrain d'attaque neuf est 7d (upload fichiers). Skill `adversarial-review-prompt`,
range depuis `ef52911^` (ou `130e9b0` = dernière revue) jusqu'au tip post-7e.
Crochets à activer : **opérationnel** (prod Neon intouchée, `.env.local` jamais imprimé,
**aucun upload réel vers Bunny** — clés possiblement live) + **parité** (source Convex).

## 3. Ce qui reste

### 7d — Uploaders Bunny (le gros morceau ; surface d'attaque réelle)
Upload/suppression de fichiers vers **Bunny Storage Zone**, neutralisés pendant la
migration (avatar 5.0, images questions 5.3 — réordonnancement local persisté via
`setQuestionImages`, mais aucun PUT/DELETE Bunny).

**À porter depuis Convex** :
- `convex/lib/bunny.ts` → `lib/bunny.ts` (nouveau). Env : `BUNNY_STORAGE_ZONE_NAME`,
  `BUNNY_STORAGE_API_KEY`, `BUNNY_CDN_HOSTNAME` (à AJOUTER dans `lib/env/schema.ts`,
  optionnelles façon Stripe/SES). `uploadToBunny` (PUT Storage), suppression (DELETE
  Storage). L'affichage existe déjà : `lib/cdn.ts` `cdnUrl(storagePath)`.
- `convex/http.ts` routes `POST /api/upload/avatar` (rate 5/h) + `POST /api/upload/
  question-image` (admin, rate 50/h) → **route handlers Next** `app/api/upload/*` OU
  **Server Actions** (préférer Server Actions si le flux le permet ; sinon route
  multipart). Rate-limit : `convex/rateLimit.ts` à porter (table Drizzle ou Better Auth
  rate-limit, ou un simple compteur par user/fenêtre).
- Composants neutralisés à recâbler : `components/shared/avatar-uploader.tsx`
  (consommé par `app/(dashboard)/dashboard/profil/_components/profile-security.tsx`),
  `components/admin/question-image-uploader.tsx` (consommé par
  `app/(admin)/admin/questions/_components/question-form-page.tsx`).
- **Suppression Bunny** : brancher la suppression réelle dans `setQuestionImages`
  (features/questions/actions — actuellement « différée Phase 7 ») + clear-all-images
  (F6 revue 5.4, non persisté). Avatars : ancien path Bunny à supprimer au remplacement.

**Sécurité (zones à soigner — c'est ce que la revue scrutera)** : validation
content-type + taille AVANT upload (réutiliser `validateImageFile` Convex), garde admin
sur question-image / session sur avatar, rate-limit effectif, pas de SSRF / path
traversal sur le `storagePath`, nom de fichier dérivé serveur (pas de l'input client).
Modèle Proxéa réutilisable : repo `C:\Users\samue\Downloads\Code\proxea_v2`
(`lib/bunny*.ts`, rule `storage-images.md`).

### 7e — Durcissement taint PII
Appliquer `experimental_taintObjectReference` / `taintUniqueValue` (React) sur les
champs PII renvoyés par les DAL (emails, tokens) pour empêcher leur fuite vers le
bundle client. Identifier les DAL qui exposent du PII (`features/users`, `payments`,
leaderboard, analytics `getRecentActivity`) et tainter au point de retour serveur.
Mesure de défense en profondeur ; petit périmètre.

### Purge finale (APRÈS 7d+7e+revue)
Préflight : **4 fichiers** `convex/react` restants, TOUS purge (aucun écran actif) :
grappe questions morte `components/admin/{edit-question-dialog,question-form,
questions-list}.tsx` + `providers/convex-client-provider.tsx` (shim no-auth). Étapes :
supprimer `convex/`, désinstaller deps `@clerk/*` + `convex`, retirer le shim provider,
`_id`→`id` résiduels, code mort (grappes questions/users mortes — cf. mémoire). Vérifier
qu'aucun `import … convex/_generated` runtime ne subsiste (la plupart = types erasés).

## 4. Conventions (rappel — détail `.claude/rules/data-layer.md`)
- `features/<domaine>/{schemas,dal,actions,lib,cron}.ts`. DAL `server-only` + `cache()`
  + colonnes ciblées + self-guard. Actions `'use server'` → guard → zod → écriture →
  `revalidatePath`. Mutations concurrentes : `db.transaction` + verrou de ligne
  (`.for("update")`) ou **UPDATE gardé** sur le statut attendu (cf. crons 7c, fail Stripe).
- Routes API (webhook/cron/upload) : `export const runtime = "nodejs"`, secret en
  `Authorization: Bearer`, **fail-closed** si secret absent, **500 sur erreur inattendue**
  (≠ 200-toujours) pour laisser le réessai. Le proxy laisse passer `/api/*` (seuls
  `/dashboard` `/admin` sont gardés).
- Env : nouvelles vars optionnelles (`z.string().optional()`) + erreur claire à l'usage ;
  garde-fou `.refine()` si deux vars vont ensemble (cf. `STRIPE_WEBHOOK_SECRET`).
- Gates par commit : `bun run check` (0) + `bun run build` (0) ; +
  `bun run test:integration` **si DAL/lib/cron/actions change** (branche Neon éphémère,
  hérite de `develop` → **assertions baseline-delta** pour les agrégats globaux,
  appartenance par id pour les listes). SonarLint (`typescript:Sxxxx`) = IDE-only, ignorer.

## 5. Différé / dette (avant la bascule prod — cf. mémoire pour le détail)
- **Stripe #4** (politique remboursement Stripe) + **#5** (portail email).
- `UNIQUE(products.code)` (rendre les tests d'intégration upsert-safe d'abord).
- Protéger la branche Neon `production` (console). Accès prod **SES** (sortie sandbox).
- **F1** `scoreQuizAnswers`/`getRandomQuizQuestions` publics : rate-limit IP avant
  déploiement public.
- N1 (waitUntil SES), N6 (neon.ts protection). Crons : **plan Vercel Pro** pour l'horaire.

## 6. Test E2E navigateur (réutilisable)
Compte + examen de test sur `develop` (mémoire `reference-e2e-test-data-nomaq`) :
`e2e.examen@nomaqtest.local` / `TestPassw0rd!` (admin). Pièges sign-in CSRF/onboarding
(`username` requis) + app dev sur **:3001** si 3000 occupé. Méthode = skill
`playwright-cli`.
