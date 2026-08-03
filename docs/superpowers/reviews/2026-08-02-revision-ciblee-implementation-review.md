# Revue adversariale — Révision ciblée en entraînement (P1-A)

- **Date** : 2026-08-02
- **Périmètre** : `git diff main...HEAD` sur `feat/p1-qbank-engagement` (15 commits,
  27 fichiers, +7084 / −68). Spec `docs/superpowers/specs/2026-08-01-revision-ciblee-entrainement-design.md`,
  plan `docs/superpowers/plans/2026-08-01-revision-ciblee-entrainement.md`.
- **Méthode** : lecture seule, posture hostile. Chaque constat est prouvé par une
  référence `fichier:ligne` lue dans l'arbre, jamais par le message de commit.
  Chaque suspicion a subi une tentative de réfutation ; celles qui sont tombées
  sont consignées en §4.
- **Gate** : `bun run check` → **exit 0** (`prettier --check` + `tsc --noEmit` +
  `eslint --max-warnings 0`, tous verts).
- **Tests exécutés** : `bun run test:coverage` → **exit 0**.
  Statements 83.68 % · **Branches 80.26 %** · Functions 81.88 % · Lines 84.56 %
  (seuil 80 % partout). Aucune commande de base de données n'a été lancée : la
  suite `tests/integration/**` (dont tout le SQL brut) n'a **pas** été rejouée ici,
  le SQL de `features/training/revision.ts` n'a donc été audité que statiquement.

---

## 1. Tableau des constats

| #   | Sév | Fichier:ligne                             | Problème                                                                                                                                                                              | Régression ?                                                  |
| --- | --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | 🟠  | `features/training/revision.ts:26-30`     | Le CTE `attempts` n'exclut pas les sessions `in_progress` → les compteurs dérivent `is_correct` d'une session **mode test** encore ouverte, ce que 3 gardes interdisent explicitement | NON (surface neuve) — mais contredit une invariante existante |
| 2   | 🟡  | `features/exams/dal.shared.ts:121-136`    | `getUserOpenExamLockedQuestionIds` est une lecture **non bornée** (aucun `.limit`), désormais exécutée intégralement à **chaque** réponse en mode tuteur                              | OUI (profil de charge ; résultat identique)                   |
| 3   | 🟡  | `features/training/actions.ts:60-67`      | `loadRevisionCounts` n'a **aucun** `zod.safeParse` ; `objectifsCMCs` non borné alors que le schéma de création le plafonne à 50                                                       | NON                                                           |
| 4   | 🟡  | `…/training-config-form.tsx:88,95`        | `objectifsKey.split("\|")` casse si un objectif CMC contient un `\|` (champ libre admin) → compteurs faux, en silence                                                                 | NON                                                           |
| 5   | ℹ️  | `features/training/revision.ts:97-99,106` | Asymétrie admin : le verrou de **sélection** ne saute pas pour `role === "admin"` alors que les 3 gardes de **révélation** le sautent                                                 | NON (restrictif seulement)                                    |
| 6   | ℹ️  | `scripts/test-integration.ts:21-23,36-37` | Passe-plat d'arguments vers `spawnSync(..., { shell: true })` : les guillemets sont perdus, `-t "deux mots"` se disloque                                                              | NON (CI n'utilise aucun argument)                             |
| 7   | ℹ️  | `features/training/actions.ts:398-431`    | `setQuestionBookmark` accepte n'importe quel `questionId`, sans plafond ni limite de débit ; distingue « existe » de « n'existe pas »                                                 | NON                                                           |
| 8   | ℹ️  | `vitest.config.ts:106-111` (mesuré)       | La couverture **branches** est à 80.26 % pour un seuil de 80 % — 0,26 pt de marge sur le gate CI                                                                                      | NON                                                           |

---

## 2. Détail par constat

### 🟠 1 — Les compteurs de révision lisent une session `in_progress` en mode test

**Code**

