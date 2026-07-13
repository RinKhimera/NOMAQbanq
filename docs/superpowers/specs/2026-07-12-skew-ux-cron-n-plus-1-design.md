# Spec — Suivi robustesse réseau : UX deploy-skew (#98) + N+1 cron close-expired (#99)

**Date** : 2026-07-12
**Statut** : validé (brainstorming) ; revue adversariale de design du
2026-07-12 triée — verdict initial NON, 1 défaut de fond intégré (la parité
d'arrondi `Math.round` ↔ `round()` SQL était fausse : le half-up **exact**
devient la référence, les actions JS s'alignent via `lib/score.ts`) + 3
correctifs de forme (gates e2e `type-check`+`lint`, note sur les mocks
partiels de `next/navigation`, 19 call sites et non ~27)
**Origine** : issues de suivi de la campagne « robustesse réseau des Server
Actions » (PR #97, spec `2026-07-12-robustesse-reseau-server-actions-design.md`)
— GitHub #98 (Sentry NOMAQBANQ-1B) et #99 (Sentry NOMAQBANQ-17)

Deux chantiers indépendants, un seul document (deux parties), une seule branche
d'implémentation depuis `main` à jour.

---

## Partie 1 — #98 : UX dédiée au deploy-skew (`UnrecognizedActionError`)

### Contexte

Le soir du déploiement de #97 : 239 événements Sentry (NOMAQBANQ-1B) sur
3 étudiants, onglet d'examen ouvert pendant le déploiement. Leur bundle périmé
POSTait des IDs de Server Action inconnus du nouveau serveur → Next répond avec
l'en-tête `x-nextjs-action-not-found: 1` et le client lève
`UnrecognizedActionError: Server Action "…" was not found on the server.`
(`fetchServerAction`, vérifié dans l'événement Sentry réel et les sources
`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js`).

Ces 239 événements étaient des **unhandled rejections** : les onglets périmés
tournaient le bundle _pré-#97_, sans `callAction`. Au prochain déploiement, les
bundles actuels attraperont l'erreur mais afficheront le message réseau
générique (« Connexion perdue… ») en retentant inutilement — trompeur : seul un
rechargement de page répare (les nouveaux IDs d'action arrivent avec le nouveau
bundle). Le rechargement est sûr même en passation : l'état vit côté serveur,
la reprise est automatique.

**Constat d'audit décisif** : sur le hot path exact du bug
(`evaluation-client.tsx`), `onAnswer` toaste un message **hardcodé**
(« Réponse non enregistrée, réessayez. ») sans afficher `res.error`, et
`onFlag` est silencieux. Un message dédié renvoyé par le seul canal
`{ success: false, error }` n'atteindrait donc jamais l'étudiant dans le
scénario principal. → Le remède doit être **central**.

### Décision (option validée : toast central + bouton « Recharger »)

Tout vit dans `lib/safe-action.ts` — zéro churn aux 19 call sites :

1. **Détection** : `unstable_isUnrecognizedActionError(err)` importé de
   `next/navigation` (API officielle Next 16, test `instanceof` contre la
   classe de Next — insensible à la minification ; export vérifié dans la
   version installée). Pas de matching de message.
2. **Placement** : dans le `catch` de `callAction`, **avant** la logique retry
   → retour immédiat, jamais de retentative même avec `retries` (inutile par
   construction).
3. **Message** (exporté pour tests et call sites éventuels) :

   ```ts
   export const DEPLOY_SKEW_MESSAGE =
     "Une nouvelle version de l'application est disponible. Rechargez la page pour continuer."
   ```

4. **Toast central** : au moment de la détection, `callAction` déclenche
   lui-même :

   ```ts
   toast.error(DEPLOY_SKEW_MESSAGE, {
     id: "deploy-skew", // dédupliqué : une rafale d'échecs quiz ne stacke pas
     duration: Infinity, // le rechargement est le seul remède
     action: { label: "Recharger", onClick: () => window.location.reload() },
   })
   ```

   puis renvoie `{ success: false, error: DEPLOY_SKEW_MESSAGE }`. Le `Toaster`
   sonner est déjà monté au layout racine. `sonner` est client-safe, comme
   `next/navigation` — le module reste sans import serveur.

5. **Règle documentée** : exception explicite à « les toasts vivent dans les
   pages » (`.claude/rules/data-layer.md`, section Écrans) — le deploy-skew est
   un événement d'infrastructure app-level, pas une erreur métier ; le toast
   métier de la page peut s'afficher en plus (bruit accepté : le toast central
   porte le remède et persiste). Y documenter aussi le piège tests (revue
   design) : un `vi.mock("next/navigation", …)` **partiel** dans un test qui
   fait rejeter une action via `callAction` doit fournir
   `unstable_isUnrecognizedActionError` (ou passer par `importOriginal`) — 9
   fichiers de tests mockent déjà ce module partiellement sans casser
   aujourd'hui, mais le premier futur test de rejet frapperait le proxy Vitest
   avec une erreur cryptique.

### Écarté

- **Message dédié seul** (canal de retour) : n'atteint pas l'utilisateur sur le
  hot path (cf. constat d'audit) sans retoucher les sites un à un.
- **Reload auto hors passation** : détection de contexte fragile, risque de
  boucle de rechargement. YAGNI.

### Tests

- **Unit `tests/lib/safe-action.test.ts`** (compléments) : `vi.mock`
  de `next/navigation` (prédicat contrôlé) et de `sonner`.
  - rejet skew → `{ success: false, error: DEPLOY_SKEW_MESSAGE }` ;
  - `fn` appelé **une seule fois** malgré `retries: 2` ;
  - `toast.error` appelé avec `id: "deploy-skew"` et une action « Recharger » ;
  - rejet réseau ordinaire → comportement actuel inchangé
    (`NETWORK_ERROR_MESSAGE`, retries honorés, pas de toast central).
- **E2E `e2e/tests/examen-blanc-deploy-skew.spec.ts`** (projet
  `chromium-auth`, à ajouter au `testMatch` ; seed via `seed-exam`, préfixe
  dédié, cleanup en `afterAll`) : seul test qui exerce le **contrat Next
  réel** (l'unit mocke le prédicat). Passation → interception des POST
  d'action (`context.route` sur les POST `/evaluation`, comme
  `examen-blanc-offline.spec.ts`) mais en **`route.fulfill({ status: 404,
headers: { "x-nextjs-action-not-found": "1" } })`** (le client Next teste
  l'en-tête, pas le statut) → clic réponse → assertions :
  - toast « Une nouvelle version… » visible avec bouton « Recharger » ;
  - **un seul POST intercepté** (compteur dans le handler — prouve l'absence de
    retry malgré `retries: 1` sur `saveExamAnswer`) ;
  - rollback : l'option cliquée n'est pas `data-selected` (la réponse
    précédemment persistée l'est) ;
  - `unroute` → re-clic → persistance normale.

### Risques / limites

- `unstable_` : l'API peut être renommée à un upgrade Next — cassure **à la
  compilation** (import introuvable), jamais silencieuse. L'e2e couvre en plus
  le contrat en-tête→erreur→prédicat de bout en bout.
- Double toast possible (métier + central) sur certains écrans : assumé.
- Cliquer « Recharger » en passation recharge vers la reprise automatique
  (état serveur) — comportement déjà couvert par le flux `resuming` existant.

---

## Partie 2 — #99 : N+1 (`pg-pool.connect`) dans le cron close-expired

### Contexte et constat d'audit

Sentry NOMAQBANQ-17 (« N+1 Query », `pg-pool.connect`, culprit
`GET /api/cron/close-expired`, 15 occurrences du 7 au 12 juillet). **Les
15 traces sont des runs à zéro ligne traitée** : le span répété est
`pg-pool.connect`, car le `Promise.all` de 4 tâches sur un pool froid (instance
Fluid réveillée par le cron horaire GitHub) ouvre 3-4 connexions Neon en
parallèle à ~60-134 ms de handshake chacune, plus 2 connects chauds
séquentiels (requêtes notifications). C'est cette rafale que le détecteur
flag — pas une boucle de données.

Le code contient néanmoins de vrais N+1 **latents** dès qu'il y a des lignes :

| Chemin                                   | Boucle                                                              | Verdict                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/exams/cron.ts`                 | jusqu'à 500 UPDATE unitaires (1/participation) dans une transaction | **à corriger** (règle projet « pas de N+1 »)                                                                                                                                                                                                                        |
| `features/training/cron.ts`              | idem, jusqu'à 100                                                   | **à corriger**                                                                                                                                                                                                                                                      |
| `features/notifications/cron.ts`         | 1 UPDATE de claim par ligne avant chaque email                      | **conservé** — claim atomique par ligne = garde anti-double-envoi (deux schedulers se recouvrent à minuit UTC) + fenêtre de crash minimale entre claim et envoi ; un claim ensembliste ouvrirait une fenêtre « 500 claims posés, emails jamais partis » sur timeout |
| `features/users/cron.ts` (anonymisation) | 1 transaction par ligne                                             | **conservé** — isolation poison-row délibérée, volume ~0                                                                                                                                                                                                            |

### Décision (option validée : ensembliste + séquentialisation)

1. **`features/exams/cron.ts`** : remplacer SELECT + 2 agrégats + boucle
   d'UPDATE par **un seul UPDATE ensembliste** (une requête, une connexion) :

   ```sql
   WITH expired AS (
     SELECT p.id, p.exam_id
     FROM exam_participations p
     JOIN exams e ON e.id = p.exam_id
     WHERE p.status = 'in_progress' AND e.end_date < $now
     LIMIT 500
   ), scored AS (
     SELECT expired.id,
       (SELECT count(*) FILTER (WHERE a.is_correct)
          FROM exam_answers a WHERE a.participation_id = expired.id) AS correct,
       (SELECT count(*) FROM exam_questions q
          WHERE q.exam_id = expired.exam_id) AS total
     FROM expired
   )
   UPDATE exam_participations p
   SET status = 'auto_submitted',
       score = CASE WHEN s.total > 0
                    THEN round(s.correct * 100.0 / s.total) ELSE 0 END,
       completed_at = $now
   FROM scored s
   WHERE p.id = s.id AND p.status = 'in_progress'
   RETURNING p.id
   ```

   - Borne 500 conservée (CTE `LIMIT`). Arrondi : voir la sous-section
     dédiée ci-dessous (le half-up exact SQL devient la référence).
   - **Concurrence** : garde `p.status = 'in_progress'` re-vérifiée dans le
     WHERE final — sous READ COMMITTED, la condition est réévaluée sur la
     version verrouillée de la ligne (EvalPlanQual) → une soumission
     concurrente gagne, pas de clobber. Sémantique identique à l'UPDATE gardé
     ligne à ligne actuel.
   - Retour simplifié `{ closedCount }` (= lignes RETURNING) ;
     `processedCount` supprimé — consommé nulle part (vérifié : route et tests
     ne lisent que `closedCount`).

2. **`features/training/cron.ts`** : même transformation (LIMIT 100,
   `total = question_count` de la ligne, statut de fermeture `abandoned`).
3. **`app/api/cron/close-expired/route.ts`** : `Promise.all` → exécution
   **séquentielle** des 4 tâches (cron de fond, latence indifférente) → une
   seule connexion froide réutilisée au lieu de 3-4 handshakes parallèles — la
   cause mesurée dans les traces. `sendPendingNotifications` reste après les
   clôtures (inclut les `auto_submitted` du même run). Forme de la réponse
   JSON inchangée (moins `processedCount`). **Isolation par tâche** (revue
   d'implémentation) : chaque tâche est enveloppée d'un try/catch — un échec
   persistant de l'une (poison-row) ne bloque pas les suivantes (notamment
   l'anonymisation RGPD, propriété que le `Promise.all` avait de fait) ; un
   échec quelconque → 500 après avoir tout tenté (retry du scheduler
   conservé).
4. **Notifications et anonymisation inchangées** (raisons au tableau
   ci-dessus — le passage en ensembliste ne doit pas casser la garde
   anti-double-envoi, hot-spot connu de la campagne notifications).

Mécanisme Drizzle (query builder `with/update...from` vs `sql` brut typé) :
choisi au plan — la sémantique SQL ci-dessus fait foi.

### Arrondi des scores : le half-up exact devient la référence (revue design)

La parité initialement affirmée entre `Math.round((correct / total) * 100)`
(float JS, comportement actuel des crons ET de `finalizeExam` /
`completeTrainingSession`) et `round(correct * 100.0 / total)` (numeric SQL,
exact) est **fausse** : 18 contre-exemples pour `total ≤ 500` (revue design).
Ex. 23/40 : le float donne 57.4999… → 57, le SQL 57.5 exact → 58. Sans
alignement, un examen auto-soumis (cron SQL) et le même examen soumis
manuellement (`finalizeExam` JS) divergeraient d'un point — hors du périmètre
« mêmes scores », et invisible au test 2/4 = 50 (exact en float).

Décision : **l'arrondi half-up exact est la référence.**

- Crons : `round(x)::int` SQL, naturellement exact — rien à ajouter.
- Actions JS : nouveau helper partagé `lib/score.ts` :

  ```ts
  export const computeScorePercent = (
    correct: number,
    total: number,
  ): number =>
    total > 0 ? Math.floor((200 * correct + total) / (2 * total)) : 0
  ```

  (équivalent entier de `floor(v + 1/2)`, aucun float intermédiaire non
  exact), branché dans `finalizeExam` (`features/exams/actions.ts:831-834`) et
  `completeTrainingSession` (`features/training/actions.ts:409-410`). Aucun
  autre site de calcul de score en JS (vérifié — `analytics/dal.ts` arrondit
  des tendances d'affichage à 1 décimale, hors sujet).

### Tests

- **Unit `tests/lib/score.test.ts`** : cas nominaux (0 total → 0, 2/4 → 50,
  1/3 → 33, 23/40 → 58, 40/40 → 100) + balayage exhaustif `total ≤ 500`
  contre l'arrondi half-up exact calculé en entiers (reste vs
  demi-dénominateur) — c'est la preuve de parité avec `round()` SQL.
- **`tests/integration/cron-close-expired.test.ts`** : les assertions
  existantes (2/4 = 50, idempotence, « laisse les autres ») passent telles
  quelles ; **ajout d'un cas sentinelle** 23/40 → 58 (examen expiré à
  40 questions, 23 réponses correctes) qui échoue contre l'implémentation
  float actuelle — c'est le « red » du TDD de la réécriture.
- `notifications-cron.test.ts` (garde anti-double-envoi) : chemins non
  touchés, doit rester vert.

### Suivi post-déploiement

Résoudre NOMAQBANQ-17 et NOMAQBANQ-1B dans Sentry après le déploiement ;
surveiller la récidive (le détecteur ne devrait plus se déclencher sans rafale
de connects froids ; NOMAQBANQ-1B ne reviendra qu'au déploiement suivant si le
fix est inopérant).

---

## Critères d'acceptation

1. **#98** : un rejet skew simulé (unit) renvoie `DEPLOY_SKEW_MESSAGE`, sans
   retry, avec toast central dédupliqué ; l'e2e valide la chaîne réelle
   en-tête Next → toast « Recharger » → un seul POST → rollback → reprise
   après `unroute`.
2. **#99** : plus aucune boucle d'UPDATE par ligne dans `features/exams/cron.ts`
   et `features/training/cron.ts` (une requête ensembliste chacun) ; la route
   exécute les tâches séquentiellement ; les assertions d'intégration
   existantes passent telles quelles et le cas sentinelle 23/40 → 58 passe.
3. **Parité d'arrondi** : `finalizeExam` et `completeTrainingSession`
   produisent le même score que les crons pour toute paire
   `(correct, total)` — garanti par le helper entier partagé + le balayage
   exhaustif unit.
4. Gates : `bun run check`, `bun run test`, `bun run test:integration` ; pour
   la task e2e, `bun run type-check` + `bun run lint` (règle
   `.claude/rules/e2e-testing.md`) + e2e ciblé
   (`bun run test:e2e e2e/tests/examen-blanc-deploy-skew.spec.ts`).
