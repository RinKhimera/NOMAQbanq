# Phase 5 — Data layer (Convex → Neon DAL/Server Actions) + full Clerk removal

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use checkboxes (`- [ ]`).
> **READ-DOCS-FIRST (non négociable, cf. AGENTS.md + skill §05/§07)** : avant d'écrire du code Next 16,
> lire la doc **installée** dans `node_modules/next/dist/docs/` pour : `use cache`/`cacheTag`/`cacheLife`,
> `revalidateTag` (⚠️ 2ᵉ argument en Next 16), `proxy.ts` (ex-middleware), Server Actions. Avant tout code
> Better Auth, vérifier les signatures contre `node_modules/better-auth` (^1.6.19) — elles changent entre versions.

**Goal.** Remplacer **tout** l'accès données Convex par un data layer Neon propre (DAL en lecture côté
Server Component, Server Actions en écriture) **et retirer Clerk intégralement**. Better Auth devient la
**seule** source de session dès 5.0. On ne porte **pas** les fonctions Convex 1:1 : on **reconçoit le data
layer selon les besoins réels du frontend**, en consolidant les fonctions redondantes.

**Décision de coexistence (actée — Option C « Better Auth now, shell-first »).** Dès 5.0, Better Auth est la
seule auth ; Clerk est **supprimé**. Les écrans Convex non encore convertis **cassent transitoirement** sur
la branche `migration/drizzle-neon` (jamais déployée avant la bascule Phase 8). Les gates par domaine
s'appuient sur des **tests d'intégration DAL/Actions** (branche Neon éphémère) + E2E ciblés ; le full-app
E2E revient en Phase 6/7. À la fin de la phase, **Convex et Clerk sont désinstallés ensemble**.

**Tech stack.** Next.js 16 (App Router, Server Components, Server Actions, `use cache`) · Better Auth ^1.6.19
(`admin`, `nextCookies`) · Drizzle + `pg` Pool (Neon `develop`) · React 19 (`useActionState`/`useOptimistic`)
· zod · Bunny CDN (uploads) · Vitest (intégration sur branche Neon éphémère).

---

## 0. Conventions (valent pour toutes les sous-phases)

### 0.1 Arborescence par domaine
```
features/<domaine>/
  schemas.ts     # zod partagés client+serveur (validation)
  dal.ts         # lectures (import 'server-only'); sélectionne UNIQUEMENT les colonnes utiles
  actions.ts     # Server Actions ('use server'); authz + zod + write + revalidate
  lib.ts         # (optionnel) helpers purs du domaine (calcul de score, mapping)
```
Domaines : `auth` (session/guards déjà en `lib/`), `users`, `payments`, `questions`, `training`, `exams`,
`marketing`.

### 0.2 DAL (lectures) — gabarit `assets/dal-example.ts.md`
- `import 'server-only'` en tête. **Jamais** d'import de `db` depuis un Client Component.
- **PAS de `select()` nu** (= `SELECT *`, « fat documents »). Toujours `db.select({ ...colonnes utiles })` —
  ex. ne jamais charger `questions.options`/`question_explanations.explanation` dans une liste.
- `cache()` (React) pour dédoublonner par requête. Session via `lib/dal.ts` (déjà fait, + `taint` PII à ajouter).
- **Filtrer `isNull(deletedAt)`** sur `users`/`questions` (soft-delete).
- **Pas de N+1** : `inArray()` + regroupement en mémoire, ou `JOIN`. (Référence `convex/lib/batchFetch.ts` →
  `inArray`.)
- **Pagination = keyset** (`WHERE (created_at, id) < (:cursor)` `ORDER BY created_at DESC, id DESC LIMIT n+1`),
  pas d'`OFFSET` (lent sur grandes tables). Cursor opaque = base64(`${createdAt}|${id}`).
- **Comptages** = `COUNT(*)`/`EXISTS` sur index (les 3 tables d'agrégats Convex sont **supprimées**, cf. spec D).

### 0.3 Server Actions (écritures) — gabarit `assets/server-action-example.ts.md`
- `'use server'`. **Chaque export = fonction `async` LITTÉRALE** (`export const x = async () => …`) sinon casse au build Next.
- Ordre imposé : **1) authz** (`requireSession`/`requireRole`) → **2) zod** (même schéma que le client) →
  **3) write** (`db`/`dbTx.transaction` si multi-écritures) → **4) revalidate** (`revalidateTag`/`revalidatePath`) →
  **5) retour d'état discriminé** (`{status:'idle'|'success'|'error', fieldErrors?, formError?}`).
