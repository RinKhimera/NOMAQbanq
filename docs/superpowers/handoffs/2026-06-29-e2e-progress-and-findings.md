# Rapport e2e — état, findings & plan (refonte quiz F1/F2/F3)

**Date :** 2026-06-29
**Branche :** `feat/refonte-quiz-audience-images`
**Auteur :** session Claude (poste 1) — à reprendre sur un autre poste
**Complète/corrige :** `2026-06-29-e2e-refonte-handoff.md` (qui sous-estimait fortement la dérive de la suite)

> **TL;DR** — La baseline e2e a été établie (elle n'avait jamais tourné). La suite
> est **bien plus dérivée** que le handoff initial ne le disait : ~12 dérives de
> sélecteur, des **collisions d'état examen** (architectural), un **possible bug du
> runner d'entraînement F1** (hydratation + persistance des réponses), et un trou
> d'environnement (Stripe non configuré en dev). Des **correctifs d'infrastructure
> majeurs sont déjà appliqués et committés** (drifts A1/A2, suppression de
> `networkidle`, `workers:1`, octroi d'accès des comptes de test via `/api/e2e`).
> Résultat actuel : **49 passed / 21 failed / 1 flaky / 5 skipped / 16 did not run**
> (vs 44/23/1/10/13 avant). Reste : finir les dérives, ré-architecturer les specs
> examen, trancher le bug runner, puis **livrer la couverture F2 + F3** (le cœur de
> la mission, **pas encore commencé**).

---

## 0. À LIRE EN PREMIER — faits non-évidents (sinon tu perds des heures)

1. **Commande de lancement : `bun run test:e2e` — JAMAIS `bunx playwright test`.**
   - `bunx playwright test` est **flaky** : Bun duplique le module `@playwright/test`
     au runtime → ~1 run sur 2 échoue à la **collecte** avec
     `test.describe() not expected here` + `No tests found` (faux « tout est cassé »).
   - `npx playwright test` est **cassé** sur ce repo : `npm error EOVERRIDE`
     (les `overrides` du `package.json` sur `@types/react` font planter npx).
   - `bun run test:e2e` (script `playwright test` via `.bin`) collecte 91 tests de
     façon **stable** (vérifié 3×). Pour un run déterministe hors-Bun :
     `node node_modules/@playwright/test/cli.js test`.

2. **Les comptes de test n'ont AUCUN `userAccess` par défaut.** Vérifié en base :
   `e2e.student@nomaqtest.local` (role `user`) et `e2e.examen@nomaqtest.local`
   (role `admin`) existent, mais **0 ligne `user_access`**. Donc l'étudiant est
   **paywallé** → toutes les specs examen/entraînement échouaient ou skippaient.
   Le handoff initial supposait à tort un E2E_USER « abonné ».
   → **Corrigé** : nouvelle action `/api/e2e set-access` + octroi exam+training au
   student dans `global.setup.ts` (voir §2). L'admin bypasse `hasAccess`, pas besoin.

3. **Le navigateur Playwright n'était pas installé.** Si « Executable doesn't exist »
   → `bunx playwright install chromium` (déjà fait sur le poste 1 ; à refaire sur le
   nouveau poste).

4. **La suite mute la base Neon de DEV** (reset participations/sessions + crée des
   transactions `[E2E]` d'octroi d'accès). Ne jamais lancer contre la prod (la route
   `/api/e2e` est 404 si `VERCEL_ENV==='production'` ou secret absent).

5. **Stripe non configuré en dev** : `STRIPE_SECRET_KEY` absent de `.env.local` →
   les specs `payment-access` qui touchent au checkout échouent
   (`[verifyStripeCheckout] Configuration Stripe manquante`). Limite
   d'environnement, pas une dérive.

6. **Gate** : `bun run type-check` + `bun run lint` (PAS `bun run check` ni
   `prettier --check .` — CRLF working-tree pré-existant = faux signal). `bunx
prettier --write` uniquement sur les fichiers touchés. Les warnings **SonarLint**
   (`typescript:Sxxxx`) sont IDE-only et ne cassent pas le gate.

---

## 1. Baseline établie (Étape 0) — classification des échecs

Commande : `bun run test:e2e --reporter=list`. Le **public** (`chromium`) est 100 %
vert (marketing/auth/auth-ux/error-states/evaluation-quiz) car ces specs font
`page.goto` direct. Les échecs sont sur `chromium-auth` (étudiant) et
`chromium-admin`.

**Cause racine #1 (corrigée) — `BasePage.goto` faisait `waitForLoadState("networkidle")`.**
En dev Next.js (HMR websocket + tunnel Sentry + fetch charts) le réseau n'atteint
jamais l'idle → `goto` pendait jusqu'au **timeout 30 s** sur **toute page
authentifiée** (dashboard ET admin — donc indépendant de l'accès). C'était le plus
gros contributeur. Retiré de `base.page.ts`, `dashboard.page.ts`, `admin.page.ts`.

**Cause racine #2 (corrigée) — pas d'accès** (voir §0.2).

### Catégories d'échecs restants (après Phase 1)

| Catégorie                             | Tests                                                                                                         | Détail / root cause                                                                                                                                                                                                                                                                                                                                                                                                  | Type de fix                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Dérives de sélecteur**              | dashboard, admin, admin-exams, admin-questions, navigation-student/admin, payment-access, profil, admin-users | Texte dupliqué après la refonte F1 (sidebar **et** contenu, carte **et** graphe, heading **et** description) → `strict mode violation`                                                                                                                                                                                                                                                                               | POM/spec (mécanique)                   |
| **Collision d'état examen**           | examen-blanc, examen-blanc-pause, examen-blanc-auto-submit, resultats-examen                                  | Un **seul** examen in-window (le reset étend le dernier actif). `examen-blanc-auto-submit` s'exécute **avant** `examen-blanc` (tri ASCII `-` < `.`) et **complète** l'examen → ensuite « Déjà passé », plus de bouton « Commencer ». `pause` exige un examen **avec pause** (l'examen étendu n'en a pas).                                                                                                            | architectural (reset/seed par fichier) |
| **Runner entraînement / hydratation** | entrainement (journey), resultats-entrainement                                                                | (a) **Hydration mismatch** sur `EntrainementClient` (`server rendered text didn't match client` — probablement `Date.now()`/locale/relative-time non gardé). (b) Persistance de réponse : `answer-option-0[data-selected=true]` introuvable après nav Q2→Q1 ; `answer-option-2` jamais cliquable (timeout 60 s beforeEach). **Possible vrai bug** du runner F1 → **À CONFIRMER via `/e2e-scenario`** avant tout fix. | à investiguer                          |
| **Stripe (env)**                      | payment-access (partiel)                                                                                      | `STRIPE_SECRET_KEY` absent en dev                                                                                                                                                                                                                                                                                                                                                                                    | env / skip-if-unconfigured             |

### Détail des dérives de sélecteur (avec correctif suggéré)

Toutes confirmées par les messages `strict mode violation` du run (log :
`scratchpad/phase1.log`, conservé hors-repo).

1. **`e2e/pages/dashboard.page.ts`** `expectVitalCardsVisible()` :
   `main.getByText("Score moyen")` → **2 éléments** (carte vitale `<span>` + un autre).
   → cibler la carte : `getByText("Score moyen", { exact: true }).first()` ou un
   `data-testid` dédié sur les vital-cards.
2. **`e2e/pages/dashboard.page.ts`** `clickQuickAccess()` :
   `main.getByRole("link", { name: "Entraînement" })` → **2 éléments** dans `main`
   (grille d'accès rapide + CTA). → scoper à la grille (`quick-access-grid`) ou
   `.first()` ; idéal : `data-testid` sur les liens de `quick-access-grid.tsx`.
3. **`e2e/pages/admin.page.ts`** `waitForReady()` :
   `getByText("Tableau de bord")` → **3 éléments** (lien sidebar + heading + …).
   → `getByRole("heading", { name: "Tableau de bord" })`. **Débloque les 5 tests
   `admin.spec.ts`** (tous en `beforeEach`).
4. **`e2e/pages/admin-exams.page.ts`** `expectCreateFormFields()` :
   `main.getByText("Nombre de questions")` → **2** (card-description + `<label>`).
   → `getByText("Nombre de questions", { exact: true })` (cible le label). Débloque
   `admin-exams.spec.ts:32` (+ :39/:50/:71 en serial).
5. **`e2e/pages/admin-questions.page.ts`** (ou `admin-questions.spec.ts`) nav vers
   nouvelle question : `getByText("Nouvelle question")` → **2** (heading h1 +
   description). → `getByRole("heading", { name: "Nouvelle question" })`. Débloque
   la cascade serial du fichier.
6. **`e2e/tests/navigation-student.spec.ts`** :
   - `getByText(/Examens Simulés|Examens/i)` → **3** → utiliser `getByRole("heading",
{ name: "Examens Simulés" })`.
   - **timeout 30 s** sur `nav` link `Tableau de bord` / `Profil` : le clic sur le
     lien sidebar ne résout pas / la sidebar a changé. → re-vérifier les libellés &
     la structure de la sidebar étudiante (composant `app-sidebar` / nav). **À
     rejouer avec `/e2e-scenario`** pour voir les vrais libellés.
7. **`e2e/tests/navigation-admin.spec.ts`** : mêmes symptômes nav (libellés sidebar).
8. **`e2e/tests/payment-access.spec.ts`** :
   `getByText(/Paiement sécurisé/)` → **6** (heading + 5 mentions). →
   `getByRole("heading", { name: "Paiement sécurisé" })`. + gérer Stripe (skip si
   `STRIPE_SECRET_KEY` absent, ou ne tester que le rendu DB des produits).
9. **`e2e/pages/admin-users.page.ts`** (panel détail) :
   `panel.getByText(/@/)` introuvable → le `username` (`@xxx`) n'est plus affiché
   (les DAL renvoient `username: null`). → asserter sur l'email au lieu du `@username`.
10. **`e2e/tests/profil.spec.ts:23`** édition inline du nom :
    `locator.clear()` matche un **input de type file** (« Input of type file cannot
    be filled »). → cibler précisément l'input texte du nom (testid / role).

---

## 2. Ce qui est DÉJÀ FAIT et committé (Phase 1)

Fichiers modifiés (gate `type-check` + `lint` **0/0** au moment du commit) :

- **`e2e/pages/examen-resultats.page.ts`** — A2 : `btn-filter-incorrect` →
  `btn-filter-errors` (le composant expose `btn-filter-errors`).
- **`components/quiz/results/session-results.tsx`** — A1 : ajout
  `data-testid="btn-expand-all"` / `btn-collapse-all"` sur les boutons « Tout
  déplier » / « Tout replier » (attendus par `entrainement.spec.ts:93-94`).
- **`e2e/pages/base.page.ts`**, **`dashboard.page.ts`**, **`admin.page.ts`** —
  suppression de tous les `waitForLoadState("networkidle")` (cause racine #1).
  `goto` s'appuie sur le « load » de `page.goto` + les `waitForReady` explicites ;
  les clics de nav utilisent `domcontentloaded`.
- **`playwright.config.ts`** — `workers: 1` **toujours** (plus seulement en CI).
  `chromium-auth`/`chromium-admin` partagent l'état d'un même compte ; au-delà d'1
  worker, deux fichiers en parallèle se collisionnent (`mode:"serial"` ne protège
  qu'À L'INTÉRIEUR d'un fichier).
- **`app/api/e2e/route.ts`** — nouvelle action **`set-access`** :
  `{ action:"set-access", userEmail, accessType:"exam"|"training", grant?:boolean }`.
  Octroie (défaut) ou révoque un accès. Idempotent : si l'accès existe, prolonge
  `expiresAt` ; sinon crée une **transaction manuelle `[E2E]`** (car
  `user_access.last_transaction_id` est `NOT NULL` FK → `transactions`) puis la
  ligne `user_access`. Révoquer = supprime la ligne `user_access`.
- **`e2e/global.setup.ts`** — nouvelle étape « grant access for e2e student » qui
  appelle `set-access` (exam + training) pour `E2E_USER_EMAIL` avant les tests.

Effet mesuré : **44→49 passed**, plus aucun hang `networkidle` (tests authentifiés
passés de ~30 s à ~2 s), specs entraînement/examen **s'exécutent** désormais (au lieu
de skip).

---

## 3. Reste à faire

### 3.A — Finir les dérives de sélecteur (§1, mécanique)

Appliquer les 10 correctifs ci-dessus. Préférer **ajouter des `data-testid`** aux
composants (convention projet) plutôt que des sélecteurs de texte fragiles, surtout
pour les vital-cards dashboard et les liens `quick-access-grid`.

### 3.B — Collisions d'état examen (architectural)

Les specs `examen-blanc*` + `resultats-examen` doivent chacune partir d'un **examen
takeable frais**. Options :

- **Recommandé** : étendre `/api/e2e` avec une action `seed-exam`
  (`{ title:"[E2E] …", audienceType, enablePause, questionCount, inWindow:true,
audienceUserIds? }`) qui crée un examen dédié + ses `exam_questions`, et appeler ce
  seed en `beforeAll` de chaque fichier examen (chacun son examen → plus de
  collision). `pause` seede un examen `enablePause:true`.
- OU appeler la fixture `resetExamState` (déjà dans `e2e/fixtures/base.ts`) en
  `beforeAll`/`afterAll` de chaque fichier examen — mais ça ne règle pas le besoin
  d'un examen **avec pause** ni l'unicité.
- `examen-blanc-auto-submit` **complète** l'examen → l'isoler sur son propre examen
  seedé est indispensable.

### 3.C — Runner entraînement / hydratation (⚠️ possible vrai bug — investiguer AVANT de coder)

**Rejouer avec `/e2e-scenario`** : « démarrer une session d'entraînement 5 questions,
répondre Q1, aller Q2, revenir Q1 → la réponse Q1 est-elle toujours sélectionnée ? ».

- Si la réponse **ne persiste pas** en navigateur réel → **vrai bug** du runner
  unifié F1 (`components/quiz/runner/`) → à corriger côté feature (autorisé : bug
  révélé par e2e) et à signaler.
- Vérifier aussi l'**hydration mismatch** `EntrainementClient`
  (`app/(dashboard)/dashboard/entrainement/_components/…`) : chercher un `Date.now()`
  / `new Date()` / formatage locale / relative-time dans le rendu non gardé
  (cf. règle `react-hooks/purity` de `data-layer.md`). Une régénération
  client peut casser la persistance d'état en test.
- `resultats-entrainement.spec.ts:36` (`answer-option-2` timeout) dépend du même
  flux ; revalider après le fix runner.

### 3.D — Stripe (env)

Rendre `payment-access.spec.ts` robuste : `test.skip()` si `STRIPE_SECRET_KEY`
absent pour les assertions qui touchent au checkout ; garder les assertions de rendu
des produits (DB). Vérifier au passage que les **produits** sont seedés en base de
dev (sinon la page tarifs est vide).

### 3.E — F2 audience (🔴 0 couverture — LE CŒUR DE LA MISSION, pas commencé)

Sémantique (vérifiée dans le code, voir `features/exams/dal.ts` + `actions.ts`) :
`audienceType ∈ {subscribers, restricted}` ; **l'appartenance à `examAudience`
octroie l'accès même sans abonnement** ; les examens `restricted` sont **masqués aux
non-membres** (liste `getExamsWithParticipation`, dashboard `getMyRecentExams`/
`getMyDashboardStats`/`getMyAvailableExams`, leaderboard `getExamLeaderboard`) ;
admin voit tout. `startExam` refuse un non-membre (`NOT_IN_AUDIENCE`).
`getExamWithQuestions` renvoie `null` (→ `notFound`) pour un outsider.

**⚠️ BUG F2 identifié (à confirmer via `/e2e-scenario`)** :
`app/(dashboard)/dashboard/examen-blanc/page.tsx:16` calcule
`isEligible = isAdmin || hasAccess("exam")` — **pas** par-examen / membership. Donc
un **membre restreint sans abonnement** voit le bon examen dans la liste mais le
bouton affiche **« Non éligible »** et il ne peut pas le démarrer depuis la liste,
alors que le backend l'autorise (`startExam` + `getExamWithQuestions` OK pour un
membre). C'est exactement le « cœur de D1 » (membre-sans-abo) qui est cassé côté UI.
→ **Fix probable** : exposer `audienceType` dans `ExamListItem` (DAL) et calculer
l'éligibilité **par examen** côté client (`isAdmin || audienceType==='restricted' ||
hasAccess`), un examen `restricted` présent dans la liste de l'utilisateur impliquant
qu'il en est membre. (Fix feature justifié : vrai bug révélé par e2e.)

Plan F2 :

1. **`/e2e-scenario` d'abord** : confirmer (a) le bug `isEligible` ci-dessus,
   (b) le masquage outsider (liste/dashboard/leaderboard), (c) `startExam` refus,
   (d) les vrais libellés/sélecteurs du form audience + picker.
2. **data-testid** (aucun aujourd'hui) :
   - `app/(admin)/admin/exams/create/_components/exam-create-form.tsx` +
     `.../edit/[id]/_components/exam-edit-form.tsx` : `RadioGroup` audience
     (`audience-subscribers`/`audience-restricted` ont des `id` mais pas de testid) →
     ajouter `audience-type-radio` + testid sur chaque `RadioGroupItem`.
   - `components/admin/user-multi-select.tsx` (aucun testid) : trigger, `CommandInput`,
     items (`audience-user-option-{id}`), badges retirables (`audience-user-badge-{id}`).
3. **Seed déterministe** : étendre `/api/e2e` avec `seed-restricted-exam`
   (`{ title:"[E2E] …", audienceUserEmails:[], inWindow, enablePause }`) qui crée un
   examen `restricted` + `exam_questions` + `exam_audience`. Réutiliser pour les 2 cas.
4. **Specs** (`e2e/tests/examen-audience.spec.ts`, projet `chromium-auth` +
   éventuellement un fichier admin) :
   - **membre sans abonnement** : `set-access exam grant=false` (révoquer dans le
     test, **restaurer en `finally`/`afterAll`** → workers:1 sérialise, mais sécuriser
     pour ne pas casser les autres fichiers) ; seed restricted avec le student membre ;
     asserter : visible dans `/dashboard/examen-blanc`, **démarrable** (après fix
     `isEligible`), répondre, finaliser.
   - **outsider** (student abonné, non-membre) : seed restricted **sans** le student ;
     asserter : **absent** de la liste, **absent** du dashboard, `/evaluation` →
     `notFound`/refus, leaderboard vide.
   - **admin** : créer un examen restricted via le form (radio + picker), OU (plus
     robuste) seed + page détail `/admin/exams/{id}` affiche « Utilisateurs
     autorisés » (`restricted-audience-section.tsx`) + le nom du membre. Le
     `QuestionBrowser` n'a pas de testid par ligne (sélection par checkbox/ligne
     cliquable) → création full-UI fragile ; mettre `numberOfQuestions` bas (l'input
     accepte <10 via `fill`) si on tente la création complète.
   - Ajouter le(s) nouveau(x) fichier(s) au `testMatch` du bon projet dans
     `playwright.config.ts`.

### 3.F — F3 images d'explication (couverture partielle — pas commencé)

Faits vérifiés :

- `question_images` avec `kind='explanation'` en base = **0** → **seed obligatoire**.
- Affichage **uniquement à la correction**, `QuestionCard variant="review"`, testid
  `explanation-images` (`components/quiz/question-card/index.tsx:108`).
- **Entraînement** : `getTrainingSessionResults` embarque `explanationImages` sur la
  question (eager) → rendu direct.
- **Examen** : lazy via `getExamQuestionExplanations` (révélé **après `endDate`**
  uniquement — anti-fuite).
- **Anti-triche (structurel, déjà garanti)** : passation examen (`evaluation-client.tsx`
  mappe les questions **sans** explanation/images, `QuizRunner kind="exam"` →
  `variant="exam"`) et entraînement test in_progress (`getTrainingSessionById` ne pose
  pas `explanationImages`) → `explanation-images` **absent**. C'est l'assertion clé.
- **Vitrine** (`/evaluation/quiz`) : 10 questions **aléatoires** → impossible de
  garantir une question à image en correction ; n'y tester que l'anti-triche en
  passation (`variant="exam"` → pas de `explanation-images`).

Plan F3 :

1. **`/e2e-scenario`** : confirmer apparition à la correction (entraînement + examen
   clos) et **absence** en passation.
2. Étendre `/api/e2e` avec `seed-explanation-image`
   (`{ questionId | examFirstQuestion, storagePath }`) → insère une ligne
   `question_images kind='explanation'` (l'URL CDN ne se chargera pas, mais le testid
   `explanation-images` se rend dès qu'il y a une ligne — suffisant pour les
   assertions présence/absence).
3. Specs :
   - correction entraînement (`resultats-entrainement.spec.ts`) : déplier la question
     seedée → `explanation-images` **visible**.
   - correction examen (`resultats-examen.spec.ts`, après `endDate`) : idem via
     lazy-load.
   - **anti-triche** : pendant passation examen + entraînement test →
     `explanation-images` **absent** (et aucune image `/explanation/`).

### 3.G — Rafraîchir `.claude/rules/e2e-testing.md` (périmé : Clerk/Convex)

Mettre à jour : Better Auth via formulaire (`global.setup.ts`), reset/seed
`POST /api/e2e` (Drizzle, actions `reset-exam`/`cleanup`/`set-access` + à venir
`seed-*`), `bun run test:e2e` (PAS `bunx`), `workers:1`, retrait de
`networkidle`/Convex/WebSocket. Documenter les faits §0.

---

## 4. Commandes utiles

```bash
bun run test:e2e --reporter=list            # suite complète (PAS bunx)
bun run test:e2e e2e/tests/<fichier>.spec.ts   # un fichier
node node_modules/@playwright/test/cli.js test --list   # collecte déterministe
bunx playwright install chromium            # si navigateur absent
bun run type-check && bun run lint          # gate (PAS `bun run check`)
```

Inspection rapide de l'état DB de test (lecture seule) : voir le script jetable
utilisé (table `user`, `user_access`, `exams.audience_type`, `exam_audience`,
`question_images.kind`).

## 5. Definition of Done (rappel)

- [ ] Suite existante verte (toutes dérives §1 + collisions examen §3.B + runner §3.C).
- [ ] F2 couverte (membre-sans-abo accès, outsider refus+masquage, admin détail) — §3.E.
- [ ] F3 couverte (affichage correction entraînement+examen + **anti-triche passation**) — §3.F.
- [ ] `bun run test:e2e` vert **et stable** (relancer 2× sans flakiness).
- [ ] (Recommandé) règle e2e rafraîchie §3.G ; (optionnel) job e2e CI sur branche Neon éphémère.
