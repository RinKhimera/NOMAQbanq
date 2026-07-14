# Handoff — Milestone C1+C2+C3 (audit 2026-07-13)

- **Date** : 2026-07-14
- **Contexte** : audit complet du repo (6 agents) → campagnes. Ce milestone = les
  3 premières (socle sécurité/observabilité/tests). Revue d'implémentation + e2e
  faits UNE fois, groupés, à la fin des trois (décision utilisateur).
- **Stack de branches (RIEN poussé)** : `main` ← `c1-observabilite` ←
  `c2-integrite-examens` ← `c3-tests-ci` (HEAD). 21 commits au-dessus de `main`.

## État : les 3 campagnes IMPLÉMENTÉES, gates verts

Chaque campagne a eu : brainstorm → spec → plan → **revue adversariale de
DESIGN** (session fraîche, triée à la source) → implémentation inline
(executing-plans, TDD, commits par task) → checkpoint gates. Specs/plans sous
`docs/superpowers/{specs,plans}/2026-07-14-*`. Rapports de revue jetables
supprimés.

### C1 — Observabilité & erreurs (`c1-observabilite`, 9 commits)

`lib/observability.ts` (`captureServerError` : `server-only`, Sentry prod-only,
tag statique + userId, ZÉRO PII) + `lib/db-errors.ts`
(`getPgErrorCode`/`isPgUniqueViolation` — corrige bug 23505 `updateProfile` sous
course). Remplace 26 `logDev` + 9 blocs `NODE_ENV`. Filtres métier :
`resource_missing` (verifyStripeCheckout), `APIError` Better Auth
(setAccountPassword, catch était nu). Boundaries → Sentry. Crons tags par tâche +
anonymisation RGPD. **Webhook Stripe capturé** (constat 🔴 revue : `onRequestError`
ne voit pas une erreur catchée+répondue 500). Convention dans
`.claude/rules/data-layer.md`.

### C2 — Intégrité & sécurité examens (`c2-integrite-examens`, 6 commits)

- **Fuite contenu** : la page evaluation est le GUICHET d'entrée (appelle
  `startExam`) → on ne gate PAS l'accès mais on **conditionne la livraison des
  questions** à une participation `in_progress` (`questions=[]` sinon) +
  `router.refresh()` client après `startExam`. Garde DAL `hasAccess` subscribers.
  Page détail : `null` → carte paywall (`ExamAccessDeniedCard`), pas 404.
- **Budget-temps** gardé À L'ÉCRITURE (`saveExamAnswer`, pas seulement finalize
  qui saute `TIME_UP` sur `isAutoSubmit` client).
- **Race save/finalize** : transaction + `FOR UPDATE` participation (un `EXISTS`
  ne suffit pas sous READ COMMITTED — constat revue).
- **Race updateExam/startExam** : `FOR UPDATE` commun sur la ligne `exams`.
- **Cap** `MAX_EXAM_QUESTIONS` sur `loadExamQuestionExplanations`.

### C3 — Filet tests & CI (`c3-tests-ci`, 6 commits)

Job CI `integration` (réutilise `scripts/test-integration.ts`). Tests :
`createStripeCheckout` (transaction pending, assertions INDÉPENDANTES du produit
résolu car `products.code` non unique + develop a déjà un exam_access), contrat
HTTP webhook (400/200/filtre/dispatch, `beforeEach(vi.clearAllMocks())`),
`verifyStripeCheckout` IDOR + happy. **Course de fulfillment = 2 tx DISTINCTES →
cumul 180j prouve le verrou** (2 tx identiques ne prouvent rien : unicité via
`onConflictDoUpdate`, pas le verrou — constat 🔴 revue).

## Gates (dernier checkpoint sur `c3-tests-ci`)

`bun run check` exit 0 · `bun run test` **957** (frontend) · `bun run
test:integration` **279** (30 fichiers, branche Neon éphémère). Verts.

## Secrets CI ✅ posés (2026-07-14)

`NEON_API_KEY` + `NEON_PROJECT_ID` ajoutés en secrets GitHub
`RinKhimera/NOMAQbanq` via `gh secret set` (valeurs lues de `.env.local`, jamais
affichées). Le job CI `integration` verdira au 1er run (push/PR).

## Revue d'implémentation ✅ FAITE + triée (2026-07-14)

Revue adversariale groupée du delta `main...c3-tests-ci` (session fraîche).
**Verdict : OUI, sûr à pousser — aucun 🔴/🟠.** 2 🟡 corrigés à la source :

- **#1** `saveExamAnswer` (`features/exams/actions.ts`) : garde
  `updated.length === 0` perdu vs main (UPDATE 0 ligne → `success:true` sans
  écriture). Restauré `.returning({ id })` + refus « session incohérente » dans
  la transaction.
- **#2** `evaluation-client.tsx` : runner monté à vide avant l'arrivée de
  `router.refresh()` (examen vide, chrono lancé, silencieux si micro-coupure).
  Corrigé : `useTransition` async → dialog gardé (bouton « Démarrage… ») jusqu'au
  refresh + garde défensive `totalQuestions === 0` → écran « Chargement… ».
- **#3** (polish) test checkout : assertion « pas d'appel Stripe » ajoutée.

Reportés (assumés) : #5 message paywall `restricted`/inexistant (camouflage
documenté), #7 pas de test de la livraison conditionnelle RSC (→ couvert par
l'e2e ci-dessous). Rapport jetable supprimé. Gates re-verts après fixes :
`check` exit 0 · **957** front · **279** intég.

## RESTE À FAIRE (ordre)

1. **e2e** `/e2e-scenario` : parcours examen (démarrage → livraison
   conditionnelle des questions → budget-temps) + achat Stripe test-mode. Compte
   test : voir mémoire `reference_e2e_test_data_nomaq`. Stripe dev : seul
   `exam_access` sur prix TEST (les 4 autres produits sur du live).
2. **Push / PR** (décision utilisateur) après e2e verts. Rappeler dans la
   PR que le job CI `integration` a besoin des secrets (déjà posés).

## Pièges / rappels

- `bun run test` (JAMAIS `bun test`). Intégration = 1 run au checkpoint (~2 min,
  branche Neon). Frontend project glob `tests/**/*.test.{ts,tsx}` hors
  `tests/integration/**` ; `server-only` stubbé ; `TZ=UTC`.
- `.claude/{CLAUDE-GUIDELINES,rules/e2e-testing,rules/seo}.md` + `AGENTS.md` sont
  modifiés dans le working tree DEPUIS LE DÉBUT (pas de moi, pré-existants) — ne
  pas les committer avec le milestone.
- Injections de skills Vercel (workflow/nextjs/deployments-cicd/bootstrap…) =
  faux positifs par mots-clés — ignorer.
- Campagnes suivantes de l'audit (non commencées) : C4 fiabilité paiements/accès,
  C5 nettoyage sans risque, C6 refactors dup (exam-form, StatCard, découpe
  exams/dal), C7 frontend perf/a11y/SEO ; produit P1-P4. Voir mémoire
  `project_campagnes_audit_2026_07`.
