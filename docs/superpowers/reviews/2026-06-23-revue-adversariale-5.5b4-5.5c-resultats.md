# Revue adversariale — 5.5b-4 + 5.5c (résultats participant) & remédiation 5.5b-3

- **Date** : 2026-06-23
- **Périmètre** : `git diff 563eecb..HEAD` (2 commits) sur `migration/drizzle-neon`
  - `2a83cb9` fix(exams 5.5b-3): remediate review — updateExam parity + form error handling
  - `f353595` feat(exams): participant results flows on Drizzle (5.5b-4 + 5.5c-résultats)
  - 9 fichiers : `features/exams/actions.ts`, `tests/integration/exams.test.ts`, les 2 forms create/edit (+ `edit/[id]/page.tsx`), `components/quiz/results/participant-exam-results-view.tsx`, les 2 pages résultats (admin + étudiant) et `participant-results-error.tsx`.
- **Méthode** : lecture intégrale du diff ; parité ligne-à-ligne contre l'implémentation Convex d'avant migration (`git show 563eecb~2:convex/exams.ts` : `updateExam`, `getParticipantExamResults`) ; vérification du contrat `QuestionCardQuestion`, du DAL `features/exams/dal.ts` et du `ResultsQuestionNavigator` ; chaque bug suspecté soumis à réfutation.
- **Gates** :
  - `bun run check` (`tsc --noEmit && eslint --max-warnings 0`) → **exit 0** ✅
  - `bun run build` → **exit 0** ✅
  - Tests d'intégration Neon : **non lancés** (aucune régression DAL/actions suspectée — raisonnement sur le code ; `dal.ts` est _hors range_, voir §scope).

> **Note de scope** : `features/exams/dal.ts` n'est **pas** modifié dans ce range (dernier touché à `2b38dfa`, 5.5b-2). Les pages résultats le câblent mais ne le changent pas. Les constats touchant le DAL sont signalés comme pré-existants.

---

## 1. Tableau des constats

| #   | Sév      | fichier:ligne                               | problème                                                                                                                                             | régression ?                                |
| --- | -------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| F1  | 🟡 basse | `features/exams/actions.ts:164-206`         | Garde `HAS_PARTICIPATIONS` non atomique : pas de `.for("update")` → TOCTOU avec un `startExam` concurrent peut contourner le gel du jeu de questions | **NON** (Convex n'avait aucun garde)        |
| F2  | 🟡 basse | `features/exams/dal.ts:534` (hors range)    | `username: null` codé en dur alors que la colonne `user.username` existe → la carte participant admin n'affiche jamais `@username`                   | **OUI** vs Convex, mais introduit en 5.5a   |
| F3  | ℹ️ info  | `participant-exam-results-view.tsx:198-217` | Filtre « erreurs uniquement » actif + clic navigator sur une question correcte/sans-réponse = no-op (carte filtrée hors DOM)                         | **NON** (pré-existant, identique en Convex) |
| F4  | ℹ️ info  | `participant-exam-results-view.tsx:343`     | Breakpoint sidebar admin passe de `xl` à `lg` (composant désormais partagé)                                                                          | cosmétique                                  |

Aucun constat 🔴 haute ni 🟠 moyenne. La remédiation 5.5b-3 est **correcte**, pas seulement plausible.

---

## 2. Détail par constat

### F1 🟡 — Garde `HAS_PARTICIPATIONS` non sérialisé (best-effort)

**Code** : `features/exams/actions.ts:164-233` — `db.transaction` lit le `count(*)` de `examParticipations` (l.185-189) puis, si `hasParticipations`, compare le set courant (l.196-205). Aucune ligne n'est verrouillée (`SELECT … .for("update")` absent ; le `SELECT` exam l.165-169 fait juste `.limit(1)`).

**Déclencheur concret** : sous READ COMMITTED, une tx `startExam` concurrente qui insère une participation _après_ le statement `count(*)` de `updateExam` mais avant son commit n'est pas vue → `hasParticipations=false` → l'admin réécrit `examQuestions` (delete+insert l.223-232) alors qu'un participant vient de démarrer. `submitExamAnswers` relit les questions en direct (l.559-568), donc ce participant sera scoré sur le **nouveau** set. C'est précisément ce que le garde veut empêcher.

**Pourquoi c'est mineur** : (a) fenêtre extrêmement étroite (édition admin **simultanée** au tout premier démarrage d'un candidat) ; (b) le participant concerné n'a encore aucune réponse — il obtient le même set que s'il avait démarré 1 s plus tard ; (c) les guides du projet réservent `.for("update")` à la « concurrence par utilisateur », pas aux opérations admin. **Impact réel négligeable.**

**Régression** : **NON** — le Convex `updateExam` (`563eecb~2:convex/exams.ts:64-103`) `patch`ait `questionIds` **sans aucun garde**. Le nouveau code est strictement plus sûr, même avec la course.