- `features/training/revision.ts:26-30` — branche entraînement du CTE `attempts` :
  ```
  from training_session_items i
  join training_sessions s on s.id = i.session_id
  where s.user_id = ${userId} and i.selected_answer is not null
  ```
  Aucun filtre sur `s.status`.
- `features/training/revision.ts:36-40` — `last_attempt` en dérive ;
  `features/training/revision.ts:54` — `failed` = `is_correct = false` sur `last_attempt` ;
  `features/training/revision.ts:56` — `unseen` = absence de `attempts`.
- L'invariante contredite est écrite trois fois dans le code d'origine :
  - `features/training/actions.ts:383-384` — « Mode test : ne pas exposer `isCorrect`
    sur le fil réseau (anti-triche) » ;
  - `features/training/dal.ts:607` — `revealAnswers = isCompleted || isTutor` ;
  - `features/training/dal.ts:610-618` — `isCorrect` omis sinon.

**Pourquoi c'est un vrai bug.** En mode test, la correction est délibérément
retenue jusqu'à la clôture de la session. Les compteurs, eux, sont recalculés à
la volée sur un historique qui inclut la session ouverte. Déclencheur concret :
session test en cours, `loadRevisionCounts` appelée entre deux réponses.
Répondre A à Q1 fait monter `Ratées` de 1 si et seulement si A est fausse ;
rebasculer sur B fait redescendre le compteur si et seulement si B est juste.
Quatre options ⇒ au plus trois sondages pour extraire la clé, sans jamais la
voir — exactement l'oracle que la spec §3 dit fermer côté examen, laissé ouvert
côté entraînement. `saveTrainingAnswer` autorise bien la ré-écriture d'un item
tant que la session est `in_progress` (`features/training/actions.ts:348-351`,
aucun garde d'immuabilité).

**Ce qui limite la portée, et qu'il faut dire.** Il n'y a **pas de chemin UI** :
`app/(dashboard)/tableau-de-bord/entrainement/_components/entrainement-client.tsx:129`
ne monte `TrainingConfigForm` que si `!activeSession?.canResume`, donc le
formulaire — seul appelant de `loadRevisionCounts` — est absent tant qu'une
session est reprenable. L'exploitation demande de rejouer la Server Action
directement (son identifiant est stable pour un build donné et lisible dans le
bundle d'une page où le formulaire est rendu). C'est une protection par rendu
conditionnel, pas une garde serveur — précisément ce que « Jamais confiance au
client » (AGENTS.md) proscrit.

**Régression ?** NON au sens strict : aucun comportement antérieur ne change,
la surface est neuve. Mais elle ouvre un canal latéral autour d'une invariante
qui tenait avant la branche.

**Correction suggérée.** Une ligne dans la branche entraînement du CTE :
`and s.status <> 'in_progress'`. Sémantiquement cohérent avec « dernière
tentative » (une session non close n'est pas une tentative arrêtée), et sans
effet sur les tests existants (`tests/integration/revision-corpus.test.ts` seede
des sessions `completed`/`abandoned`). Ajouter un test d'intégration : session
test en cours + réponse fausse ⇒ `failed` inchangé.

---

### 🟡 2 — Le verrou anti-triche est devenu une lecture non bornée, sur un chemin chaud

**Code**

- `features/exams/dal.shared.ts:121-136` — `getUserOpenExamLockedQuestionIds` :
  `selectDistinct` sur `exam_questions ⋈ exams ⋈ exam_participations`, filtré sur
  `userId` + `endDate > now()`. **Aucun `.limit()`**.
- `features/exams/dal.shared.ts:102-109` — `getOpenExamLockedQuestionIds` charge
  ce jeu complet puis filtre en TS (`questionIds.filter(id => locked.has(id))`).
- Avant la branche (`git show main:features/exams/dal.shared.ts`, l. 113-120), le
  `inArray(examQuestions.questionId, questionIds)` était **dans le `WHERE`**.
- Appelants du chemin chaud : `features/training/actions.ts:358-362`
  (`saveTrainingAnswer`, mode tuteur, **une fois par réponse**, avec un seul
  candidat), `features/training/dal.ts:575`, `features/training/dal.ts:718`,
  `features/exams/dal.student.ts:586,704`.
- Règle violée : AGENTS.md, « **IMPORTANT - Reads bornes** : Toujours limiter
  (`.limit(n)` / pagination keyset). Max ~1000 lignes par requete. »

**Pourquoi c'est un vrai bug.** Le résultat est identique (§4 le prouve), mais le
coût ne l'est plus. Une requête auparavant ultra-sélective (index
`exam_questions_question_id_idx` sur un identifiant unique) devient un balayage
des questions de tous les examens ouverts où l'utilisateur participe — plusieurs
centaines de lignes, ×20 réponses dans une session tuteur. Sur un étudiant
inscrit à trois examens de 150 questions, c'est ~450 lignes agrégées à chaque
clic de réponse au lieu d'une. Rien ne borne ce jeu : le plafond dépend
uniquement du contenu de la banque d'examens.

**Régression ?** **OUI** — profil de charge uniquement, sémantique inchangée.

**Correction suggérée.** Garder la source unique **et** la sélectivité : passer un
`questionIds?: string[]` optionnel à `getUserOpenExamLockedQuestionIds`, réinjecté
en `inArray` quand il est fourni (`getOpenExamLockedQuestionIds` le fournit,
`resolveRevisionLock` non). La règle reste définie une seule fois. À défaut,
mémoïser par requête avec `cache()` de React, ce qui amortit au moins les appels
multiples d'un même rendu — mais pas les 20 appels de `saveTrainingAnswer`, qui
sont 20 requêtes distinctes.

---

### 🟡 3 — `loadRevisionCounts` : Server Action sans `zod.safeParse`, tableau non borné

**Code**

- `features/training/actions.ts:60-67` :
  ```ts
  export const loadRevisionCounts = async (args: {
    domain?: string
    objectifsCMCs?: string[]
  }): Promise<RevisionCounts> => {
    const session = await requireSession()
    return getRevisionCounts(session.user.id, args)
  }
  ```
- Consommation directe : `features/training/revision.ts:66-75` mappe chaque entrée
  en paramètre lié dans un `in (…)`.
- Le même champ est plafonné côté écriture : `features/training/schemas.ts:24` —
  `z.array(z.string().trim().min(1)).max(50).optional()`.
- Règle violée : `.claude/rules/data-layer.md`, « Server Actions : `"use server"` →
  guard → `zod.safeParse` (early `fail(message)`) ».

**Pourquoi c'est un vrai bug.** Le garde d'authentification est bien là (l'IDOR
est fermé, cf. §4), mais rien ne borne l'entrée. Un client authentifié peut
poster `objectifsCMCs` de plusieurs dizaines de milliers d'entrées ; chacune
devient un paramètre lié d'un `IN` greffé sur une requête qui balaie déjà les
3 000+ questions et tout l'historique de l'utilisateur. Il n'y a pas de
limitation de débit sur ce point d'entrée. Le précédent invoqué
(`loadAvailableObjectifsCMC`, `features/training/actions.ts:70-75`) ne prend
qu'une chaîne — le tableau est l'amplificateur nouveau.

**Régression ?** NON (surface neuve).

**Correction suggérée.** Un schéma zod dédié —
`z.object({ domain: z.string().trim().min(1).optional(), objectifsCMCs: z.array(z.string().trim().min(1)).max(50).optional() })`
— avec `safeParse` et repli sur `{ failed: 0, unseen: 0, bookmarked: 0 }` en cas
d'échec, pour ne pas faire remonter un throw jusqu'au `catch` du formulaire.

---

### 🟡 4 — `objectifsKey.split("|")` : un objectif CMC contenant `|` fausse les compteurs

**Code**

- `app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form.tsx:88`
  — `const objectifsKey = selectedObjectifs.join("|")`
- même fichier `:95` — `objectifsCMCs: objectifsKey ? objectifsKey.split("|") : undefined`
- Le champ est du texte libre, sans restriction de jeu de caractères :
  `features/questions/schemas.ts:14` — `objectifCMC: z.string().trim().min(1, …)` ;
  `db/schema/questions.ts:21` — `text("objectif_cmc").notNull()`. Le formulaire admin
  permet d'en **créer** un à la volée (combobox « Sélectionner ou créer… »,
  cf. `.claude/rules/e2e-testing.md`).

**Pourquoi c'est un vrai bug.** `join` puis `split` n'est réversible que si le
séparateur est absent des valeurs. Un objectif nommé `Douleur thoracique | angor`
part vers le serveur en deux fragments dont aucun ne correspond à une valeur en
base → les trois compteurs tombent à 0. La création de session, elle, envoie
`selectedObjectifs` **directement** (`:146-147`) et reste correcte : l'étudiant
voit donc « Ratées 0 » puis démarre une session de révision non vide. La
divergence est silencieuse, sans erreur ni journal.

**Régression ?** NON.

**Correction suggérée.** Ne pas re-dériver la valeur depuis la clé : garder
`objectifsKey` comme **seule** dépendance de l'effet et envoyer
`selectedObjectifs` (lu au moment de l'appel), ou utiliser
`JSON.stringify(selectedObjectifs)` comme clé et `JSON.parse` pour la valeur.

---

### ℹ️ 5 — Asymétrie admin entre verrou de sélection et verrou de révélation

**Code**

- Révélation, bypass admin explicite : `features/training/dal.ts:573-575`
  (`session.user.role === "admin" ? new Set<string>() : …`),
  `features/training/dal.ts:716-718`, `features/training/actions.ts:358`.
- Sélection, **aucun** bypass : `features/training/revision.ts:106`
  (`getRevisionCounts`) et `features/training/actions.ts:133`
  (`createTrainingSession`) appellent `resolveRevisionLock(userId)`
  inconditionnellement.

**Pourquoi c'est un constat et pas un bug.** L'asymétrie va dans le sens
restrictif : un admin qui participe à un examen ouvert obtient un corpus de
révision **amputé** de ces questions, alors qu'il peut déjà en lire la clé par
les canaux de révélation. Aucune fuite, aucun contournement — seulement une
incohérence qui produira un « pourquoi mon compteur est-il à 0 ? » un jour.

**Régression ?** NON.

**Correction suggérée.** Trancher explicitement et l'écrire : soit aligner
(`isAdmin ? [] : await resolveRevisionLock(userId)`), soit documenter en une
ligne dans `revision.ts` que le verrou de sélection est volontairement
universel. Ne pas laisser le lecteur deviner.

---

### ℹ️ 6 — Le passe-plat d'arguments perd les guillemets (`shell: true`)

**Code**

- `scripts/test-integration.ts:21-23` — `vitestArgs` = `process.argv.slice(2)`
  moins `--keep` et `--`.
- `scripts/test-integration.ts:36-37` — `spawnSync(command, args, { …, shell: true })`.
- `scripts/test-integration.ts:55-59` — `[..., ...vitestArgs]`.

**Pourquoi c'est un constat.** Avec `shell: true`, Node concatène les arguments
en une ligne de commande sans les re-citer. `bun run test:integration -- -t "verrou anti-triche"`
arrive à vitest comme `-t verrou anti-triche` : deux positionnels parasites, donc
un filtre de fichiers vide et « No test files found ». Les chemins simples
(`tests/integration/revision-corpus.test.ts`) passent, ce qui masque le problème.
**La CI n'est pas exposée** : `.github/workflows/ci.yml:85` invoque
`bun run test:integration` sans aucun argument, et `process.argv.slice(2)` vaut
alors `[]` — le comportement d'origine est strictement préservé.

**Régression ?** NON.

**Correction suggérée.** Retirer `shell: true` (les binaires `bun`/`bunx` sont
résolus sans shell sous Windows via `spawnSync` + `.cmd` géré par Node ≥ 18), ou
documenter dans l'en-tête du script que seuls des arguments sans espace sont
supportés.

---

### ℹ️ 7 — `setQuestionBookmark` : aucune borne, et un oracle d'existence

**Code** — `features/training/actions.ts:398-431` :

- `:412-416` — insert `onConflictDoNothing` sur un `questionId` arbitraire, sans
  vérifier ni `deleted_at`, ni un quelconque rattachement à une session de
  l'utilisateur ;
- `:427` — `if (getPgErrorCode(error) === "23503") return fail("Question introuvable.")`
  distingue un identifiant existant d'un identifiant inexistant.

**Pourquoi c'est un constat.** Un compte authentifié peut marquer les 3 000+
questions de la banque (une requête par question, sans limitation de débit),
ce qui gonfle la table et rend son propre critère « marquées » égal à la banque
entière — nuisance auto-infligée, mais stockage non borné côté serveur. La
distinction 23503 / succès est un oracle d'existence ; les identifiants étant
des cuid2 (`lib/ids.ts`), il n'est pas énumérable, la valeur pratique est nulle.

**Régression ?** NON.

**Correction suggérée.** Plafonner le nombre de signets par utilisateur
(`count(*)` gardé dans la même transaction, ex. 500) si le stockage devient un
sujet. Rien à faire sur l'oracle.

---

### ℹ️ 8 — Marge de 0,26 point sur le seuil de couverture des branches

**Mesure** (`bun run test:coverage` sur `HEAD`, exit 0) :
Statements 83.68 % · **Branches 80.26 %** · Functions 81.88 % · Lines 84.56 %,
contre un seuil de 80 % partout (`vitest.config.ts:106-111`).

**Pourquoi c'est un constat.** La branche fait entrer trois composants dans le
rapport (`…entrainement/_components/*` apparaissent bien dans la table v8 ;
`training-config-form.tsx` à 69.09 % de branches). Le résultat passe, mais le
prochain composant ajouté sans test fera tomber le job `Tests with coverage` de
la CI. C'est une information à connaître avant d'empiler P1-B, pas un défaut de
cette branche.

**Correction suggérée.** Aucune ici. À garder en tête pour la campagne suivante.

---

## 3. Ce que le code tient bien (vérifié, pas supposé)

Ces points étaient les plus susceptibles de casser ; ils ont été lus ligne à ligne
et ils tiennent.

- **Le verrou à la sélection est réellement appliqué**, au tirage
  (`revision.ts:159` via `corpusWhere`) **et** aux compteurs (`revision.ts:114`),
  sur les trois critères sans exception — c'est bien l'invariante centrale de la
  spec §3, et `tests/integration/revision-corpus.test.ts:326-355` la garde.
- **`resolveRevisionLock` est résolu hors transaction** (`actions.ts:133`, avant
  le `db.transaction` de `:139`), conformément à la contrainte du pool `max: 5`
  sans `connectionTimeoutMillis` (`db/index.ts:9`). Le paramètre `lockedIds` est
  **requis** (`revision.ts:145`), donc un oubli casse la compilation.
- **Le chemin non-révision est strictement inchangé** : `actions.ts:197-212`
  reproduit à l'identique le `count` + `NOT_ENOUGH` + `random()/limit` de
  `git show main:features/training/actions.ts`. Seule l'indentation bouge.
- **Aucune injection SQL** : chaque valeur du SQL brut passe par la liaison de
  paramètres du template `sql` (`revision.ts:29,42,47,64,71,84,161`) ; aucun
  identifiant n'est interpolé.
- **Aucun `sql.join` sur tableau vide** : les trois sites sont gardés
  (`revision.ts:68`, `:80`, `:149`).
- **Passation d'examen et quiz marketing public intouchés** :
  `getOpenExamQuestionIds` (`dal.shared.ts:146-161`) n'est pas modifié, et aucun
  fichier de `features/exams/actions.ts` / `app/(dashboard)/…/examen-blanc` n'est
  au diff.

---

## 4. Faux positifs écartés

| Suspecté                                                                                                                    | Écarté par                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOpenExamLockedQuestionIds` change de sémantique (filtre TS au lieu de SQL)                                              | `dal.shared.ts:106` conserve le retour anticipé sur liste vide ; `new Set(questionIds.filter(id => locked.has(id)))` est équivalent au `IN` SQL, doublons compris (le `Set` déduplique dans les deux versions). `tests/integration/exam-lock-source.test.ts:109-119` assert l'inclusion.                                                           |
| `questionCount: picked.length` fausse le score, l'historique, le dashboard                                                  | Les 7 lecteurs (`dal.ts:175,256,291,390,624,756`, `cron.ts:59-60`, `actions.ts:501`) utilisent tous cette colonne comme **dénominateur du nombre d'items**. `picked.length` est maintenant la valeur exacte ; auparavant elle ne pouvait qu'égaler la demande. C'est un durcissement, pas un biais.                                                |
| Le `superRefine` rend un champ obligatoire pour un appelant existant                                                        | `mode` était **déjà** requis dans le type de sortie avant la branche (`.default("test")` sur `z.infer`, cf. `git show main:features/training/schemas.ts:13`). `revisionFilters` est `.optional()`. Seuls appelants : le formulaire et les tests ; `tsc --noEmit` vert.                                                                             |
| `EMPTY_REVISION` consomme un jeton du rate-limit `MAX_SESSIONS_PER_HOUR`                                                    | Le `throw` de `actions.ts:195` remonte hors du `db.transaction` de `:139` → rollback complet, aucune ligne `training_sessions` insérée. Or le compteur est un `count(*)` sur cette table (`actions.ts:148-156`). Quota intact.                                                                                                                     |
| Le motif d'espacement JSX corrigé par `848072a` subsiste ailleurs (« Seulement {n} question… »)                             | `training-config-form.tsx:284-288` : l'interpolation est suivie de texte **sur la même ligne** (`{availableQuestions} question`), et la coupure tombe **après** le texte — la concaténation `question` + `{"s"}` est exactement l'effet voulu. Couvert par les tests `:190` et `:208`.                                                             |
| Un `answered_at` NULL gagne le `DISTINCT ON` (`ORDER BY … DESC` ⇒ NULLS FIRST) et fige un « raté »                          | Un seul écrivain de la colonne dans tout le repo, `actions.ts:350`, qui écrit toujours `selectedAnswer` + `answeredAt` ensemble ; le CTE filtre `selected_answer is not null` (`revision.ts:29`). Réserve honnête : d'éventuelles lignes héritées de la migration Convex ne sont pas vérifiables ici.                                              |
| IDOR sur `loadRevisionCounts` (userId depuis les arguments)                                                                 | `actions.ts:66` passe `session.user.id`, jamais `args`. `tests/integration/revision-corpus.test.ts:396-402` le vérifie explicitement.                                                                                                                                                                                                              |
| Un admin inspectant la session d'un étudiant voit **ses propres** signets                                                   | `features/training/dal.ts:570` (`isOwner`) et `:578` (`isOwner ? … : []`). Couvert indirectement par `tests/integration/question-bookmarks.test.ts:121-131`.                                                                                                                                                                                       |
| Le passe-plat d'arguments casse la CI                                                                                       | `.github/workflows/ci.yml:85` → `bun run test:integration` sans argument ⇒ `process.argv.slice(2)` vaut `[]` ⇒ ligne de commande identique à avant.                                                                                                                                                                                                |
| Les trois composants ne sont pas réellement entrés dans le rapport de couverture (`coverage.include` ne liste pas `app/**`) | Réfuté **empiriquement** : la table v8 de `bun run test:coverage` liste bien `…nt/_components` avec `…nfig-form.tsx`, `…on-client.tsx` et `…ti-select.tsx`. La revendication de `aff61da` est exacte.                                                                                                                                              |
| `revisionFilters` dupliqué (`["failed","failed"]`) casse le `OR`                                                            | `revision.ts:148` — `[...new Set(criteria)]`.                                                                                                                                                                                                                                                                                                      |
| Les tests de composants ne testent que de quoi passer la barre                                                              | Lus : `TrainingSessionClient.test.tsx:102-128` (hydratation + persistance + échec réseau via `callAction`), `:157-228` (révélation tuteur, échec de réponse, redirection, non-redirection) ; `TrainingConfigForm.test.tsx:73-151` (transmission des critères, décochage, corpus vide). Ce sont des assertions de comportement, pas du remplissage. |
| Le corpus peut inclure des questions supprimées                                                                             | `revision.ts:63` — `q.deleted_at is null` est le premier prédicat, inconditionnel.                                                                                                                                                                                                                                                                 |

**Non vérifiable dans ce périmètre** (à ne pas confondre avec un feu vert) : la
validité et le plan d'exécution réels du SQL brut de `revision.ts` — notamment
`count(*) filter (where <sous-requête corrélée>)` (`:110-112`) et le
`DISTINCT ON` sur un `UNION ALL` (`:37-39`) — n'ont pas été éprouvés, la
consigne interdisant toute commande de base de données. `tests/integration/revision-corpus.test.ts`
couvre ces chemins ; **exiger un run vert de `bun run test:integration` avant le
merge**, c'est le seul garde-fou de cette partie.

---

## 5. Verdict

> **Est-il sûr de pousser cette branche et d'ouvrir la PR vers `main` ? — OUI.**

Aucun constat bloquant : pas de fuite de clé de réponse par un canal réellement
atteignable depuis l'interface, pas d'IDOR, pas de corruption de données, pas de
contrôle d'accès cassé, et le chemin d'entraînement classique est bit à bit
inchangé. Le verrou anti-triche à la sélection — le cœur de la spec — est
réellement appliqué au tirage **et** aux compteurs, et il est gardé par des tests.

Le constat **#1** doit être corrigé **avant le merge** : c'est une ligne de SQL,
et il referme un canal latéral qui contredit une invariante que le code affirme
trois fois. Il n'est pas bloquant pour la **poussée** de la branche.

| Priorité                | Constat                                                                      | Effort  |
| ----------------------- | ---------------------------------------------------------------------------- | ------- |
| **Bloquant maintenant** | — (aucun)                                                                    | —       |
| **Avant merge**         | #1 `and s.status <> 'in_progress'` dans le CTE + test d'intégration dédié    | ~15 min |
| **Avant merge**         | Run vert de `bun run test:integration` (le SQL brut n'a pas été exécuté ici) | ~5 min  |
| **Avant merge**         | #3 `zod.safeParse` sur `loadRevisionCounts` (règle projet explicite)         | ~10 min |
| **Polish**              | #2 réintroduire la sélectivité `inArray` dans le verrou                      | ~20 min |
| **Polish**              | #4 remplacer `join("\|")`/`split("\|")` par une clé non ambiguë              | ~5 min  |
| **Polish**              | #5 trancher et documenter l'asymétrie admin                                  | ~5 min  |
| **Polish**              | #6 retirer `shell: true` de `scripts/test-integration.ts`                    | ~5 min  |
| **Backlog**             | #7 plafond de signets par utilisateur · #8 surveiller la marge de couverture | —       |

---

## 6. Confirmations de sûreté opérationnelle

- **Lecture seule respectée.** Aucun fichier source modifié. Le seul fichier écrit
  est ce rapport (`docs/superpowers/reviews/2026-08-02-revision-ciblee-implementation-review.md`),
  non commité — artefact jetable.
- **Aucune commande de base de données.** Ni `db:generate`, ni `db:migrate`, ni
  `test:integration` : aucune branche Neon n'a été créée ni détruite. Aucun outil
  MCP Neon appelé.
- **Aucun serveur de développement lancé.** Ni `bun dev`, ni `bun run start`, ni
  Playwright.
- **Commandes exécutées** (les seules) : `git log` / `git diff` / `git show`,
  `bun run check` (exit 0), `bun run test:coverage` (exit 0), plus des lectures et
  recherches de fichiers.
- **Aucun secret imprimé.** Aucun fichier `.env*` lu ni affiché.
- **Aucune commande destructive ni de déploiement.**
