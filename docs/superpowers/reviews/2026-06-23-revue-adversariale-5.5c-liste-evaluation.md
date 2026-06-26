# Revue antagoniste — 5.5c (liste examens + passation/évaluation)

- **Date** : 2026-06-23
- **Périmètre** : `git diff f353595..HEAD` (2 commits) sur `migration/drizzle-neon`
  - `9b98662` 5.5c-liste — `/dashboard/examen-blanc` (Server Component + `_components/examen-blanc-client.tsx`)
  - `aa43590` 5.5c-évaluation — `examen-blanc/[examId]/evaluation` (Server Component + `_components/evaluation-client.tsx`)
  - **4 fichiers UI uniquement** ; `features/exams/{dal,actions,schemas}.ts`, `lib/exam-timer.ts`, `lib/exam-storage.ts` **inchangés dans le range** (vérifié `git diff --name-only`).
- **Méthode** : lecture seule, hostile, chaque constat prouvé par lecture du code (`fichier:ligne`) ; source de vérité = implémentation Convex récupérée via `git show f353595:<chemin>` ; chaque bug suspecté soumis à réfutation avant d'être gardé.
- **Gates** :
  - `bun run check` (`tsc --noEmit && eslint --max-warnings 0`) → **exit 0** ✅
  - `bun run build` → **exit 0** ✅
  - `bun run test:integration` non lancé (delta = composants UI + pages ; DAL/actions inchangés et couverts par 98 tests — hors périmètre).

---

## 1. Tableau des constats (trié par sévérité)

| #   | Sév | fichier:ligne                                              | problème                                                                                                                                                                                                                                          | Régression ?         |
| --- | --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | 🔴  | `evaluation-client.tsx:160` + `:226-229`                   | **Perte de réponses** : reprise/F5 avec timer déjà écoulé → `handleAutoSubmit` soumet `answers` (state vide à ce stade) au lieu des réponses du localStorage → score 0 + localStorage purgé.                                                      | **OUI**              |
| 2   | 🟡  | `evaluation-client.tsx:117`                                | `showWarningDialog = !initialSession` → examen déjà soumis : l'UI complète d'examen (timer plein, Q1) **flashe** une frame sans l'overlay d'avertissement avant le redirect.                                                                      | **OUI** (cosmétique) |
| 3   | 🟡  | `examen-blanc/page.tsx:16` + `examen-blanc-client.tsx:381` | Éligibilité calculée **une seule fois** au rendu serveur (prop figée) vs recalcul live toutes les 60 s côté Convex ; un accès qui expire pendant la consultation laisse le bouton « Commencer » actif (le serveur refuse toujours à `startExam`). | **OUI** (UX, sûr)    |
| 4   | ℹ️  | `dal.ts:139` (lecture)                                     | Liste bornée à 100 examens (`startDate desc`) ; au-delà, les plus anciens passés disparaissent. Conforme aux règles projet (queries bornées).                                                                                                     | Acceptable           |

---

## 2. Détail par constat

### 🔴 #1 — Perte de réponses à la reprise quand le temps est déjà écoulé

**Code**

- `evaluation-client.tsx:155-199` — `handleAutoSubmit` construit le payload **depuis le state `answers`** :
  ```ts
  const formattedAnswers = Object.entries(answers).map(...)   // :160
  const result = await submitExamAnswers({ examId, answers: formattedAnswers, isAutoSubmit: true })
  ```
- `evaluation-client.tsx:204-232` — effet d'init (one-shot via `didInitRef`) :
  ```ts
  if (isInProgress(initialSession) && initialSession.startedAt) {
    const rem = calculateTimeRemaining(initialSession.startedAt, exam.completionTime, Date.now())
              - (initialSession.totalPauseDurationMs ?? 0)
    if (rem <= 0) { handleAutoSubmit(); return }   // :226-229
    ...
  }
  ```
- `evaluation-client.tsx:146-152` — la restauration localStorage passe par `startTransition(() => setAnswers(saved))` (mise à jour **non-urgente, différée**).

**Pourquoi c'est un vrai bug (déclencheur concret)**
Au montage (reprise / F5) d'une session `in_progress` dont le temps est déjà dépassé :