- **Ownership** vérifié dans l'action (ex. `session.user.id === row.userId`), pas seulement le rôle.
- **Rate-limit** : porter les limites Convex critiques (création training 10/h, uploads) — via la table
  `upload_rate_limits` existante ou le rate-limit Better Auth selon le cas. (Détail au domaine concerné.)

### 0.4 Réactivité (cf. `references/05`)
- **~90 % des écrans** : Server Component `await` DAL → fraîcheur via `revalidateTag` dans l'action +
  `router.refresh()` après action client si besoin. **Pas de temps réel.**
- **Écrans « passation »** (examen, entraînement, quiz marketing) : **fetch-once** (Server Component charge
  l'état initial) + **état client** + Server Actions (`useActionState`/`useOptimistic`). Déjà non-live côté Convex.
- **Stats marketing publiques** : `use cache` + `cacheLife` (ISR), revalidées périodiquement — pas un COUNT par visite.
- ⚠️ **Câblage client** (`useMutation` → action) : pattern A (form RHF+zodResolver → FormData → `startTransition(action)`)
  ou pattern B (dialog/bouton → `startTransition(async () => { const r = await action(...); ... router.refresh() })`).

### 0.5 « Rebuild from frontend needs » — consolidation (mandat utilisateur)
Ne pas redupliquer les variantes Convex. Concevoir le **set minimal** que le frontend consomme réellement.
Consolidations cibles (détaillées par domaine ci-dessous) :
- Accès : `hasExamAccess` + `hasTrainingAccess` + `getMyAccessStatus` + `getUserAccessStatus` → **un** `getAccessStatus(userId?)`.
- Questions (listes) : `getQuestionsWithFilters` + `getQuestionsWithPagination` + `getAllQuestions` + `getAllQuestionIds` → **un** `listQuestions(filters, cursor)` keyset + `countQuestions(filters)`.
- Agrégats : `getQuestionStats*` / `getAvailableDomains` / `objectifCMCStats` → **COUNT/GROUP BY** à la demande (+ `use cache` si public).
- Chaque sous-phase liste les fusions retenues ; tout `// TODO`/variante non utilisée par le frontend est **supprimé**, pas porté.

---

## Sub-phase 5.0 — Auth shell cutover + suppression de Clerk

> Objectif : Better Auth = seule session ; **zéro `@clerk/*`** dans le code applicatif ; le shell (nav,
> session, route-protection, pages auth) tourne sur Better Auth. Après 5.0, les écrans Convex authentifiés
> non convertis cassent (attendu).

**État actuel à remplacer :** `providers/convex-client-provider.tsx` (`ClerkProvider`+`ConvexProviderWithClerk`),
`proxy.ts` (`clerkMiddleware`), `hooks/useCurrentUser.ts` (Convex via Clerk), `app/(auth)/auth/sign-in|sign-up/[[...]]`
(`<SignIn/>`/`<SignUp/>`), 3× `SignOutButton`, `avatar-uploader` (`useAuth`), `profile-security` (`useClerk`),
`components/admin-protection.tsx`. `app/api/auth/[...all]/route.ts` existe déjà (Better Auth handler) ✅.

- [ ] **Task 5.0.1 — Provider.** Réécrire `providers/convex-client-provider.tsx` → retirer Clerk. Garder un
  `ConvexProvider` **non authentifié** (client public, pour les écrans Convex pas encore convertis) +
  `MotionConfig`. Better Auth s'utilise via `authClient` (hooks) — pas de provider requis. Renommer le fichier
  (`providers/app-providers.tsx`) si pertinent et mettre à jour `app/layout.tsx`.
- [ ] **Task 5.0.2 — Pages auth Better Auth.** Remplacer sign-in/sign-up Clerk par des formulaires custom
  (RHF + zodResolver + `authClient.signIn.email`/`signIn.social({provider:'google'})`/`signUp.email`) sous
  `app/(auth)/auth/sign-in/page.tsx`, `.../sign-up/page.tsx`, **+ ajouter** `forgot-password/page.tsx` et
  `reset-password/page.tsx` (`requestPasswordReset`/`resetPassword` — chemin re-login vérifié en Phase 4).
  Supprimer les dossiers catch-all `[[...sign-in]]`/`[[...sign-up]]`. Textes FR + accents.
- [ ] **Task 5.0.3 — `proxy.ts` Better Auth.** Remplacer `clerkMiddleware` par un check de session Better Auth.
  Recommandé (doc Better Auth + Next 16) : check **optimiste** du cookie en proxy (`getSessionCookie(request)`
  depuis `better-auth/cookies`) pour rediriger `/dashboard`,`/admin` non connectés ; la **vraie** vérif (et le
  rôle admin) reste dans la DAL/guards (défense en profondeur). Conserver la redirection connecté→`/dashboard`
  sur routes vitrine. **Lire la doc proxy Next 16 installée** avant d'écrire.
- [ ] **Task 5.0.4 — Hook session client.** Remplacer `hooks/useCurrentUser.ts` (Convex/Clerk) par Better Auth
  `authClient.useSession()` (ou un wrapper `useCurrentUser` exposant `{user, isPending}`). Mettre à jour tous
  les consommateurs (nav, layouts, `admin-protection.tsx`).
- [ ] **Task 5.0.5 — Logout + liens.** Les 3 `SignOutButton` (`generic-nav-user`, `marketing-header`,
  `mobile-menu`) → bouton appelant `authClient.signOut()` + `router.push('/auth/sign-in')`. `avatar-uploader`
  `useAuth` → session Better Auth. `profile-security` `useClerk` → actions Better Auth (changer mot de passe via
  `authClient.changePassword`, gérer sessions) — porter le strict nécessaire utilisé par l'UI.
- [ ] **Task 5.0.6 — Guard admin serveur.** `components/admin-protection.tsx` (et layouts admin/dashboard) →
  `requireSession()`/`requireRole(['admin'])` (déjà créés en Phase 4) côté Server Component.
- [ ] **Task 5.0.7 — `taint` PII + config.** Ajouter `experimental_taintObjectReference` dans `lib/dal.ts` et
  `experimental.taint: true` dans `next.config.ts` (cf. `assets/dal-example.ts.md`).
- [ ] **Task 5.0.8 — Purge Clerk.** Supprimer tout import `@clerk/*` du code applicatif. (Les **deps**
  `@clerk/*` dans `package.json` ne sont retirées qu'en 5.6/Phase 8 — voir note.) `grep -r "@clerk" app components hooks providers lib` = vide.
- [ ] **Gate 5.0 :** `bun run check` + `bun run build` verts ; `grep @clerk` (hors `package.json`) vide ;
  login Google **et** email/mdp fonctionnels (manuel) ; routes protégées redirigent ; écrans **publics** OK.

> **Note deps :** garder `@clerk/*` et `convex` installés tant que des écrans non convertis les importent ;
> désinstaller en 5.6 quand le dernier `useQuery`/`@clerk` a disparu (sinon build cassé).

---

## Sub-phases data — ordre & contenu

Ordre retenu (débloque vite les flux à forte valeur ; respecte le DAG de dépendances) :
**5.1 users → 5.2 payments/accès → 5.3 questions → 5.4 training → 5.5 exams → 5.6 marketing + purge finale.**
(La spec §10 listait questions d'abord ; on remonte `users` car le shell en dépend, et `payments/accès` car il
garde les flux examen/entraînement.) Marketing (public) ne casse pas sous Option C → convertible en dernier.

**Patron commun à chaque sous-phase data :**
1. Concevoir le **set minimal** DAL+Actions du domaine (table de consolidation ci-dessous).
2. Écrire `features/<d>/schemas.ts`, `dal.ts`, `actions.ts` (gabarits §0).
3. Recâbler les call sites (Server Component `await` DAL ; `useMutation`→action).
4. **Migrer les tests** du domaine en **tests d'intégration** (branche Neon éphémère, §Tests).
5. **Supprimer** les fonctions Convex du domaine + les `useQuery/useMutation` correspondants.
6. Gate : `tsc`+lint+tests du domaine verts ; `grep` du domaine sans `api.<d>`.

### 5.1 — Users / profil / stats admin
- **DAL** : `getCurrentUser()` (id,name,email,username,bio,image,role — **pas** de PII superflue), `getUserById(id)`
  (admin), `listUsers(cursor, filter)` (keyset, colonnes liste only), `getAdminOverviewStats()` (COUNT users actifs,
  examens actifs… en `COUNT`/`GROUP BY`).
- **Actions** : `updateProfile` (name/username/bio — unicité username via contrainte + catch), `updateAvatar`
  (path Bunny dans `image` — modèle Proxéa ; upload réel = Phase 7, ici l'action écrit le `path`).
- **Consolidation** : `isCurrentUserAdmin` → dérivé de `session.user.role` (supprimé). `getAllUsers` (.take(1000))
  → `listUsers` keyset paginé. Webhooks Clerk (`upsertFromClerk`/`createUser`/`deleteFromClerk`/cascade) →
  **supprimés** (Better Auth = source ; suppression de compte = Phase 7 via action + cascade FK + Bunny).
- **Call sites** : `profil/page.tsx` (admin+dashboard), `admin/users/page.tsx`, `admin/users/[id]`, `admin/page.tsx` (stats).
- **Gate** : profil lit/écrit via DAL/action ; liste admin paginée ; 0 `api.users`.

### 5.2 — Payments / accès
- **DAL** : `getAccessStatus(userId?)` **unique** (exam+training booléens + dates d'expiration ; `userId` admin,
  sinon session) ; `getAvailableProducts()` (public → `use cache`) ; `listMyTransactions(cursor)` /
  `listAllTransactions(cursor, filters)` (keyset, JOIN produit/user, colonnes utiles) ; `getTransactionStats()`,
  `getRevenueByDay()`, `getExpiringAccess()` (COUNT/GROUP BY/agrégats SQL) ; `getTransactionAccessImpact(id)`.
- **Actions** : `recordManualPayment`, `updateManualTransaction`, `deleteManualTransaction` (admin ; +
  recalcul d'accès ; `dbTx.transaction`). (Webhooks Stripe = **Phase 7**, pas ici — `createPending`/`completeStripe`/
  `failStripe` deviennent des helpers appelés par la route webhook.)
- **Consolidation** : `hasExamAccess`+`hasTrainingAccess`+`getMyAccessStatus`+`getUserAccessStatus` → `getAccessStatus`.
  `getProductByCode` (internal) → helper DAL.
- **Call sites** : `profil`, `abonnements` (keyset), `payment/success`, `admin/transactions`, `admin/users/[id]`,
  `training-paywall`, gating examen/entraînement.
- **Gate** : un seul point d'accès `getAccessStatus` ; transactions paginées keyset ; 0 `api.payments` (hors webhook Phase 7).

### 5.3 — Questions (+ quiz marketing)
- **DAL** : `listQuestions(filters, cursor)` keyset (domaine, recherche, withImages) **+** `countQuestions(filters)` ;
  `getQuestionById(id)` (avec explication/références/images **chargées séparément**, pas un fat doc) ;
  `getQuestionsForExam(ids)` (`inArray`, masque `correctAnswer` selon contexte) ; `getUniqueObjectifsCMC()` ;
  `getQuestionExplanations(questionIds)` (lazy, review-only ; inclut `image_path` d'explication). Recherche : si la
  full-text `tsvector`/GIN n'est pas encore posée, l'**ajouter ici** (différée depuis Phase 3) — sinon `ILIKE` indexé.
- **Actions** : `createQuestion`, `updateQuestion`, `deleteQuestion` (soft-delete + cascade explications/images via FK),
  `addQuestionImage`/`removeQuestionImage`/`reorderQuestionImages` (DB ; **CDN Bunny = Phase 7**),
  `getRandomQuestions`+`scoreQuizAnswers` (quiz marketing → 1 DAL random + 1 action de scoring).
- **Consolidation** : 4 variantes de liste → `listQuestions`+`countQuestions`. `getAllQuestionsForExport` (action
  non réactive) → DAL streaming/keyset batch. Les `*Stats` agrégés → COUNT/GROUP BY.
- **Call sites** : `admin/questions/*`, `question-browser` (keyset), `question-form`, image uploader, `evaluation/quiz`.
- **Gate** : liste keyset + count ; détail sans fat doc ; quiz marketing OK ; 0 `api.questions`.

### 5.4 — Training (modèle 2 tables déjà en schéma : `training_sessions` + `training_session_items`)
- **DAL** : `getActiveSession(userId)` (avec check d'expiration) ; `getSessionById(id)` (items + réponses ; masque
  `correctAnswer` si in_progress) ; `listHistory(userId, cursor)` keyset ; `getSessionResults(id)` ;
  `getTrainingStats(userId)` + `getScoreHistory(userId)` (dashboard) ; `getAvailableDomains()`/`getAvailableObjectifsCMC()`
  (COUNT/GROUP BY sur `questions`).
- **Actions** : `createSession` (crée la session + **les items** au démarrage ; rate-limit 10/h non-admin) ;
  `saveAnswer` (upsert sur `training_session_items` ; ownership) ; `completeSession` (score final) ;
  `abandonSession` ; `deleteSession` / `deleteAllSessions`.
- **Consolidation** : `participations`+`trainingAnswers` Convex → 2 tables normalisées (réponse portée par l'item).
  Sessions `in_progress` historiques **abandonnées** à la bascule (décision actée).
- **Call sites** : `entrainement/page`, `[sessionId]/page` (passation : fetch-once + état client), `[sessionId]/results`,
  history (keyset), dialogs delete, resume-card.
- **Gate** : créer→répondre→compléter→résultats OK ; history keyset ; 0 `api.training`.

### 5.5 — Exams (le plus dépendant : users + questions)
- **DAL** : `getMyAvailableExams(userId)` (actifs, fenêtre de dates, accès-gated) ; `getExamWithQuestions(id, {forAdmin})`
  (masque `correctAnswer` hors admin) ; `getExamSession(participationId|userId,examId)` (état in_progress/completed/
  auto_submitted + pause serveur) ; `getParticipantResults(examId,userId)` (réponses+questions ; admin ou propriétaire) ;
  `listExamsAdmin(cursor)` (+ COUNT participations) ; leaderboard/section-stats (agrégats SQL).
- **Actions** : `createExam` (depuis ids → `exam_questions` ordonné) ; `updateExam` ; `deleteExam` (cascade
  participations/réponses) ; `deactivateExam`/`reactivateExam` ; `startExam` (crée participation + état pause ;
  `UNIQUE(exam_id,user_id)` empêche le doublon) ; `submitExamAnswers` (score ; `dbTx`).
- **Consolidation** : `examParticipationStats` (table d'agrégat) → COUNT à la demande. Pause = état serveur dans la
  participation (déjà le cas).
- **Call sites** : `examen-blanc/page`, `[examId]/evaluation` (passation : fetch-once + état client + pause),
  `[examId]/resultats`, `admin/exams/*` (détails, leaderboard, stats, modals).
- **Gate** : démarrer→passer→soumettre→résultats OK ; admin CRUD OK ; 0 `api.exams`.

### 5.6 — Marketing public + purge finale
- **DAL** : `getMarketingStats()` (COUNT questions/users/domaines + taux) en `use cache`/`cacheLife` ;
  `getRecentActivity()`/`getDashboardTrends()`/`getFailedPaymentsCount()` (admin, agrégats SQL).
- **Purge** : supprimer `convex/` (fonctions migrées), `providers` Convex restants, **désinstaller** `convex`,
  `convex/react-clerk`, `@clerk/*`, `@convex-dev/*` de `package.json`. Retirer `NEXT_PUBLIC_CONVEX_URL`,
  `NEXT_PUBLIC_CLERK_*`, `CLERK_*`. (Les **crons/webhooks/uploads/E2E** = Phase 7 ; la **bascule prod** = Phase 8.)
- **Gate** : `grep -r "convex\|@clerk"` (hors docs/historique) vide ; `bun run check`+`test`+`build` verts ; coverage ≥ 75 %.

---

## Tests (cf. spec §9)
- **DAL/Actions = tests d'intégration** sur une **branche Neon éphémère par run CI** (créée via API/MCP, schéma
  appliqué par `drizzle-kit push`, seed minimal, détruite en fin de run). Alternative locale : `pglite`/`testcontainers`.
- **Remplacer** progressivement les tests `convex-test` par ces tests d'intégration, **au même rythme** que la
  conversion (un domaine converti = ses tests réécrits). Coverage cible **75 %** maintenue.
- **E2E Playwright** : le bypass auth Clerk (`@clerk/testing`) → **session Better Auth programmatique** (cookie de
  session injecté) ; POMs mis à jour. Gros œuvre E2E = Phase 7, mais le **login E2E** doit suivre dès 5.0.
- Garder `TZ=UTC`. Tests purs (score, mapping) restent unitaires (happy-dom).

## Risques & edge cases
1. **Breakage transitoire (Option C)** : après 5.0, écrans authed non convertis cassent → convertir dans
   l'ordre, gater par tests d'intégration, **ne pas déployer** avant Phase 8.
2. **Session dev ↔ données migrées** : pour tester un écran, il faut une session Better Auth dont `user.id`
   matche une ligne Neon. Login Google (account-linking préserve l'id sur email migré) **ou** seed d'un credential
   sur un user de `develop`. (Rappel fingerprint : `develop` = 185 users / 1 account, user synthétique conservé.)
3. **Pagination keyset** : tie-break `(created_at,id)` obligatoire (created_at non unique). Cursor opaque + validation.
4. **Recherche questions** : full-text `tsvector`/GIN différée depuis Phase 3 — la poser en 5.3 (sinon `ILIKE` indexé,
   à mesurer).
5. **Revalidation Next 16** : `revalidateTag(tag, 'max')` (2ᵉ arg) ; `use cache`/`cacheTag` selon doc installée — **lire avant d'écrire**.
6. **`'use server'` arrow non-async** : casse au build, pas à `tsc` — toujours `async` littérale.
7. **Ownership** : chaque action vérifie `session.user.id` (pas que le rôle) — Convex le faisait dans la fonction.
8. **Deps installées** : ne désinstaller `convex`/`@clerk` qu'en 5.6 (sinon build cassé tant qu'un import subsiste).
9. **Uploads/CDN Bunny, crons, webhooks Stripe** : volontairement **hors 5.x data** → Phase 7 (les actions
   écrivent le `path`/DB ; l'I/O CDN et la signature webhook arrivent en 7).

## Open questions (pour ta revue)
- **OQ1 — Ordre** : OK pour `users → payments → questions → training → exams → marketing` ? (alternative : marketing
  d'abord comme warm-up des conventions, puisqu'il ne casse pas.)
- **OQ2 — Full-text** : poser `tsvector`/GIN en 5.3, ou rester sur `ILIKE` indexé tant que le volume (~3000 Q) ne le
  justifie pas ? (recommandation : `ILIKE` indexé d'abord, mesurer.)
- **OQ3 — Exécution** : je lance en **subagent-driven** sous-phase par sous-phase (implémenteur + revues spec/qualité),
  avec un **commit par task** et un **gate par sous-phase**, en te présentant le diff de 5.0 avant d'enchaîner ?

## Self-review
- **Couverture spec §6/§7/§9/§10** : DAL+Actions par domaine ✅ ; réactivité par écran (revalidate / fetch-once /
  cache) ✅ ; tests d'intégration branche Neon éphémère + E2E Better Auth ✅ ; ordre strangler dev-first ✅.
- **Mandat utilisateur** : Clerk **supprimé** dès 5.0 (pas gardé) ✅ ; data layer **reconçu** (consolidations
  listées par domaine, pas de port 1:1) ✅ ; **no fat documents** (sélection de colonnes, lazy explications/images,
  keyset) ✅.
- **Hors-scope explicite** : uploads Bunny / crons Vercel / webhooks Stripe / E2E complet → **Phase 7** ; bascule
  prod réelle → **Phase 8**. Pas de temps réel managé (YAGNI).
- **Décisions différées à la revue** : OQ1–OQ3.
