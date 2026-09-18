# Revue adversariale — Lot 1, PR 1 (AttemptClock · ExamPhase · QuizBridge)

- **Date** : 2026-09-18
- **Périmètre** : `git diff main...HEAD` (6 commits `efc112c`…`5043936`), branche
  `refactor/attempt-clock-quiz-bridge`, 77 fichiers (+1288 / −1111).
- **Méthode** : lecture seule, hostile, chaque constat prouvé par `fichier:ligne`
  et confronté à `git show main:<fichier>` ; chaque intuition a été attaquée
  avant d'être gardée (section « faux positifs »). Aucun fichier source
  modifié, aucune base Neon touchée, aucun serveur lancé.
- **Gates** : `bun run check` → **exit 0** (prettier + tsc + eslint) ·
  `bun run test` → **exit 0** (142 fichiers, 1546 tests, 25,6 s).
  `bun run test:integration` **non lancé** (consigne), les 408 tests
  d'intégration ont été lus, pas exécutés.

## 1. Table des constats

| #   | Sév | fichier:ligne                                                                  | problème                                                                                                                                                                                            | régression ? |
| --- | --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | 🟠  | `features/exams/dal.student.ts:320` · `tests/integration/passation-anti-cheat.test.ts:204` | La garde `opts?.revealKey && isAdmin` — seule barrière entre la clé et la page étudiante `[examId]/page.tsx:73` qui passe `revealKey: true` — n'a **aucun** test ; le « filet » cité par `data-layer.md` appelle la DAL sans l'option. | NON (garde neuve, non testée) |
| 2   | 🟡  | `components/admin/exams-list.tsx:74,107` · `hooks/use-clock.ts:8-15`            | Les gardes d'édition / désactivation lisent `now` de `useClock` (rafraîchi toutes les 60 s, jamais au clic) ; `main` lisait `Date.now()` au clic. Fenêtre ≤ 60 s où un examen qui vient de démarrer se désactive **sans confirmation**. | **OUI** |
| 3   | 🟡  | `components/quiz/runner/use-exam-timer.ts:48` · `tests/components/quiz/use-exam-timer.test.ts` | Le câblage `pauseCreditMs: totalPauseDurationMs` a perdu son seul test : remplacer par `pauseCreditMs: 0` fait passer toute la suite (1546/1546). Le test « crédite totalPauseDurationMs » supprimé était le seul à l'attraper. | OUI (couverture) |
| 4   | 🟡  | `features/exams/actions.ts:867`                                                | Le seul changement de comportement nommé par la spec (grâce 5 s → 10 s à la finalisation manuelle) n'est vérifié par aucun test au point de câblage : `!isAutoSubmit && isExpired(...)` remplacé par `false` passe tous les tests (unitaires ET intégration lus). | NON (trou préexistant, mais la ligne modifiée est celle-là) |
| 5   | ℹ️  | `app/(admin)/admin/examens/_components/exam-form.tsx:539` · `app/api/e2e/route.ts:423` | Deux littéraux `15` de pause survivent (`value={[field.value \|\| 15]}` et la seed e2e) ; la spec annonce « les quatre littéraux 15 client » importés — il y en avait cinq côté client. | NON |
| 6   | ℹ️  | `app/(dashboard)/tableau-de-bord/_components/recent-activity-feed.tsx:42`      | Quatrième copie manuscrite de la règle « résultats après `endDate` sauf admin » (`isAdmin \|\| now >= exam.endDate`), non passée par `canReadResults`. Même borne, donc aucun écart de comportement — mais la spec dit « trois copies ». | NON |
| 7   | ℹ️  | `features/exams/dal.student.ts:308,320`                                        | `correctAnswer` est lu en base pour tous les appelants, y compris la passation étudiante (`level = null`), puis jeté par `toQuizQuestion`. Lecture inutile, **pas** de fuite (prouvé §3). | NON |
| 8   | ℹ️  | `tests/questions/quiz-bridge.test.ts:66-73`                                    | Titre « dans l'ordre des positions » mais l'assertion vérifie l'ordre d'**entrée** (`[1, 0]`) : `groupImages` ne trie pas, c'est le `orderBy` SQL de `fetchImages`. Titre trompeur. | NON |
| 9   | ℹ️  | `features/exams/schemas.ts:91` · `features/exams/actions.ts:867`               | Pour la PR 2 : `isAutoSubmit` est un booléen **client** qui exempte du budget à la finalisation (`actions.ts:653` l'assume). La table de politique « close : appliqué sauf auto-submit » ne doit pas hériter de cette confiance. | NON (préexistant) |

Aucun constat 🔴 : pas de fuite de clé, pas d'IDOR, pas de corruption, pas
d'auth cassée.

## 2. Détail par constat

### #1 🟠 — La garde `revealKey && isAdmin` n'est testée nulle part

**Code.**
- `features/exams/dal.student.ts:320` : `const level = opts?.revealKey && isAdmin ? "key" : null`.
- `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/page.tsx:73` : la page
  **étudiante** appelle `getExamWithQuestions(examId, { revealKey: true })`.
- `tests/integration/passation-anti-cheat.test.ts:204-206` : le test appelle
  `getExamWithQuestions(examId)` **sans** option → il exerce le chemin
  trivialement sûr (`level = null` quoi qu'il arrive).
- `git grep revealKey tests/` → **0 résultat**. Aucun test unitaire de
  `getExamWithQuestions` dans `tests/features/exams-dal-student.test.ts` (les
  `describe` couvrent `getExamSession`, `getParticipantExamResults`,
  `getExamQuestionExplanations`, tableau de bord).

**Pourquoi c'est un vrai trou.** Mutation mentale : supprimer `&& isAdmin` à la
ligne 320. Résultat : la page étudiante livrerait la clé de toutes les questions
d'un examen clos (et, le DAL servant aussi la revue, d'un examen encore ouvert
pour un étudiant ayant un accès). **Tous les tests actuels passent quand même**,
le filet nommé par `.claude/rules/data-layer.md` compris. C'est exactement « un
test qui passe que la garde existe ou non ». La PR 2 va empiler sur cette DAL.

**Régression ?** NON — sur `main` la clé partait via `...(isAdmin ? {…} : {})`,
également non testée pour l'admin ; mais `main` n'avait pas d'option qu'une page
étudiante active.

**Comment je l'ai prouvé.** `grep -rn revealKey tests/` (vide) ;
lecture de `passation-anti-cheat.test.ts:204-215` ; lecture de
`exams.test.ts:329-335` (« masque correctAnswer pour l'étudiant », sans option).

**Correctif.** Paire jumelle dans `tests/integration/exams.test.ts` (ou
`passation-anti-cheat.test.ts`) :
`asStudent(); getExamWithQuestions(id, { revealKey: true })` → aucune
`correctAnswer` ; `asAdmin(); même appel` → `correctAnswer` présente. Mettre à
jour la phrase de `data-layer.md` (« le filet ») une fois le test écrit.

### #2 🟡 — Gardes admin au clic sur une horloge de 60 s

**Code.**
- `hooks/use-clock.ts:8-15` : `useState(initialNow)` puis `setInterval(…, 60_000)`.
  Aucun tick immédiat : de l'hydratation à +60 s, `now` = instant du rendu
  serveur.
- `components/admin/exams-list.tsx:74` : `if (phaseOf(exam, now) === "active")`
  → modale de confirmation, **sinon** `performDeactivate(exam.id)` immédiat.
- `components/admin/exams-list.tsx:107` : même chose pour l'édition (modale
  d'avertissement vs `router.push` direct).
- `main` : `git show main:lib/exam-status.ts:39` → `const now = Date.now()`
  **dans** `getExamStatus`, donc évalué au clic.

**Déclencheur concret.** Examen `startDate = T`. L'admin ouvre la liste à
`T − 30 s` (badge « À venir », correct). À `T + 20 s` il clique « Désactiver » :
`now` vaut encore `T − 30 s` → phase `upcoming` → **désactivation sans
confirmation** alors que des étudiants ont pu démarrer. Sur `main`, `Date.now()`
donnait `active` → modale. Même fenêtre pour « Modifier ».

**Régression ?** OUI, bornée à 60 s. Sévérité basse : c'est une confirmation UX,
pas une garde serveur (`deactivateExam` n'a pas de garde de phase, ni avant ni
après). Le badge et le filtre, eux, peuvent rester sur `now` (rendu).

**Comment je l'ai prouvé.** Diff `components/admin/exams-list.tsx` ; lecture de
`hooks/use-clock.ts` (pas de tick à `0`) ; `git show main:lib/exam-status.ts`.

**Correctif.** Dans les deux handlers (hors rendu, donc sans contrainte
`react-hooks/purity` ni hydratation) : `phaseOf(exam, Date.now())`. Garder
`now` pour le rendu. Optionnel : ajouter un tick immédiat dans `useClock` — ça
ne suffit pas seul (la fenêtre de 60 s entre deux ticks reste).

### #3 🟡 — Le câblage du crédit de pause dans `useExamTimer` n'a plus de test

**Code.** `components/quiz/runner/use-exam-timer.ts:44-51` :
`clockRemainingMs({ startedAt: serverStartTime, budgetSeconds: totalSeconds, pauseCreditMs: totalPauseDurationMs }, at)`.

**Mutation qui survit.** Remplacer `pauseCreditMs: totalPauseDurationMs` par
`pauseCreditMs: 0` :
- `tests/components/quiz/use-exam-timer.test.ts` : les tests restants (tick,
  one-shot d'expiration, gel/dégel, zone) utilisent tous `totalPauseDurationMs: 0`.
- `tests/components/quiz/exam-timer-hydration.test.tsx` : idem (`grep` → que des `0`).
- `tests/components/quiz/use-quiz-session.test.ts:587-625` (« resume() applique
  le totalPauseDurationMs serveur ») : n'asserte que `afterTick < beforeTick`,
  jamais la valeur — un crédit ignoré passe.
- Le test supprimé par ce diff, « crédite totalPauseDurationMs : le temps en
  pause ne décompte pas » (`remainingMs === 40_000`), était le **seul** à casser.

**Régression ?** OUI, de couverture : la spec a choisi de ne garder au hook que
« tick, one-shot, gel, hydratation », mais le hook fait un **mapping** de props
vers `AttemptTiming`, et `tests/lib/attempt-clock.test.ts` ne prouve que la
formule, pas que le hook lui passe la bonne valeur. Le même raisonnement a
fait garder un test d'intégration antidaté côté serveur ; il vaut aussi ici.

**Correctif.** Réintroduire un seul test au hook : `totalPauseDurationMs: 20_000`,
`serverStartTime: now − 40_000`, `totalSeconds: 60` → `remainingMs === 40_000`
(le test supprimé, tel quel).

### #4 🟡 — La grâce de 10 s à la finalisation n'est vérifiée par aucun test

**Code.** `features/exams/actions.ts:867` :
`if (!isAutoSubmit && isExpired(timing, now)) throw new Error("TIME_UP")`.

**Preuve du trou.**
- `tests/features/exams-actions.test.ts:545-570` (« finalizeExam — mapping des
  refus ») : `rejectWith("TIME_UP")` → teste le mapping code → message, pas la
  décision.
- `tests/integration/exam-runner.test.ts:377-404` : `finalizeExam({ isAutoSubmit: true })`
  après budget (exempté) et `finalizeExam({ isAutoSubmit: false })` à
  `backdate 1 000 ms` (« dans les temps »). Aucun `finalizeExam` manuel
  **après** budget.
- Mutation : `isExpired(timing, now)` → `false` à la ligne 867 : tous les tests
  passent. Le fichier `exams-actions.test.ts` n'est pas dans le diff → le trou
  est préexistant, mais c'est la ligne que le lot modifie (5 s → 10 s).

**Régression ?** NON. Mais un refactor « un seul propriétaire » dont le seul
changement de comportement nommé n'a pas de test au point de câblage n'est pas
verrouillé.

**Correctif.** Dans `exam-runner.test.ts` (déjà équipé de `makeStartedExam(backdateMs)`),
deux cas : `backdate = 332_000 + 7_000` → `finalizeExam({ isAutoSubmit: false })`
succès ; `backdate = 332_000 + 11_000` → `TIME_UP`. Ou en unitaire avec
`vi.setSystemTime` comme pour `saveExamAnswer` (`exams-actions.test.ts:436`).

### #5 ℹ️ — Deux littéraux `15` survivent

**Code.** `exam-form.tsx:539` `value={[field.value || 15]}` (slider) ;
`app/api/e2e/route.ts:423` `pauseDurationMinutes: opts.enablePause ? 15 : null`.
**Preuve.** `git grep -n "\b15\b" main -- 'app/**' 'components/**'` filtré :
six sites client de pause sur `main` (`exam-form:145,203,535`,
`exam-side-panel:223`, `evaluation-client:83`, `quiz-runner:51`) ; cinq
migrés. **Correctif.** `DEFAULT_PAUSE_DURATION_MINUTES` (déjà importé dans le
formulaire, ligne 71) et `DEFAULT_PAUSE_MINUTES` dans la route e2e.

### #6 ℹ️ — Quatrième copie de la règle de visibilité

**Code.** `recent-activity-feed.tsx:42` : `exam.isCompleted && (isAdmin || now >= exam.endDate)`.
**Preuve.** `git grep` des comparaisons sur `endDate` (HEAD) : `canReadResults`
à `dal.student.ts:530,891` et `[examId]/page.tsx:83` ; cette quatrième reste
manuscrite. `now >= endDate ⟺ !isOpen` donc aucun écart. **Correctif.**
`canReadResults(exam, isAdmin ? { role: "admin" } : null, now)` — ou laisser,
mais corriger la spec (« trois copies »).

### #7 ℹ️ — `correctAnswer` lu puis jeté en passation

**Code.** `dal.student.ts:308` (select) et `:320-328` (`toQuizQuestion(i, …, level)`).
**Preuve qu'il n'y a pas de fuite.** `quiz-bridge.ts:54-62` : `statement` est
construit champ par champ, sans spread de `row` ; `if (level === null || …) return statement`.
`items` est une variable locale, jamais renvoyée ni loguée
(`grep -n "items" dal.student.ts:303-345`). `lock.reveal`
(`answer-key-lock.ts:76-90`) construit aussi ses retours champ par champ.
**Correctif (facultatif).** Deux branches typées (`level` connu avant le
`select`) pour ne pas lire la colonne côté étudiant — la surcharge
`toQuizQuestion(row: StatementRow, …, level: null)` existe déjà pour ça.

### #8 ℹ️ — Titre de test trompeur

`tests/questions/quiz-bridge.test.ts:66` annonce « dans l'ordre des positions »
et asserte `[1, 0]` (ordre d'entrée). Renommer « préserve l'ordre d'entrée (le
tri est celui de `fetchImages`) ».

### #9 ℹ️ — `isAutoSubmit` client, à ne pas reconduire en PR 2

`features/exams/schemas.ts:91` (`isAutoSubmit: z.boolean().optional()`) et
`actions.ts:867`. Un étudiant peut envoyer `isAutoSubmit: true` pour finaliser
hors budget ; `actions.ts:653` l'assume (« flag client ») et compte sur
`saveExamAnswer` pour bloquer les réponses. La table de politique de la spec
(« close : appliqué sauf auto-submit ») doit dériver l'auto-submit de l'horloge
serveur (`isExpired` ⇒ statut `auto_submitted`), pas du client.

## 3. Faux positifs écartés

| Suspecté                                                                                                   | Écarté par                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toQuizQuestion` fait fuir `correctAnswer` via `{ ...row, correctAnswer }` (`quiz-bridge.ts:67`)          | Ce spread est l'**argument** de `lock.reveal`, qui ne renvoie que des champs nommés (`answer-key-lock.ts:81-89`). Le retour du mappeur est `{ ...statement, ...reveal }`, jamais `...row`.                                                          |
| Chemin `level === null` renvoie `row` par mégarde                                                          | `quiz-bridge.ts:62` renvoie `statement`, objet construit lignes 54-61 sans `correctAnswer`. Test `quiz-bridge.test.ts:20-29` (`toEqual` strict).                                                                                                    |
| `import type { Revealed }` charge `answer-key-lock` (donc `@/db`) dans un bundle client ou un test happy-dom | `runner/types.ts:1` est `import type` ; `tsconfig.json:13` `isolatedModules: true` → élision garantie par SWC/esbuild. Le même patron existe déjà 15× (`components/admin/exam-card.tsx:5` `import type … from "@/features/exams/dal"`, server-only). |
| `@/features/exams/schemas` tire du serveur dans le bundle client via `quiz-runner.tsx:16` / `schemas/exam.ts` | `features/exams/schemas.ts:1` n'importe que `zod`. Aucun `server-only`, aucun `@/db`.                                                                                                                                                              |
| `saveExamAnswer` a changé de grâce                                                                         | `main` : `SAVE_GRACE_MS = 10_000`, `elapsed > completionTime*1000 + SAVE_GRACE_MS` ; HEAD : `isExpired` = `elapsed > budget*1000 + GRACE_MS (10_000)`. Identique, exemption admin conservée (`actions.ts:686`).                                    |
| `finalizeExam` : crédit de pause en cours calculé différemment                                             | `main` : `pauseMs += Math.min(now − pauseStartedAt, capMs)` ; HEAD : `Math.min(Math.max(0, …), cap)`. Seul un delta négatif (horloge serveur en arrière) diverge — et HEAD est le plus sûr. `pauseMs` persiste toujours dans `totalPauseDurationMs` (`actions.ts:890`). |
| `resumeExam` : plafond de pause perdu                                                                      | `actions.ts:1028-1037` : `pauseCredit({ pauseCreditMs: p.total ?? 0, pauseInProgress: { capMinutes: exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES } })` = `min(…, cap)` de `main`.                                                              |
| `useExamTimer` : clamp de l'élapsé négatif perdu                                                           | `attempt-clock.ts:44-47` : `Math.min(budgetMs, Math.max(0, …))` = la formule de `main:use-exam-timer.ts:51`. Test `attempt-clock.test.ts:27-34`.                                                                                                     |
| `PauseDialog` : mismatch d'hydratation au rechargement en pause                                            | L'initialiseur (`pause-dialog.tsx:40-47`) est pur sur les props ; `initialNow` et `pauseStartedAt` viennent du payload RSC. `main` partait de `useState(0)` (« 00:00 » au premier paint) — HEAD est meilleur. Test `renderToString` à `PauseDialog.test.tsx:107-121`. |
| `PauseDialog` : `pauseStartedAtMs` absent → `Date.now()` SSR ≠ client                                     | `quiz-runner.tsx:64-66` (préexistant). Les deux côtés donnent `min(cap, cap − (initialNow − X))` = `cap` → même texte « 15:00 ». Pas de mismatch.                                                                                                     |
| `pauseRemainingMs` borné au plafond casse l'auto-resume                                                    | `pause-dialog.tsx:75` : `remaining <= 0` ; le plafond ne borne que vers le haut. Test « reprend automatiquement, une seule fois » (`PauseDialog.test.tsx:123-142`).                                                                                  |
| `partition` classe différemment qu'avant                                                                   | `main:examen-blanc-client.tsx:414-420` : `active = isActive && start ≤ now ≤ end`, `upcoming = isActive && now < start`, `past = isActive && now > end`. HEAD : identique sauf `now === end` (voulu). Bonus : un examen `start > end` n'apparaît plus dans deux listes. |
| Un consommateur de `getExamStatus`/`isExamClosed` dépendait de l'inclusivité à `endDate`                    | Sur `main`, la borne était **déjà** incohérente : `getParticipantExamResults` (`Date.now() < endDate → null`) et `recent-activity-feed` (`now >= endDate`) rendaient les résultats **à l'instant exact**, tandis que `getExamStatus`/`isExamClosed` disaient « actif ». HEAD unifie sur la borne du verrou SQL (`lockFor`, `answer-key-lock.ts:112`). Seuls `dal.admin.ts:138` et `users/dal.ts:840` (compteurs SQL, `endDate >= now`) restent inclusifs — 1 ms, préexistant. |
| `_creationTime` avait un consommateur dans le pont                                                         | `git grep _creationTime main` : les seuls usages sont `user-table-row`, `question-browser` (types propres) et `types/index.ts` (examen). Aucun composant quiz ne le lisait.                                                                          |
| « cinq `as never` », « trois `currentTimeMs` », « six mappings »                                            | `git grep "as never" main -- app components` → 5 ; HEAD → 0. `git grep "currentTimeMs\s*=" main` → 3 copies ; HEAD → `lib/clock.ts` seul. Six mappings : entraînement passation/résultats, examen passation/résultats/résultats admin, quiz marketing — tous dans le diff, tous retirés. |
| Les mappings de pages filtraient un champ que la DAL livre maintenant                                       | Résultats examen (étudiant + admin) : `main` ne projetait que `correctAnswer`/`keyWithheld` ; la DAL est en niveau `"key"` → mêmes champs. Résultats entraînement : `main` projetait tout, `explanationImages ?? []` ; la DAL est en `"correction-with-images"` → `explanationImages: row.explanationImages ?? []`. Passation entraînement : `main` omettait `explanationImages` ; niveau `"correction"` ne le produit pas. Passation examen : `main` ne gardait que l'énoncé ; `level = null`. Aucun champ ajouté ni perdu. |
| Un admin en passation ne reçoit plus `correctAnswer` (`evaluation/page.tsx:27`, sans `revealKey`)          | Vrai, mais aucun consommateur : `QuizRunner` en `variant="exam"` ne lit `correctAnswer` que via `withReveal` (reveal serveur). Changement pour admin seul, non-régressif.                                                                              |
| `QuestionCard` : `correctAnswer ?? ""` change le marquage                                                  | `question-card/index.tsx:497-510` : `""` ne matche aucune option — même effet que l'`undefined` que `as never` laissait passer sur `main`.                                                                                                            |
| Grâce 10 s exploitable à la finalisation (Q8)                                                             | `saveExamAnswer` refusait déjà à budget + 10 s sur `main` ; une réponse à +7 s passait déjà. Et `isAutoSubmit: true` (client) exempte totalement — le manuel est le chemin le plus faible des deux. Rien de nouveau n'est gagné.                        |
| `useClock` ignore un nouveau `initialNow` après `router.refresh()`                                         | `useState(initialNow)` ne se resynchronise pas, mais l'interval continue ; `main:examen-blanc-client.tsx:402-409` avait exactement ce comportement. Pas une régression (voir #2 pour le vrai problème).                                                |
| `fetchImages` sans `.limit` viole « reads bornés »                                                         | Préexistant (`main:dal.shared.ts:32-50`), justifié en commentaire (`quiz-bridge.ts:92-94`) : borné par le lot appelant (≤ `MAX_EXAM_QUESTIONS`).                                                                                                      |
| `tests/lib/exam-status.test.ts` supprimé sans équivalent                                                   | `tests/lib/exam-phase.test.ts` reprend chaque cas (inactif prioritaire, ±1 ms aux deux bornes, dates incohérentes) avec `now` injecté au lieu de `vi.setSystemTime`. La seule assertion inversée (« completed at exact end time » → `active` sur `main`) est le changement voulu. |

## 4. Réponses aux questions ouvertes

1. **`import type { Revealed }` dans `runner/types.ts`.** Sûr. `import type`
   est élidé (`isolatedModules: true`), aucun `require` n'est émis ; ni bundle
   client ni happy-dom ne chargent `answer-key-lock`. Les 142 fichiers de test
   passent, y compris ceux qui importent `runner/types` sous happy-dom sans
   mocker `@/db`. En revanche la spec se trompe en le présentant comme « premier
   import `components → features` d'un module server-only » : `git grep`
   montre 15 `import type … from "@/features/…/dal"` déjà dans `components/`
   (`exam-card.tsx:5`, `exams-list.tsx:25`, `session-results.tsx:29`…) — c'est
   le patron documenté de `data-layer.md`. Pas un précédent, une continuité.

2. **`revealKey: true` depuis la page étudiante.** La DAL rend bien la fuite
   impossible : `dal.student.ts:320` exige `isAdmin` (issu de la session
   serveur), et `toQuizQuestion(…, null)` construit l'énoncé sans spread. La
   page de passation (`evaluation/page.tsx:27`) n'y passe pas. **Mais** cette
   garde n'a aucun test (constat #1) : la sûreté est vraie aujourd'hui et
   invisible pour le prochain refactor. Je ne l'approuve pas sans la paire
   jumelle.

3. **`pauseRemainingMs` borné et `initialNow` conditionnel.** Aucun cas faux
   au premier paint, aucun mismatch : (a) rechargement en pause → SSR et
   hydratation calculent la même valeur depuis les mêmes props RSC, et `main`
   affichait « 00:00 » pendant un tick ; (b) pause en cours de session →
   `initialNow` absent, ancre = `pauseStartedAt` → plafond, corrigé par le tick
   immédiat de l'effet (`pause-dialog.tsx:81`) ; ce n'est même pas un premier
   paint « faux » : la pause vient de commencer ; (c) `pauseStartedAtMs`
   absent → repli `Date.now()` préexistant, les deux côtés donnent le plafond.
   Le conditionnel `initialPause?.isPaused ? … : undefined`
   (`quiz-runner.tsx:206-208`) est d'ailleurs superflu : passer toujours
   `mode.timer?.initialNow` donnerait le même résultat (ancre antérieure au
   début de pause → plafond, test `attempt-clock.test.ts:124-128`). À
   simplifier ou à laisser, sans enjeu.

4. **`isOpen = now < endDate`.** J'ai listé tous les consommateurs de
   `getExamStatus`/`isExamClosed` sur `main` (6 sites) et toutes les
   comparaisons sur `endDate`. Aucun ne dépendait de l'inclusivité ; pire,
   `main` était déjà incohérent à l'instant exact (résultats lisibles côté DAL
   pendant que le badge disait « en cours »). L'alignement sur `end_date > now()`
   du verrou est la bonne décision. Reste 1 ms d'écart dans les deux compteurs
   SQL (`dal.admin.ts:138`, `users/dal.ts:840`, `endDate >= now`) — hors lot,
   sans conséquence.

5. **`useClock` (60 s) et les gardes d'édition.** Oui, un admin peut
   contourner la modale pendant jusqu'à 60 s après le démarrage (constat #2),
   là où `main` lisait l'horloge au clic. Un tick au clic est nécessaire :
   `phaseOf(exam, Date.now())` dans les deux handlers (hors rendu, donc sans
   enjeu d'hydratation ni de `react-hooks/purity`). `now` reste pour le badge
   et le filtre.

6. **`correctAnswer` lu puis jeté.** Lecture inutile, pas un risque : aucune
   trace (`console.log`, Sentry), aucun spread, `items` jamais sérialisé
   (constat #7). La surcharge `level: null` de `toQuizQuestion` permet deux
   branches typées si on veut économiser la colonne ; finition.

7. **Ré-export des bornes de pause via `schemas/exam.ts`.**
   `features/exams/schemas.ts` n'importe que `zod` — aucun import serveur
   transitif. `quiz-runner.tsx:16` et `evaluation-client.tsx:37` importent
   déjà la valeur directement, sans incident. Sûr.

8. **Grâce unique 10 s.** Non exploitable : `saveExamAnswer` tolérait déjà
   10 s sur `main`, donc une réponse à budget + 7 s passait déjà ; la
   finalisation manuelle à +7 s réussit maintenant au lieu d'échouer, ce qui
   ne donne rien de plus que ce que l'auto-submit (flag **client**,
   `schemas.ts:91`) donnait déjà sans limite. Le vrai sujet est ce flag
   (constat #9), pour la PR 2. Ce que le lot doit encore faire : tester la
   nouvelle borne au point de câblage (constat #4).

## 5. Verdict

**Peut-on ouvrir la PR et empiler la PR 2 (#188) sur cette base ? OUI.**

Le refactor est fidèle à `main` ligne par ligne sur les trois points de parité
demandés ; les seuls changements de comportement sont ceux que la spec nomme
(grâce 10 s, borne `endDate`, clé jointe sur `revealKey`). Aucun bloquant :
pas de fuite de clé, pas d'auth cassée, pas de corruption, pas de course
introduite. Les constats sont des trous de test sur des gardes neuves ou
déplacées, et une fenêtre de 60 s sur une confirmation admin.

Ce qui doit être fait **avant le merge** (pas avant l'ouverture) : #1, #2, #3,
#4 — ce sont quatre tests et un `Date.now()` ; la PR 2 va s'appuyer sur
`getExamWithQuestions` et `AttemptClock`, il faut qu'ils soient verrouillés
avant d'y empiler `requireAttempt`.

| Priorité             | Correctifs                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloquant maintenant  | — (rien)                                                                                                                                                                   |
| Avant le merge       | #1 paire jumelle `revealKey` admin/étudiant · #2 `phaseOf(exam, Date.now())` dans `handleEdit`/`handleDeactivate` · #3 réintroduire le test « crédite totalPauseDurationMs » · #4 deux cas `finalizeExam` manuel à budget + 7 s / + 11 s |
| Finition             | #5 deux littéraux `15` · #6 `canReadResults` dans `recent-activity-feed` (ou corriger « trois copies ») · #7 deux branches typées · #8 titre du test `groupImages` · spec : retirer « premier import components → features » · `quiz-runner.tsx:206` conditionnel superflu |
| À porter en PR 2     | #9 ne pas faire confiance à `isAutoSubmit` client dans la politique `close`                                                                                                 |

## 6. Confirmations de sécurité opérationnelle

- **Lecture seule** : uniquement `git diff`, `git show`, `git grep`, `grep`,
  `sed -n`, `cat`, `ls`. Aucun fichier source, test, doc ou config modifié ;
  le seul fichier écrit est ce rapport. `git status` reste propre hors ce
  fichier.
- **Gates** : `bun run check` et `bun run test` (jamais `bun test`), sorties
  capturées dans le scratchpad de session. `bun run test:integration` **non
  lancé** — aucune branche Neon créée.
- **Aucune base Neon touchée** (ni `main`/prod ni `develop`) : aucun appel MCP
  Neon, aucune connexion.
- **Secrets** : aucun `.env*` lu ni imprimé.
- **Aucun serveur de dev lancé, aucune commande destructive, aucun déploiement,
  aucun commit** — le rapport n'est pas commité, la session demandeuse décide.