1. Render 1 : `answers = {}`. `handleAutoSubmit` est mémoïsé en capturant cette clôture (`answers={}`).
2. Flush des effets (ordre de déclaration) : l'effet de restauration localStorage planifie `setAnswers(saved)` **en transition** (différé) ; puis l'effet d'init appelle `handleAutoSubmit()`.
3. `handleAutoSubmit` exécute `Object.entries(answers)` **synchronement avant le premier `await`** → lit `{}` → payload `[]`.
4. `submitExamAnswers` avec `isAutoSubmit:true` accepte (aucun contrôle de temps pour l'auto-submit, `actions.ts:553`), enregistre **score 0, zéro réponse**, statut `auto_submitted`.
5. Branche succès : `clearAnswersFromStorage(examId)` (`:171`) **purge le localStorage** → réponses définitivement perdues, et toast trompeur « Vos réponses ont été enregistrées automatiquement » (`:172`).

`didInitRef` garantit que l'effet ne re-tourne pas : même quand la restauration `answers` se commit ensuite et qu'une nouvelle clôture `handleAutoSubmit` existe, **elle n'est jamais rappelée**. La perte est irréversible.

**Régression : OUI.** L'implémentation Convex traitait ce cas explicitement — `old_eval_page.tsx:161-208` rechargeait les réponses depuis le localStorage **dans la branche d'expiration elle-même** avant de soumettre :

```ts
const savedAnswers = loadAnswersFromStorage(examId)
const formattedAnswers = hasAnswers ? Object.entries(savedAnswers).map(...) : []
submitAnswers({ examId, answers: formattedAnswers, isAutoSubmit: true })
```

Le refactor a fusionné ce chemin dans `handleAutoSubmit` (qui ne lit que le state) sans réintroduire la lecture localStorage.

**Déclencheur réaliste** : l'étudiant rafraîchit / re-navigue vers la page près de la fin ; le rechargement aboutit après l'expiration → soumission vide. (Le cas « page restée montée, timer expire » n'est PAS touché : l'intervalle du timer appelle `handleAutoSubmit` avec `answers` peuplé — OK.)

**Correctif suggéré** : dans la branche `rem <= 0` de l'effet d'init (ou en tête de `handleAutoSubmit`), hydrater depuis le localStorage avant de soumettre — p.ex. soumettre `loadAnswersFromStorage(examId)` fusionné avec `answers`, à l'image de l'ancien `initializeSession`. Idéalement, faire de `handleAutoSubmit` un lecteur du localStorage en dernier recours quand `answers` est vide.

---

### 🟡 #2 — Flash de l'UI d'examen pour une session déjà soumise

**Code** — `evaluation-client.tsx:117`

```ts
const [showWarningDialog, setShowWarningDialog] = useState(!initialSession)
```

`!initialSession` n'est vrai que si **aucune** participation n'existe. Pour une session `completed`/`auto_submitted`, `initialSession` est truthy → `showWarningDialog = false`. `resuming` est faux (statut non `in_progress`) → `serverStartTime = null`, `timeRemaining = exam.completionTime*1000`.

**Pourquoi c'est un vrai bug**
React peint le commit (UI complète : `SessionHeader` timer plein, `QuestionCard` Q1, navigation) **avant** le flush des effets. L'effet d'init (`:209-217`) ne déclenche `router.push("/dashboard/examen-blanc")` qu'ensuite. Donc ≥1 frame affiche le contenu d'examen **sans overlay**, avec un chrono « neuf », puis redirige.

**Régression : OUI (cosmétique).** Convex initialisait `showWarningDialog = true` **toujours** (`old_eval_page.tsx:65`) ; la frame transitoire montrait l'overlay d'avertissement, pas le contenu.

**Pas de fuite** : `getExamWithQuestions` masque `correctAnswer` pour les non-admins (`dal.ts:264`) ; le `QuestionCard` est en `variant="exam"` `showCorrectAnswer={false}` ; le timer ne tourne pas (`serverStartTime` null). C'est strictement un défaut visuel.

**Correctif suggéré** : `useState(initialSession == null || isInProgress(initialSession) ? !isInProgress(...) : true)` — ou plus simple, afficher un overlay neutre (spinner « Redirection… ») tant que `didInitRef` n'a pas statué pour les sessions terminées.

---

### 🟡 #3 — Éligibilité figée au rendu serveur (vs live Convex)

**Code**

- `examen-blanc/page.tsx:16` : `const isEligible = isAdmin || (await hasAccess("exam"))` — calculé une fois, passé en prop.
- `examen-blanc-client.tsx:381-385,557` : `isEligible` est une prop statique, réutilisée pour chaque carte.

**Pourquoi c'est une divergence**
Convex recalculait l'éligibilité côté client à chaque tick : `isUserEligible()` comparait `userAccess.expiresAt > now`, et `now` avançait toutes les 60 s (`old_list_page.tsx:490-494,440-445`). Si l'accès expirait pendant la consultation, le bouton basculait sur « Non éligible ». En Drizzle, la prop reste figée jusqu'au prochain `router.refresh()`/navigation → le bouton « Commencer » reste actif après expiration.

**Régression : OUI mais sûre.** L'autorité reste le serveur : `startExam` revérifie `hasAccess("exam")` et renvoie « Votre accès aux examens a expiré. » (`actions.ts:372-374`), et `submitExamAnswers` revérifie aussi (`actions.ts:532-546`). L'utilisateur peut cliquer mais ne peut pas réellement passer l'examen. Impact = UX (clic mort + redirect), pas de contournement d'accès payant.

**Correctif suggéré** : optionnel. Si l'on veut la parité d'UX, dériver l'éligibilité d'un `expiresAt` passé en prop comparé au `now` client (déjà mis à jour toutes les 60 s pour le reclassement actif/à venir/passé). Sinon, acceptable en l'état.

---

### ℹ️ #4 — Borne de 100 sur la liste

`getExamsWithParticipation` (`dal.ts:121-139`) borne à 100 examens (`orderBy startDate desc`). Au-delà, les examens passés les plus anciens n'apparaissent plus dans « Terminés ». Conforme à la règle projet « toujours borner les `.collect()` ». Noté pour mémoire ; non bloquant (100 examens blancs = horizon large).

---

## 3. Faux positifs écartés (suspecté → blanchi, avec preuve)

- **Hydration mismatch via `initialNow`** — _blanchi._ `page.tsx:6,30` calcule `currentTimeMs()` hors composant (purity OK) et passe `initialNow` en prop ; `timeRemaining`/`now` s'initialisent via `useState(() => …initialNow…)` (`evaluation-client.tsx:104-115`, `examen-blanc-client.tsx:388`). Serveur et 1er render client utilisent **la même** valeur sérialisée → pas de mismatch. Le décalage serveur↔client n'affecte que l'affichage 1 s avant le 1er tick `Date.now()` ; le budget-temps fait foi côté serveur (`actions.ts:548-555`). Non exploitable.

- **Fuite d'UI pause avant `startExam` (suppression de `getPauseStatus`)** — _blanchi._ Tous les éléments pause sont gatés sur `pausePhase` (= `"before_pause"`/`"during_pause"`/`"after_pause"`), pas sur `exam.enablePause` seul : early-pause header (`:521-524`), `PauseApproachingAlert` (`:534-535`), bouton mobile (`:643`), indicateur « Partie 1/2 » (`:596`). À l'état initial sans session, `pausePhase = undefined` (`:125-127`) → tout masqué. L'effet d'auto-trigger sort tôt sur `!serverStartTime` (`:310`). `exam.enablePause` reproduit exactement la valeur de l'ancien `pauseStatus.enablePause` (même colonne, `dal.ts:409`). Aucune fuite.

- **`PauseDialog` toujours monté (vs conditionnel Convex)** — _blanchi._ `pause-dialog.tsx:52-53` sort de l'effet sur `!isOpen || !pauseStartedAt` ; rendu avec `isOpen=false` (`showPauseDialog` initial `resuming && pausePhase==="during_pause"`, `:134-136`) → aucun contenu, aucun timer. Inoffensif.

- **`as never` masquant un décalage de forme** — _blanchi._ En `variant="exam"`, `QuestionCard` ne lit `question.correctAnswer` que dans des branches mortes (`showCorrectAnswer=false`, non-review → `getAnswerState`/`showCheckIcon` valent toujours `default`/`false`, `index.tsx:59-64,439-445`) → `undefined` comparé, jamais affiché ni planté. `QuestionNavigator` ne lit que `_id`/index (`question-navigator.tsx:30-51` — `_id.toString()` valide sur un `string`). `tsc` passe. Forme « pont » saine.

- **Anti-triche client contournable** — _blanchi._ Le client ne fait que de l'UX (`isQuestionAccessible` `lib/exam-timer.ts:188-225`, verrou nav/réponse `:386-432`). L'autorité reste serveur : score recalculé (`actions.ts:598-624`), questions verrouillées en pause rejetées (`FRAUD`/`PAUSE_SUBMIT`, `:576-587`), verrou de ligne + revérif accès + budget-temps. `correctAnswer` jamais envoyé aux non-admins (`dal.ts:264`). Inchangé par ce delta.

- **Matching des messages d'erreur d'action** — _blanchi._ `result.error.includes(...)` correspond bien aux messages de `submitExamAnswers` : « Temps écoulé » → `TIME_UP` (`actions.ts:663`), « déjà passé » → `ALREADY_TAKEN` (`:659`), « plus active » → `NOT_IN_PROGRESS` (`:660`). Les chemins de redirection/clear se déclenchent correctement (`evaluation-client.tsx:180-188,470-476`).

- **Manual submit ne gère pas `TIME_UP`** — _blanchi (non-régression)._ `handleSubmit` (`:470-477`) ne matche que « déjà passé »/« plus active » ; un `TIME_UP` afficherait un toast sans redirect — **mais identique à Convex** (`old_eval_page.tsx:564-567`), et quasi inatteignable (le timer aurait déjà déclenché l'auto-submit `isAutoSubmit:true` qui contourne le contrôle de temps). Pré-existant, pas introduit ici.

- **Stats basées sur `userHasTaken` vs `userParticipation`** — _blanchi (correct)._ En Drizzle, `userParticipation` est non-null même pour `in_progress` (`dal.ts:182-184`). Filtrer les stats sur `userHasTaken` (= `completed`/`auto_submitted`, `dal.ts:169`) est **le bon choix** : utiliser `userParticipation` compterait les sessions en cours. `showScore = userTaken && userResult?.completedAt != null` (`examen-blanc-client.tsx:106`) évite en plus le `formatDate(undefined)` → « Invalid Date » latent de l'ancienne carte. Adaptation correcte, pas une régression.

- **`midpoint` `Math.ceil` dans `PauseDialog`** — _blanchi (pré-existant)._ `:800` passe `Math.ceil(totalQuestions/2)` (affichage) tandis que l'accès utilise `Math.floor` (`lib/exam-timer.ts:198`). Léger décalage de libellé pour un nombre impair de questions, **identique à Convex** (`old_eval_page.tsx:916`). Cosmétique, non introduit ici.

- **`data-testid` E2E** — _blanchi._ `btn-previous` (`:584`), `btn-next` (`:624`), `btn-finish` (`:613`), `answer-option-{i}` (via `QuestionCard`/`answer-option.tsx`, inchangé) préservés à l'identique de Convex. Pas de casse E2E examen.

---

## 4. Verdict

**5.5 peut-elle être déclarée terminée et 5.6 (purge convex) démarrée ?**

➡️ **NON — pas avant correction de #1.**

Le constat 🔴 #1 est une **régression de perte de réponses** introduite par 5.5c dans le flux sécurité-critique de passation : un étudiant qui reprend/rafraîchit après expiration du chrono obtient un score 0 alors que ses réponses étaient en localStorage (Convex les récupérait). Le correctif est petit et local (réhydrater depuis le localStorage dans la branche d'expiration, comme l'ancien `initializeSession`). 5.6 (purge `convex/`) est techniquement orthogonale et peut avancer en parallèle, mais déclarer 5.5 « terminée » avec cette régression connue serait incorrect.

### Correctifs priorisés

| Priorité                      | #   | Action                                                                                                                                                                                                          |
| ----------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bloquant maintenant**       | #1  | `handleAutoSubmit` / branche `rem<=0` : soumettre les réponses du `loadAnswersFromStorage(examId)` (fusionnées avec `answers`) avant de purger. Ajouter un test (reprise + timer expiré → réponses préservées). |
| **Avant cutover**             | #2  | Ne pas afficher l'UI d'examen pour une session terminée (overlay neutre / spinner tant que le redirect n'a pas eu lieu).                                                                                        |
| **Avant cutover (optionnel)** | #3  | Dériver l'éligibilité d'un `expiresAt` comparé au `now` client pour la parité UX, ou documenter le comportement figé comme acceptable.                                                                          |
| **Polish**                    | #4  | RAS — borne 100 conforme.                                                                                                                                                                                       |

---

## 5. Confirmations de sécurité opérationnelle

- **Prod Neon (`br-blue-moon-adhu1l69`)** : **pas touchée** (aucune commande SQL/migration émise).
- **Secrets** : aucun contenu `.env*` imprimé.
- **Lecture seule** : seuls `git diff`/`git show`/`git log`, lectures de fichiers, recherches, et les deux gates (`bun run check`, `bun run build`) ont été exécutés. **Aucun fichier source modifié** ; seul ce rapport a été écrit.
