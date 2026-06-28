# Images d'explication des questions (multiples, visibles à la correction)

**Date** : 2026-06-28
**Statut** : design validé + revu (adversarial) et corrigé — prêt pour le plan
**Auteur** : brainstorming Samuel + Claude
**Révision** : revue adversariale 2026-06-28 — correctif **bloquant #1** intégré
(toutes les lectures d'images d'énoncé doivent être scopées à `kind='statement'`,
sinon fuite des images d'explication en passation) + canal du champ d'explication
clarifié (lazy examen)

## Contexte

Une question peut aujourd'hui porter des **images d'énoncé** (visibles pendant la
passation) via la table [`questionImages`](../../../db/schema/questions.ts)
(multiples, ordonnées) et un pipeline d'upload presigned S3 anti-orphelins solide
(`createQuestionImageUpload` → tampon `tmp/` → `setQuestionImages` copie vers
`questions/{id}/` + nettoyage best-effort).

Le besoin : ajouter des **images d'explication**, visibles **uniquement à la
correction** (quand on consulte le résultat d'une question), distinctes des images
d'énoncé.

> **Constat d'audit** : la colonne `questionExplanations.imagePath` existe dans le
> schéma (« figure d'explication ») mais est **du code mort** — jamais lue, jamais
> écrite par l'app (seulement mise à `null` par le script d'import Convex), absente
> de `getQuestionById`. Il n'y a donc **aucune** fonction d'image d'explication
> opérationnelle aujourd'hui. On repart proprement et on supprime cette colonne.

## Objectif

Permettre d'attacher **plusieurs** images à l'explication d'une question, gérées
par l'admin comme les images d'énoncé, et affichées **seulement** dans les vues de
correction (dashboard examen/entraînement + quiz vitrine), jamais pendant la
passation.

## Décisions de conception (validées)

| #  | Sujet                          | Choix retenu                                                                                        |
| -- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| D1 | Modèle de données              | **Colonne discriminante `kind`** sur `questionImages` (vs table parallèle).                        |
| D2 | Portée d'affichage             | Correction dashboard **et** correction du **quiz vitrine public** (par cohérence).                |
| D3 | Frontière anti-triche          | Images d'explication révélées **avec** l'explication (correction / mode tuteur), jamais en passation. |

## Modèle de données

```
questionImages.kind  enum('statement' | 'explanation')  -- défaut 'statement'
  + index (questionId, kind)

-- suppression de la colonne morte :
questionExplanations.imagePath   →  DROP
```

Migration additive : `kind` défaut `'statement'` → toutes les images existantes
restent des images d'énoncé. Aucune rétro-action nécessaire.

## Chemins de stockage S3

Les chemins sont **namespacés par `kind`** pour éviter toute collision d'index
entre les deux jeux d'images d'une même question :

```
tmp/questions/{id}/statement/{i}.{ext}    questions/{id}/statement/{i}.{ext}
tmp/questions/{id}/explanation/{i}.{ext}  questions/{id}/explanation/{i}.{ext}
```

`generateQuestionImageTmpPath`, `finalPathFromTmp` et la garde de préfixe
(`assertSafeStoragePath` + vérification `questions/{id}/{kind}/`) intègrent le
`kind`.

## Actions (réutilisation du pipeline existant)

- **`createQuestionImageUpload`** : ajoute un paramètre `kind` → presigned POST
  vers le tampon `tmp/questions/{id}/{kind}/…`. Mêmes gardes (admin, question
  existante non supprimée, validation type/taille, rate-limit).
- **`setQuestionImages({ questionId, kind, images })`** : delete / insert /
  cleanup **scopés par `kind`** — sauver les images d'énoncé n'efface pas celles
  d'explication, et inversement. Le `old`-query et la suppression S3 best-effort
  filtrent sur `(questionId, kind)`.
- **`setQuestionImagesSchema`** : ajoute `kind` (enum).

## DAL — filtrage par `kind` (CRITIQUE, anti-triche — constat 🔴 #1)

⚠️ **Toutes les lectures d'images d'énoncé existantes lisent `questionImages` SANS
filtre `kind`.** Une fois la colonne `kind` ajoutée, elles remonteraient les
images d'**explication** dans le champ `images` rendu **pendant la passation** →
fuite. Chaque lecture doit donc être explicitement scopée.

### Tableau « lecture → `kind` attendu »

| Lecture (fichier:ligne)                                     | Contexte                          | `kind`        |
| ----------------------------------------------------------- | --------------------------------- | ------------- |
| `fetchImages` — `features/exams/dal.ts:60`                  | passation **et** résultats examen | `'statement'` |
| `fetchImages` — `features/training/dal.ts:98`               | passation **et** résultats entr.  | `'statement'` |
| `getRandomQuizQuestions` — `features/questions/dal.ts:369`  | quiz vitrine (énoncé)             | `'statement'` |
| `getQuestionById` images — `features/questions/dal.ts:256`  | éditeur admin (énoncé)            | `'statement'` |
| `getQuestionById` `explanationImages` *(nouveau)*           | éditeur admin (explication)       | `'explanation'` |
| Loader explication examen *(cf. canal ci-dessous)*          | correction examen                 | `'explanation'` |
| `getTrainingSessionResults` — `features/training/dal.ts:580`| correction entraînement           | `'explanation'` |
| `getQuizAnswerKey` — `features/questions/dal.ts`            | correction vitrine                | `'explanation'` |

> Même dans le **chemin résultats**, `fetchImages` reste filtré `kind='statement'`
> (le champ `images` = énoncé) ; les images d'explication arrivent par le canal
> explication ci-dessous, jamais par `images`.

### Canal des images d'explication (corrige l'incohérence eager/lazy — 🟠 #4)

Les `explanationImages` voyagent **sur le même canal que `explanation`**, jamais
sur le pont d'énoncé, et **uniquement quand l'explication est révélée** (session
complétée, ou item répondu en mode tuteur) :

- **Examen** : l'explication est **lazy-loadée** via `getExamQuestionExplanations`
  (→ `QuestionExplanationView` / `loadExamQuestionExplanations`). C'est **ce
  type/loader** qui gagne `explanationImages` — **pas** le pont eager
  `ExamQuestionView`.
- **Entraînement (résultats)** : `getTrainingSessionResults` (eager, session
  complétée) ajoute `explanationImages` à côté de `explanation`/`references`.
- **Mode tuteur (entraînement en cours)** : `saveTrainingAnswer` (révélation par
  réponse) et la reprise via `getTrainingSessionById` renvoient `explanationImages`
  pour les items répondus, **uniquement en mode tuteur** (cf. Feature 1 §C).
- **Quiz vitrine** : `getQuizAnswerKey` ajoute `explanationImages` (D2).
- **Admin** : `getQuestionById` renvoie `explanationImages` (édition).

Le type `QuizQuestion` (Feature 1) gagne `explanationImages?: QuizImageView[]`.

## UI Admin

Dans le formulaire question
([`question-form-page.tsx`](../../../app/(admin)/admin/questions/_components/question-form-page.tsx)) :
**deux sections d'upload** réutilisant
[`question-image-uploader.tsx`](../../../components/admin/question-image-uploader.tsx)
paramétré par une prop `kind` :

- « Images de l'énoncé » (`kind="statement"`) — comportement actuel.
- « Images de l'explication » (`kind="explanation"`) — nouveau.

Chaque section appelle `createQuestionImageUpload`/`setQuestionImages` avec son
`kind`.

## Affichage (correction uniquement)

- **Dashboard** : `<SessionResults>` / `QuestionCard variant="review"` (Feature 1)
  rendent `question.explanationImages` sous l'explication. **Jamais** pendant la
  passation (`variant="exam"` ne reçoit pas ce champ).
- **Quiz vitrine** : la vue de correction marketing affiche les images
  d'explication renvoyées par la clé de correction.

## Migration Drizzle (`bun run db:generate` → `db:migrate`)

1. `questionImages.kind` enum (`db/schema/enums.ts`), **défaut `'statement'`** +
   index `(questionId, kind)`.
2. **Drop** `questionExplanations.imagePath`.

## Cas limites

- Question sans image d'explication → `explanationImages = []`, rien affiché.
- Suppression de question → images d'explication supprimées en cascade FK (comme
  les images d'énoncé) ; nettoyage S3 best-effort via les chemins persistés.
- Édition : remplacer les images d'explication ne touche pas celles d'énoncé
  (scope `kind`).

## Tests

- **Intégration** (`tests/integration/`) :
  - `setQuestionImages` scopé : sauver `statement` ne supprime pas `explanation`
    et inversement ; cleanup S3 ciblé.
  - `getQuestionById` renvoie les deux jeux séparément.
  - **Lectures d'énoncé scopées (constat #1)** : `fetchImages` (examen +
    entraînement) et `getRandomQuizQuestions` ne remontent **que**
    `kind='statement'` — aucune image d'explication dans `images` en passation.
  - Forme-pont : `explanationImages` **absent** pendant la passation, **présent** à
    la correction et en mode tuteur (item répondu).
  - Quiz vitrine : `explanationImages` présent dans la clé de correction.
  - Couvert aussi par le **test anti-triche paramétré partagé** (Feature 1) :
    aucun de `{correctAnswer, explanation, references, isCorrect,
    explanationImages}` n'atteint le client en passation.
- **Composant** (`tests/components/admin/`) : le formulaire monte deux uploaders
  (`statement` / `explanation`) et appelle les actions avec le bon `kind`.

## Hors périmètre (YAGNI)

- Légendes / textes alternatifs par image.
- Réordonnancement cross-kind (chaque kind a son propre ordre).

## Risques

- **Garde de préfixe avec `kind`** : la sécurité anti-suppression croisée de
  `setQuestionImages` repose sur la validation du préfixe ; l'intégration du `kind`
  dans le chemin doit conserver cette garantie (revue ciblée recommandée).
- **Frontière anti-triche** : bien cantonner `explanationImages` à la révélation
  (même traitement que `explanation`) dans **tous** les chemins de lecture
  (examen, entraînement, vitrine).
