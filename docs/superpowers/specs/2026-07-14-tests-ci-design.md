# Spec — Filet de tests & CI (campagne C3)

- **Date** : 2026-07-14
- **Statut** : IMPLÉMENTÉ le 2026-07-14 (branche `c3-tests-ci` sur
  `c2-integrite-examens`) — revue adversariale design passée (#1/#2/#3 corrigés) ;
  gates verts (check + 957 front + 279 intégration). ⚠️ Job CI `integration`
  rouge tant que les secrets `NEON_API_KEY`/`NEON_PROJECT_ID` ne sont pas posés.
- **Branche** : `c3-tests-ci` sur `c2-integrite-examens` (milestone commun
  C1+C2+C3, revus ensemble).
- **Origine** : audit du 2026-07-13 — agent tests (#1 intégration jamais en CI,
  #2 `payments/actions.ts` zéro test, #3 contrat HTTP webhook, #4 course
  fulfillment).

## Problème

Le cœur métier (fulfillment Stripe, verrous, crons, anti-triche) est bien testé
en intégration — **mais ces tests ne tournent jamais en CI**. La CI
(`.github/workflows/ci.yml`) n'exécute que `test:coverage` (projet `frontend`) ;
`tests/integration/**` ne s'exécute que si quelqu'un lance `bun run
test:integration` en local. Une régression dans `features/**` (9 300 lignes)
merge avec une CI verte. Corollaires vérifiés à la source :

- `features/payments/actions.ts` : **zéro test** des Server Actions. `payments-
stripe.test.ts` teste `completeStripeTransaction`/`failStripeTransaction`
  (lib `stripe.ts`) ; `payments-manual.test.ts` teste `grantManualAccess`/
  `revokeAccessIfLast` (lib `lib.ts`). Les ACTIONS — `createStripeCheckout`
  (création de la transaction _pending_ : si mal créée, le webhook répond
  `not_found` → **l'utilisateur paie sans accès**), `verifyStripeCheckout`
  (anti-IDOR), les 3 actions manuelles — ne sont pas couvertes (seul le catch
  `resource_missing` de `verifyStripeCheckout` l'est, via C1).
- Route webhook (`app/api/stripe/webhook/route.ts`) : C1 teste le catch de
  traitement (→ 500). Le reste du contrat HTTP n'est pas testé : signature
  absente/invalide → 400, `not_found` → 200, filtre `payment_status`, dispatch
  `checkout.session.expired`.
- Course de fulfillment : `payments-stripe.test.ts` teste l'idempotence en
  **séquentiel** ; le verrou `FOR UPDATE` (garantie centrale contre le double
  crédit) n'est jamais exercé en parallèle.

## Design

### 1. Job CI `integration` (le constat #1)

L'infra existe : `scripts/test-integration.ts` provisionne une branche Neon
jetable (`test-*` depuis `develop`), migre, lance vitest (projet `integration`),
détruit la branche (housekeeping des orphelines > 1 h). `tests/helpers/test-env.ts`
fournit l'env applicatif factice ; l'orchestrateur pose `DATABASE_URL`.

Ajouter à `ci.yml` un **job séparé** `integration` (parallèle au job `quality`),
sur `pull_request` et `push:main` (comme `quality`), qui : setup Bun → install →
`bun run test:integration`. Le seul secret nécessaire côté job = \*\*`NEON_API_KEY`

- `NEON_PROJECT_ID`\*\* (création/suppression de branche). Rien d'autre (migrate et
  tests tirent l'URL de l'orchestrateur ; le reste de l'env vient de `test-env`).

* **⚠️ Prérequis manuel (utilisateur, hors code)** : ajouter `NEON_API_KEY` et
  `NEON_PROJECT_ID` dans les **secrets GitHub** du repo (Settings → Secrets and
  variables → Actions). Sans eux, le job échoue. Documenté dans le plan.
* **Concurrence** : le groupe `concurrency` existant (`workflow-ref`,
  `cancel-in-progress`) annule les runs obsolètes ; deux PR parallèles créent
  deux branches Neon distinctes (préfixe unique) — pas de collision. Le cleanup
  des orphelines > 1 h couvre un run annulé en plein vol.

### 2. `createStripeCheckout` — entrée du chemin d'argent (intégration)

Test intégration (vraie DB, `getStripe` mocké) : vérifie que la transaction
_pending_ est créée avec le bon `userId`, `status='pending'`, `type='stripe'`,
`stripeSessionId` = la session Stripe, et que Stripe reçoit `metadata.userId`
(l'invariant qui permet au webhook de la retrouver). ⚠️ **Assertions
indépendantes du produit résolu** (revue #2) : `products.code` n'est pas unique
et la branche `develop` (parent des branches de test) contient déjà un produit
`exam_access` ; `createStripeCheckout` résout par `code` `ORDER BY id ASC LIMIT
1` (`actions.ts:325-338`) → le `productId`/montant retenu est non déterministe.
Ne PAS asserter `productId`/`amountPaid` en dur ; asserter les invariants
robustes (pending, type, userId, stripeSessionId, metadata.userId). + garde
produit invalide. Fichier : `tests/integration/payments-checkout.test.ts`.

### 3. Contrat HTTP du webhook (unit, étend le fichier C1)

Étendre `tests/features/stripe-webhook-errors.test.ts` : signature absente →
**400**, signature invalide (`constructEventAsync` throw) → **400**, `not_found`
→ **200** + `captureServerError`, filtre `payment_status` (`paid` +
`no_payment_required` → `completeStripeTransaction` appelé ; autre → non appelé),
dispatch `checkout.session.expired` → `failStripeTransaction`. Objectif : le
contrat « 500 → retry, 200 → acquitté » ne peut plus régresser silencieusement
(un 200 sur erreur transitoire = fulfillment perdu définitivement).

### 4. Course de fulfillment (intégration, étend payments-stripe)

⚠️ **Test discriminant** (revue #1) : deux fulfillments IDENTIQUES ne prouvent
rien — l'unicité de la ligne `userAccess` vient de `onConflictDoUpdate` sur
`(userId, accessType)` (`stripe.ts:182`) + la contrainte unique, PAS du verrou.
Le verrou `FOR UPDATE` sur la ligne `user` (`stripe.ts:78`) protège le **cumul**
d'expiration (non-combo : `txAccessExpiresAt = base + durée`, `base` = accès
existant lu sous verrou, `:111-116`). Le bon test : **deux transactions
DISTINCTES** (events/sessions différents), même user non-combo, 90 j chacune,
`Promise.all` → l'expiration finale doit être `now + 180 j`. Sans le verrou, les
deux lisent `base = now` → `now + 90` (perte d'une durée). L'assertion
`approxDays(expiry, 180)` tombe à 90 si le verrou saute — idiome discriminant de
`training-concurrency.test.ts`.

- idempotence `stripeEventId` exercés en parallèle). Vérifier `userAccess`
  crédité une seule fois.

### 5. `verifyStripeCheckout` — anti-IDOR + happy path (complément C1)

Étendre `tests/features/payments-actions-errors.test.ts` (déjà les mocks) :
`metadata.userId ≠ session.user.id` → `{ success: false }` (anti-IDOR, sans
capture) ; happy path (`metadata.userId === session`) → `{ success: true, … }`.

## Hors scope (YAGNI / différé)

- **Reset mot de passe** : parcours e2e reporté (capture d'email/token Better
  Auth = campagne dédiée après le milestone).
- `coverage.include` des `features/**/lib` purs : faible valeur, risque de tirer
  des modules server-only non happy-dom → différé.
- Nettoyage des `waitForTimeout` e2e : polish, hors filet.
- Tests des 3 actions manuelles (`recordManualPayment`…) : leurs libs sont
  testées ; les gardes/zod pourront être couverts plus tard — non bloquant pour
  le chemin d'argent principal (checkout Stripe public).

## Tests / gates

- Nouveaux tests webhook + verifyStripeCheckout = **frontend** (rapides, mocks).
- Nouveaux tests checkout + course = **intégration** (un run Neon au checkpoint).
- `bun run check` + `bun run test` + `bun run test:integration` verts ; le
  nouveau job CI vert **après** ajout des secrets (sinon rouge attendu, documenté).

## Critères de succès

1. Un job CI dédié exécute `tests/integration/**` sur chaque PR et push `main`.
2. `createStripeCheckout` a un test qui prouve la création correcte de la
   transaction _pending_ (couple pending↔webhook).
3. Le contrat HTTP du webhook (400/200/500, filtre, dispatch) est verrouillé par
   des tests.
4. Le double crédit concurrent est prouvé impossible (verrou exercé en parallèle).
5. `verifyStripeCheckout` : IDOR refusé, happy path couvert.
6. Gates verts (le job CI intégration devient vert une fois les secrets posés).
