# Spec — Révision ciblée en entraînement (P1-A)

- **Date** : 2026-08-01
- **Statut** : DESIGN VALIDÉ — à planifier (writing-plans)
- **Branche** : `feat/p1-qbank-engagement` (empilée sur `main` ; porte aussi le
  commit `docs: notes en attente`)
- **Origine** : issue [#115 « P1 — QBank : engagement étudiant »](https://github.com/RinKhimera/NOMAQbanq/issues/115),
  issue de l'audit du 2026-07-13 (volet produit).

L'issue #115 empile deux fonctionnalités indépendantes. Elle est découpée en
deux specs :

- **P1-A (ce document)** — filtre d'entraînement « ratées / non vues / marquées ».
- **P1-B (à venir)** — notes personnelles sur les questions.

## Problème

Un étudiant qui rate une question n'a aucun moyen de la rejouer. Chaque session
d'entraînement tire au hasard dans les 3 000+ questions ; l'historique
(`training_session_items.is_correct`, `exam_answers.is_correct`) est écrit mais
n'est jamais relu pour construire un lot de révision. Le seul ciblage disponible
est thématique (domaine + objectifs CMC), pas personnel.

Trois constats relevés à la source, dont deux contredisent l'issue :

- **`is_correct` existe bien en entraînement** (`training_session_items`) et en
  examen (`exam_answers`) — « ratées » est faisable par agrégation, comme
  l'annonce l'issue.
- **`is_flagged` n'existe QUE pour les examens** (`db/schema/exams.ts`). En
  entraînement, le bouton « Marquer » du runner est branché sur un no-op
  (`training-session-client.tsx` : `onFlag: async () => ({ ok: true })`) : le
  marquage n'est **jamais** persisté. Le critère « marquées » demande donc du
  schéma neuf, contrairement à ce que suppose l'issue.
- **Aucune table de notes personnelles** n'existe — d'où le report en P1-B.

## Décisions

| Question                | Décision retenue                                                     |
| ----------------------- | -------------------------------------------------------------------- |
| Découpage               | Deux specs ; le filtre d'abord (P1-A), les notes ensuite (P1-B)      |
| Corpus d'historique     | Entraînement **+** examens, verrou anti-triche respecté              |
| Persistance du marquage | Table de signets durable `question_bookmarks`                        |
| Définition de « ratée » | **Dernière** tentative fausse (la question sort du lot dès réussite) |
| Combinaison             | Critères en OU entre eux, en ET avec domaine/objectifs               |
| Corpus plus court       | Démarrer avec ce qui existe, au lieu de refuser                      |
| Calcul du corpus        | Agrégation à la volée (pas de table d'état dérivée)                  |

L'agrégation à la volée est imposée autant par la justesse que par la règle
projet « Comptes via SQL agrégé, pas de tables d'agrégat » (`AGENTS.md`) : une
table `user_question_states` maintenue à l'écriture dupliquerait un état qui
dérive dès qu'une écriture rate, exigerait un backfill, et multiplierait les
définitions de « ratée ». À la volée, il n'existe qu'une définition et qu'un
seul point d'application de l'anti-triche.

## Design

### 1. Modèle de données

Une seule table neuve :

```
question_bookmarks
  id           text PK
  user_id      text NOT NULL → user(id)      ON DELETE CASCADE
  question_id  text NOT NULL → questions(id) ON DELETE CASCADE
  created_at   timestamptz NOT NULL DEFAULT now()
  UNIQUE (user_id, question_id)
  INDEX (user_id)
```

Le `CASCADE` sur `question_id` est délibéré et contre-courant du reste du
schéma, où les FK vers `questions` sont en `RESTRICT`. `deleteQuestion`
(`features/questions/actions.ts`) s'appuie sur ce `RESTRICT` : il **tente** le
hard delete et laisse Postgres arbitrer (`23001` → repli en soft delete). Un
signet en `RESTRICT` transformerait silencieusement tout hard delete en soft
delete dès qu'un seul étudiant a marqué la question. Un signet n'est pas du
contenu : il disparaît avec sa question.

`training_session_items` et `exam_answers` ne changent pas.

### 2. Le corpus de révision

Un builder partagé (`server-only`) construit la **dernière tentative par
question**, en unissant les deux historiques de l'utilisateur courant :

- `training_session_items` joint à `training_sessions` (filtre `user_id`),
  `selected_answer IS NOT NULL`, horodatage `answered_at` ;
- `exam_answers` joint à `exam_participations` (filtre `user_id`),
  `selected_answer IS NOT NULL`, horodatage `created_at` ;

puis `DISTINCT ON (question_id) … ORDER BY question_id, <horodatage> DESC`.

Les trois critères se lisent sur cette base :

| Critère        | Définition                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **failed**     | dernière tentative `is_correct = false`                                                                               |
| **bookmarked** | présente dans `question_bookmarks` (utilisateur courant) **ou** `exam_answers.is_flagged` d'une de ses participations |
| **unseen**     | absente des deux historiques                                                                                          |

Deux précisions qui lèvent l'ambiguïté du mot « vue » :

- « vue » signifie **répondue**. Une question servie puis laissée sans réponse
  (session abandonnée, examen non terminé) reste **non vue** et peut donc être
  retirée — c'est voulu : elle n'a rien appris à l'étudiant.
- **bookmarked** se lit directement sur `question_bookmarks` et
  `exam_answers.is_flagged`, **sans** passer par l'agrégat des tentatives : une
  question marquée mais jamais répondue compte comme marquée.

Les critères cochés s'unissent en **OU**, le résultat est intersecté (**ET**)
avec domaine + objectifs CMC et `questions.deleted_at IS NULL`, puis
`ORDER BY random() LIMIT n`.

`exam_answers.created_at` vaut « début de la tentative » et non « instant de la
réponse » : les lignes sont pré-créées au démarrage de l'examen
(`features/exams/actions.ts`) et jamais réhorodatées à la réponse. Limite
assumée, relevée par la revue de design : si un étudiant intercale une session
d'entraînement **pendant** un examen long, sa réponse d'entraînement porte un
horodatage postérieur à celle de l'examen même si l'examen a été répondu après —
le `DISTINCT ON` retient alors la mauvaise « dernière tentative ». L'effet se
borne à classer une question comme ratée ou non sur la base d'une de ses deux
tentatives récentes, toutes deux de l'étudiant lui-même. Corriger demanderait un
horodatage à l'écriture sur `exam_answers` : hors périmètre de P1-A, à ouvrir si
le classement se révèle visiblement faux en usage.

Volume borné : l'historique d'un étudiant vaut ses sessions × 20 items plus ses
participations × N réponses ; `unseen` balaie la banque (3 000+ lignes) une fois
à la création de session. Aucune lecture non bornée n'est introduite.

### 3. Anti-triche — deux couches

Le verrou existant `getOpenExamLockedQuestionIds(userId, questionIds)`
(`features/exams/dal.shared.ts`) marque toute question d'un examen dont
`end_date` est future **et** où l'étudiant a une participation, quel que soit
son statut. Il est aujourd'hui appliqué aux trois canaux de **révélation** :
`getTrainingSessionById`, `getTrainingSessionResults`, et le `reveal` du mode
tuteur dans `saveTrainingAnswer`.

Ce socle ne suffit pas ici. Un filtre « rejouer mes ratées » est **lui-même un
oracle** : le simple fait qu'une question apparaisse dans le lot dit « tu t'es
trompé ». Si la participation de l'étudiant est encore `in_progress`, il apprend
quelles réponses sont fausses et peut les corriger dans l'examen — triche
directe, **sans jamais voir la clé**. Après soumission mais avant clôture, cela
divulgue la correction que le produit diffère volontairement.

D'où la règle centrale de cette spec :

> **Le verrou s'applique à la SÉLECTION, en plus de la RÉVÉLATION.**

- **Sélection** : le corpus retranche `getOpenExamLockedQuestionIds(userId,
candidats)` pour les **trois** critères, uniformément — y compris `unseen`,
  pour ne pas laisser de faille par différence — et les **compteurs** affichés
  dans le formulaire sont calculés sur exactement le même corpus filtré. Sans
  cela, le compteur redevient l'oracle que le lot n'est plus.
- **Révélation** : les trois gardes existantes restent en place, inchangées.
  Réévaluées à chaque lecture, elles masquent la correction même pour une
  session créée **avant** l'entrée dans l'examen.

**Précision sur la course « je crée ma session filtrée, puis je rejoins
l'examen »** (soulevée par la revue de design du 2026-08-01). Les gardes de
révélation masquent la clé mais **ne retirent pas** la question du lot déjà
constitué — le lot, lui, n'est pas recalculé. Ce n'est pourtant pas un trou, et
la raison mérite d'être écrite parce qu'elle n'est pas évidente :

> Pour que l'appartenance au lot dise quoi que ce soit sur les **réponses d'un
> examen**, il faut que ces réponses existent. Elles n'existent qu'à partir
> d'une participation — or c'est exactement ce qui active le verrou. Une session
> filtrée créée avant toute participation ne peut donc encoder que l'historique
> d'entraînement passé de l'étudiant, information qu'il lit déjà dans ses
> propres résultats.

Autrement dit : l'oracle craint porte sur les réponses de l'examen en cours, et
celui-là est fermé à la source. L'invariante à préserver n'est pas « le lot est
recalculé », c'est **« aucun lot ne se constitue pendant qu'une participation
est ouverte sur ces questions »**. Si une évolution future permettait de
recomposer ou d'étendre un lot existant, cette garantie tomberait et il faudrait
alors persister les critères pour re-filtrer à la lecture.

Autres chemins passés en revue :

- **IDOR** : le filtre ne prend jamais d'identifiant d'utilisateur ni de liste
  de questions venant du client ; tout se dérive de `session.user.id`.
- **Bascule d'un signet pendant un examen ouvert** : autorisée, elle ne renvoie
  que l'état du signet — aucune donnée de correction.
- **Bypass admin** : inchangé (les gardes existantes sautent déjà le verrou pour
  le rôle `admin`).
- **Déverrouillage à `end_date`** : politique existante, non modifiée.

**Trou pré-existant, explicitement hors périmètre** : une question d'un examen
ouvert que l'étudiant n'a **pas** rejoint peut déjà tomber dans un tirage
d'entraînement aléatoire — le verrou est volontairement _user-scoped_ (la
variante anonyme `getOpenExamQuestionIds` est réservée au quiz marketing
public). P1-A n'aggrave pas ce cas et ne l'élargit pas.

### 4. Server Actions et schémas

`createTrainingSessionSchema` gagne un champ optionnel :

```ts
revisionFilters: z.array(z.enum(["failed", "unseen", "bookmarked"]))
  .max(3)
  .optional()
```

Quand il est présent et non vide, deux règles de `createTrainingSession`
changent :

- le nombre demandé est **borné au corpus disponible** au lieu de déclencher le
  `NOT_ENOUGH` actuel ;
- `MIN_QUESTIONS` (5) ne s'applique plus : trois questions ratées font une
  session de révision légitime. `MAX_QUESTIONS` (20), lui, reste la borne haute.

Un `revisionFilters` **vide** équivaut à son absence : tirage aléatoire
classique, `MIN_QUESTIONS` et `NOT_ENOUGH` inclus. Les modes `tutor` et `test`
restent tous deux disponibles en révision.

Il ne subsiste qu'une condition de refus, **corpus vide**, avec un message qui
nomme le critère concerné. Le reste de l'action ne bouge pas : garde d'accès,
verrou de ligne utilisateur, rate-limit, refus de session active concurrente,
insertion atomique session + items.

Deux actions neuves :

- `toggleQuestionBookmark(questionId)` — idempotente (insert `ON CONFLICT DO
NOTHING` / delete), renvoie l'état du signet et rien d'autre.
- `loadRevisionCounts(domain, objectifs)` — calqué sur
  `loadAvailableObjectifsCMC`, appelé via `callAction` quand l'étudiant change
  de domaine ou d'objectifs.

### 5. UI

- **`training-config-form.tsx`** : un groupe « Réviser » de trois puces
  cochables, chacune avec son compteur live (« Ratées · 42 »). Le curseur de
  nombre se borne au corpus filtré. Les compteurs se rafraîchissent au
  changement de domaine/objectifs, sur le mécanisme déjà en place pour les
  objectifs CMC.
- **Runner d'entraînement** : le bouton « Marquer » existe déjà côté
  `QuestionCard` ; `training-session-client.tsx` remplace son `onFlag` no-op par
  `toggleQuestionBookmark`, avec l'état initial hydraté depuis les signets de
  la session en cours.
- Aucun autre écran ne bouge. Le comportement du marquage **en examen** est
  inchangé.

### 6. Tests

Intégration (base réelle) — l'essentiel de la valeur :

- **exclusion des questions verrouillées du lot ET des compteurs** — test
  central, c'est lui qui garde l'invariante anti-triche ;
- définition « dernière tentative » : ratée puis réussie → sort du lot ;
- union OU des critères, intersection ET avec domaine/objectifs ;
- corpus plus court que demandé → session démarrée, bornée ;
- corpus vide → refus explicite ;
- IDOR : l'historique et les signets d'un autre étudiant n'entrent jamais dans
  le corpus ;
- `toggleQuestionBookmark` idempotente sous appels répétés.

Frontend : puces + bornes du curseur dans le formulaire ; persistance du
marquage dans le runner (fin du no-op).

Nettoyage `afterAll` : `question_bookmarks` avant `questions` (FK), comme les
autres tables enfants.

## Hors périmètre

- **Notes personnelles** → spec P1-B.
- **Verrou anonyme sur les examens non rejoints** → trou pré-existant, inchangé.
- Aucun tableau de bord de statistiques par question.
- Aucun changement au mode examen ni au quiz marketing.