**Correctif suggéré (optionnel, durcissement)** : verrouiller la ligne exam en tête de tx —
`await tx.select({ id: exams.id }).from(exams).where(eq(exams.id, id)).for("update").limit(1)` — et faire prendre ce même verrou par `startExam`/`submitExamAnswers` (ils verrouillent aujourd'hui la ligne _user_/_participation_, pas l'exam). À peser : surcoût de contention vs un risque très théorique.

### F2 🟡 — `username` perdu dans les résultats participant (pré-existant)

**Code** : `features/exams/dal.ts:520-538` (hors range) sélectionne `id, name, email, image` et force `username: null`. Or `db/schema/auth.ts:23` définit `username: text("username").unique()`.

**Déclencheur** : la carte participant admin (`participant-exam-results-view.tsx:174-176`) fait `{participantUser.username ? `@${username} · ` : ""}` → toujours vide. Le Convex `getParticipantExamResults` (`563eecb~2`) renvoyait `username: v.optional(v.string())` réel et l'ancienne page admin affichait `@{username} · {email}`.

**Régression** : **OUI vs Convex**, mais introduite en **5.5a** (`1f121c5`), pas dans ce delta. Ce delta ne fait que _re-câbler_ la carte qui l'expose. À traiter quand on harmonisera le DAL (le `username` est nullé de la même façon dans `getEligibleExamCandidates` et `getExamLeaderboard`).

**Correctif suggéré** : ajouter `username: user.username` au `select` et mapper `username: pUser.username ?? null`. Trivial, mais hors périmètre strict — à grouper avec les autres `username: null` du DAL.

### F3 ℹ️ — Clic navigator sur question masquée par le filtre = no-op

**Code** : `participant-exam-results-view.tsx`

- `filteredResults` (l.198-200) ne rend que les incorrectes quand `showOnlyIncorrect`.
- `navigatorResults` (l.143-149) couvre **toutes** les questions (indices 0..n-1).
- `scrollToQuestion(index)` (l.187-194) fait `getElementById(`question-${index}`)` ; les cartes portent `id={`question-${originalIndex}`}` (l.345, via `resultIndexMap`).

**Déclencheur** : filtre actif → clic sur une question **correcte** dans le navigator → `scrollToQuestion` l'ajoute à `expandedQuestions` mais sa carte n'est pas dans le DOM → `getElementById` renvoie `null` → aucun scroll. Pour les cartes **visibles** (incorrectes), le scroll vise la bonne carte : `question-${originalIndex}` correspond exactement à l'index 0-based passé par le navigator. **Le fix off-by-one + `resultIndexMap` est donc correct sur le cas qui compte.**

**Régression** : **NON** — structure identique à l'ancien code Convex (navigator non filtré, liste filtrée). UX dead-click pré-existant.

**Correctif suggéré (optionnel)** : si `showOnlyIncorrect`, soit désactiver les items navigator correspondant à des questions filtrées, soit lever le filtre avant de scroller.

### F4 ℹ️ — Breakpoint sidebar admin `xl` → `lg`

`participant-exam-results-view.tsx:343` utilise `hidden lg:block` (et `lg:grid-cols-[1fr_280px]` l.236). L'ancienne page admin était en `xl`. La sidebar de navigation apparaît donc plus tôt sur la vue admin. Purement cosmétique, aligné sur l'ancienne page étudiante. Sans impact fonctionnel.

---

## 3. Faux positifs écartés (suspecté → blanchi, avec preuve)

| Suspecté                                                                           | Preuve de réfutation                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------- |
| **Race / refetch infini des explications lazy** (`view:73-114`)                    | Le flag `active` rejette les fetchs périmés **sans** marquer `loadedIds` (l.96-99 hors du `if (!active) return`). Tout id rejeté est donc ré-inclus dans le `toLoad` de l'effet suivant (l.74-76) → convergence garantie. Deps `[expandedQuestionIds]` stables (memo sur `[expandedQuestions, questions]`) ; `setExplanationsMap` ne touche pas ces deps → **pas de boucle**. Aucune fenêtre de « question dépliée sans explication » qui persiste.                                         |
| **`question={result.question as never}` masque un décalage de forme** (`view:344`) | `QuestionCard` ne lit que `question`, `options`, `correctAnswer`, `objectifCMC`, `images`, `explanation?`, `references?` (`question-card/index.tsx:155-156,161,347,380-395,418-424`). Tous présents dans `ExamQuestionView` (`dal.ts:67-78`). La clé de sortie est bien `objectifCMC` (mappée depuis la colonne `objectifCmc`) — pas de `objectifCmc` vs `objectifCMC` au runtime. Aucun champ accédé n'est absent. `as never` = convention `data-layer.md` (l'`_id` Drizzle est `string`). |
| **Off-by-one du scroll non corrigé**                                               | `scrollToQuestion(index) → question-${index}` (l.187-191) ; carte `id=question-${originalIndex}` (l.345) ; navigator passe l'index 0-based de `navigatorResults` non filtré = `originalIndex` (`results-question-navigator.tsx:46-57`). Cohérent. L'ancien bug (`question-${index+1}` vs carte `question-${originalIndex}`) est **bien** corrigé.                                                                                                                                           |
| **`updateExam` casse les éditions de métadonnées avec participations**             | Set inchangé (même ordre) → `unchanged=true` (l.202-205) → pas de throw, métadonnées patchées (l.208-219), jonction non réécrite (l.223). Couvert par le nouveau test `updateExam autorise une édition de métadonnées même avec participations` (`exams.test.ts:425-435`). Le form envoie `selectedQuestions` = `initialQuestionIds` ordonné par position (`exam-edit-form.tsx:120-121` + `edit/[id]/page.tsx:23`), identique à l'ordre lu par `updateExam` (`asc(position)`).              |
| **`completionTime` dérive pour un participant in-progress**                        | Recalculé `length * 83` (l.215). Quand le set est figé (participations présentes), `length == count courant` → valeur **identique** → aucun changement du budget-temps lu par `submitExamAnswers` (l.552). Le garde garantit qu'on ne peut changer le nombre de questions qu'à 0 participation.                                                                                                                                                                                             |
| **Fuite des résultats étudiant avant `endDate` / IDOR**                            | `getParticipantExamResults` : `!session → null` ; `!isAdmin && !isOwn → null` (l.492) ; `!isAdmin && now < endDate → null` (l.509). La page étudiante utilise **toujours** `session.user.id` (`resultats/page.tsx:13`). Parité exacte avec Convex (`563eecb~2:699-825`). `correctAnswer` n'est révélé qu'en succès (propre participation complétée **après** endDate, ou admin).                                                                                                            |
| **`participantUser === null` (utilisateur supprimé) non géré**                     | `{participantUser && (…)}` (l.124) ; `getInitials(participantUser?.name)` → `"?"` si undefined (`lib/utils.ts:8-9`) ; côté DAL le message NO_PARTICIPATION devient « Utilisateur introuvable » (`dal.ts:562-564`). Page étudiante sans `participantUser` → carte masquée, `showTips=true`. Aucun crash.                                                                                                                                                                                     |
| **États vides (NO_PARTICIPATION / NOT_COMPLETED) mal routés**                      | Admin : union d'erreur → `ParticipantResultsError` avec badge `status` seulement si `NOT_COMPLETED && status` (`participant-results-error.tsx:137-146`). Étudiant : ces unions ne sont jamais renvoyées à un non-admin (→ `null`), donc `!data                                                                                                                                                                                                                                              |     | "error" in data` → carte « non disponibles ». Cohérent. |
| **`createExam`/`updateExam` : throw non géré côté form**                           | Désormais `try/catch` autour de l'appel (`exam-create-form.tsx:113-136`, `exam-edit-form.tsx:130-156`) : `requireRole` (hors `try` de l'action) qui throw remonte au client et est intercepté → toast générique au lieu d'une rejection non gérée. Amélioration, pas de régression.                                                                                                                                                                                                         |

---

## 4. Verdict

**Est-il sûr d'empiler le flux d'évaluation examen (start/submit/pause + timer) sur ce delta ? → OUI.**

- La remédiation `updateExam` est **correcte** (parité métadonnées rétablie, gel du jeu de questions opérant, `completionTime` cohérent) et **plus stricte** que Convex.
- Les frontières d'autorisation des résultats sont **identiques** à Convex — pas de fuite avant `endDate`, pas d'IDOR.
- Le composant partagé `ParticipantExamResultsView` ne présente **ni race d'explications, ni décalage de forme runtime, ni régression de scroll**.
- Les actions du cycle de vie (`startExam`, `submitExamAnswers`, `startPause`, `resumeFromPause`) sont déjà présentes dans `actions.ts` avec leurs verrous de ligne (`for("update")` sur user/participation) **et ne sont pas touchées par ce delta** — rien ici ne les régresse.
- `bun run check` et `bun run build` passent.

**Items bloquants** : aucun.

**Correctifs priorisés (tous non bloquants)** :

| Prio | Constat | Action                                                                                                | Effort              |
| ---- | ------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| P2   | F2      | Sélectionner `user.username` dans le DAL (groupé avec les autres `username: null`)                    | trivial, hors range |
| P3   | F1      | Verrou de ligne exam dans `updateExam` (+ même verrou côté start/submit) si on veut un garde atomique | moyen, théorique    |
| P3   | F3      | Neutraliser le clic navigator sur questions filtrées (ou lever le filtre au scroll)                   | faible              |
| P4   | F4      | Réaligner le breakpoint sidebar si la parité visuelle admin importe                                   | trivial             |

---

## 5. Confirmations de sécurité opérationnelle

- **Touché** : un seul fichier écrit — ce rapport (`docs/superpowers/reviews/2026-06-23-revue-adversariale-5.5b4-5.5c-resultats.md`). Lancé `bun run check` et `bun run build` (gates lecture seule).
- **Pas touché** : aucun fichier source modifié. Aucun commit. Aucune branche Neon (la branche `production` `br-blue-moon-adhu1l69` n'a pas été approchée — les tests d'intégration n'ont pas été lancés). Aucun `.env*` lu ni imprimé. Aucune commande destructrice ou de déploiement.
  </content>
  </invoke>
