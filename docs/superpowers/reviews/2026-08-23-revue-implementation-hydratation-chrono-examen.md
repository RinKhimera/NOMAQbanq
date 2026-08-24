# Revue adversariale — ancre serveur du chrono d'examen

**Date** : 2026-08-23
**Périmètre** : `git diff main...HEAD` sur `fix/hydratation-chrono-examen`
(3 commits `ab28020` · `1e6ce4a` · `f1372ad` — 11 fichiers, +173/−15)
**Méthode** : lecture seule, posture hostile. Chaque constat est prouvé par une
lecture de code citée (`fichier:ligne`) ou par une commande rejouable ; les
intuitions non confirmées sont consignées en faux positifs plutôt que
supprimées.

**État de la garde**

| Commande       | Résultat                                                          |
| -------------- | ----------------------------------------------------------------- |
| `bun run check` | **exit 0** — prettier ✅, `tsc --noEmit` ✅, `eslint --max-warnings 0` ✅ |
| `bun run test`  | **exit 0** — 118 fichiers, **1334 tests passés**, 0 échec (23,9 s) |

Aucun serveur de dev lancé, aucun fichier source modifié.

---

## 1. Tableau des constats

| #   | Sév | fichier:ligne                                   | Problème                                                                                                             | Régression ?                         |
| --- | --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 🟡  | `components/quiz/runner/use-quiz-session.ts:433` | Repli `?? 0` = époque Unix : une ancre manquante rend un décompte de ~472 000 heures au lieu d'échouer ou de dégrader | Non (introduit par le diff, inerte)  |
| 2   | 🟡  | `components/quiz/runner/use-exam-timer.ts:45`    | Plafond `Math.min(totalMs, …)` retiré sur la foi de deux tests qui décrivent un état physiquement impossible          | Non — borne défensive perdue         |
| 3   | 🟡  | `tests/components/quiz/exam-timer-hydration.test.tsx` | Le hook est testé, le **câblage** de l'ancre ne l'est par rien : la forme même du bug d'origine repasserait          | Non — trou préexistant, non comblé   |
| 4   | ℹ️  | `components/quiz/runner/use-exam-timer.ts:51` vs `:67` | Premier rendu sur l'horloge serveur, ticks sur l'horloge client : un client déréglé voit le chrono sauter à l'hydratation | Oui, cosmétique et introduite        |
| 5   | ℹ️  | `app/(admin)/admin/page.tsx:16` · `…/evaluation/page.tsx:11` | Le commentaire annonce une isolation d'impureté que l'indirection ne produit pas                                     | Non                                  |

Aucun constat 🔴 ni 🟠. Le correctif traite bien la cause établie au replay.

---

## 2. Détail par constat

### #1 🟡 — `?? 0` : un repli sur l'époque Unix plutôt qu'une dégradation propre

**Code**
- `components/quiz/runner/use-quiz-session.ts:433` — `initialNow: timerConfig?.initialNow ?? 0`
- `components/quiz/runner/use-exam-timer.ts:44-45` — `elapsed = at - serverStartTime - totalPauseDurationMs`
- `components/quiz/runner/types.ts:27` — `initialNow: number` (requis)

**Pourquoi c'est un vrai défaut.** Le `??` est syntaxiquement obligatoire
(`timerConfig` peut être `null`), mais la valeur choisie est la pire des trois
possibles. Deux branches à distinguer :

- `timerConfig === null` (entraînement) : `enabled: false` (`use-quiz-session.ts:430`)
  et `timer = null` (`:439`) → la valeur n'est ni décomptée ni rendue. Inoffensif.
- `timerConfig` présent mais `initialNow` absent : `computeRemaining(0)` vaut
  `max(0, totalMs − (0 − serverStartTime − pause))` = `totalMs + serverStartTime`
  ≈ 1,7 × 10¹² ms. `formatExamTime` (`lib/exam-timer.ts:30-35`) ne borne pas les
  heures → le HTML SSR porte « 472222:13:20 » à la place du décompte, sur la page
  de passation.

TypeScript ferme aujourd'hui cette branche (`types.ts:27` rend le champ requis, et
`bun run check` passe). C'est donc du **durcissement, pas un bug actif** — mais le
`?? 0` est précisément ce qui avalerait en silence un futur assouplissement du
type, et il annule la protection que la revue croit tenir du typage.

**Régression ?** Non : la ligne est introduite par le diff et n'est pas atteignable.

**Comment je l'ai prouvé.** Lecture de `use-quiz-session.ts:428-439` (les deux
branches `enabled`/`timer`), puis calcul appliqué à `use-exam-timer.ts:44-45` et à
`formatExamTime` (`lib/exam-timer.ts:31`, `Math.floor(ms / 3600000)` sans modulo
sur les heures).

**Correctif suggéré.** `initialNow: timerConfig?.initialNow ?? timerConfig?.serverStartTime ?? 0`,
ou plus lisiblement `?? serverStartTime`. Le repli rend alors `remaining = totalMs` —
toujours une valeur sensée et bornée — sans appeler d'horloge dans le corps de rendu
(ce qui rallumerait `react-hooks/purity`).

---

### #2 🟡 — le plafond retiré l'a été sur la foi de deux tests qui décrivent l'impossible

**Code**
- `components/quiz/runner/use-exam-timer.ts:42-48` — `computeRemaining` sans `Math.min`
- `tests/components/quiz/use-exam-timer.test.ts:137-148` — `totalSeconds: 60`, `totalPauseDurationMs: 20_000`, `serverStartTime = start = now`
- `tests/components/quiz/use-quiz-session.test.ts:665-680` — `initialPause: { isPaused: true, totalPauseDurationMs: 12_000 }` avec `serverStartTime = start`

**Pourquoi c'est un vrai défaut.** Les deux tests invoqués pour justifier le
retrait posent un examen qui démarre **à l'instant présent** tout en ayant **déjà
accumulé 20 s (resp. 12 s) de pause**. Une pause ne peut pas précéder le démarrage :
`resumeExam` (`features/exams/actions.ts`) calcule
`elapsed = Math.min(now − pauseStartedAt, capMs)` puis `total = (p.total ?? 0) + elapsed`,
et `pauseStartedAt` est nécessairement postérieur à `startedAt`. Ces tests fixent
donc un **artefact du harnais**, pas un invariant métier : `remaining > total`
n'est pas « légitime », il est simplement non atteignable en production. Le plafond
n'a pas été retiré parce qu'il était faux, mais parce que deux tests mal construits
s'y opposaient — et avec lui disparaît la seule borne qui aurait absorbé le
constat #1 et tout futur câblage d'ancre erroné.

J'ai cherché un déclencheur exploitable et je dois rapporter que **je n'en ai pas
trouvé d'atteignable** :

- `db/schema/exams.ts:88` — `startedAt: timestamp(…)` est **nullable** (pas de
  `.notNull()`), et les deux consommateurs ne s'accordent pas sur ce qu'est
  « in_progress » : `…/evaluation/page.tsx:38` teste le statut seul (et envoie
  donc les questions), tandis que `evaluation-client.tsx:59-60` exige en plus
  `startedAt != null` (et affiche donc la modale). Dans cet état, le garde-fou
  `if (totalQuestions === 0)` (`evaluation-client.tsx:349`) ne joue pas, et un
  `router.refresh()` non appliqué monterait le runner avec un `initialNow`
  antérieur à `serverStartTime` → `remaining > totalMs` affiché.
- Mais cet état n'est produit par **aucun écrivain** : `startExam` insère toujours
  `startedAt: new Date(now)` (`features/exams/actions.ts:544-551`) et la route de
  support e2e insère `completed` (`app/api/e2e/route.ts:464-471`). Le chemin est
  représentable en base, pas atteignable par le code.

**Régression ?** Non — perte d'une borne défensive, pas d'un comportement.

**Comment je l'ai prouvé.** `grep -rn "insert(examParticipations)" features/ app/`
(2 sites, tous deux renseignent `startedAt`) ; lecture de `db/schema/exams.ts:88` ;
lecture comparée des deux prédicats `in_progress` ; lecture de `resumeExam`.

**Correctif suggéré.** Rétablir `Math.min(totalSeconds * 1000, …)` **et** corriger
les deux tests en leur donnant une chronologie possible (`serverStartTime = start − 60_000`
avec `totalPauseDurationMs: 20_000`, ce qui teste réellement le crédit de pause).
En l'état, les tests protègent un comportement que personne ne veut.

---

### #3 🟡 — le hook est verrouillé, la source de l'ancre ne l'est pas

**Code**
- `tests/components/quiz/exam-timer-hydration.test.tsx:12-21` — le sujet du test est `useExamTimer` appelé directement, pas la chaîne page → client → runner
- `app/(dashboard)/…/evaluation/_components/evaluation-client.tsx:127` — le câblage réel
- `app/(admin)/admin/_components/admin-dashboard-client.tsx:69` — idem côté admin

**Pourquoi c'est un vrai défaut.** Le nouveau test prouve que le hook honore son
ancre. Il ne prouve rien sur **d'où vient cette ancre**. Le régresseur naturel
n'est pas le hook (désormais bien couvert) mais la source : il suffit d'écrire
`const initialNow = Date.now()` dans `evaluation-client.tsx` — un composant client —
pour rétablir intégralement NOMAQBANQ-13, avec `tsc` vert, `eslint` vert et les
1334 tests verts. Le seul filet restant est la règle documentée et l'œil du
relecteur.

**Régression ?** Non — trou préexistant que le correctif ne comble pas.

**Comment je l'ai prouvé.** `grep -rln "EvaluationClient\|AdminDashboardClient" tests/ e2e/`
→ **aucun résultat** ; `ls tests/components/quiz/ tests/components/admin/` confirme
qu'aucun fichier ne rend ces deux composants. Le test d'hydratation importe
`useExamTimer` (`exam-timer-hydration.test.tsx:5`), jamais `EvaluationClient`.

**Correctif suggéré.** Une assertion peu coûteuse : rendre `EvaluationClient` avec
`QuizRunner` stubbé (le patron existe déjà — `tests/components/quiz/TrainingSessionClient.test.tsx:45`)
et vérifier que `mode.timer.initialNow` est **strictement** la prop reçue, pas une
valeur d'horloge. Une variante `expect(mode.timer.initialNow).toBe(FIXED_PROP)`
avec `vi.setSystemTime` décalé casse immédiatement si quelqu'un rebranche `Date.now()`.

---

### #4 ℹ️ — l'ancre serveur au premier rendu, l'horloge client aux ticks

**Code**
- `components/quiz/runner/use-exam-timer.ts:50-52` — état initial calculé sur `initialNow` (horloge serveur)
- `components/quiz/runner/use-exam-timer.ts:67` — chaque tick recalcule sur `Date.now()` (horloge client)
- `…/evaluation-client.tsx:266-270` — la modale promet à l'utilisateur un « **Chrono serveur** »

**Pourquoi c'est un vrai défaut (mineur).** Avant le correctif, les deux lectures
venaient de la même horloge : le décompte était faux si le poste était déréglé,
mais **continu**. Désormais le premier rendu lit le serveur et le tick immédiat
(`:75`) lit le client : un poste dont l'horloge dérive de N minutes voit le chrono
sauter de N minutes à l'instant de l'hydratation. C'est le tick qui a tort, pas
l'ancre — et le saut rend visible ce que la modale nie déjà : le décompte affiché
n'est pas piloté par l'horloge serveur. L'auto-soumission, elle, est arbitrée
côté serveur (`finalizeExam` recalcule `elapsed = now − p.startedAt − pauseMs`,
`features/exams/actions.ts:862`), donc **aucune copie n'est en jeu** — seul
l'affichage ment.

**Régression ?** Oui, cosmétique, introduite par le diff.

**Comment je l'ai prouvé.** Lecture croisée de `use-exam-timer.ts:51` et `:67` ;
lecture de `finalizeExam` (`features/exams/actions.ts:861-862`) confirmant que la
décision d'expiration serveur ne dépend pas du chrono client.

**Correctif suggéré (optionnel, hors périmètre de ce correctif).** Mesurer l'offset
une fois à l'hydratation (`offset = initialNow − Date.now()` dans un `useRef` posé
en effet) et ticker sur `Date.now() + offset`. Le chrono devient alors réellement
« serveur », conforme à ce que la modale annonce.

---

### #5 ℹ️ — le commentaire décrit une isolation qui n'a pas lieu

**Code**
- `app/(admin)/admin/page.tsx:16` et `app/(dashboard)/…/evaluation/page.tsx:11` :
  `// Hors composant : isole l'horloge (impure) du corps de rendu (react-hooks/purity).`
  puis `const currentTimeMs = () => Date.now()`

**Pourquoi c'est un vrai défaut (cosmétique).** L'appel `currentTimeMs()` reste
dans le corps de rendu et reste tout aussi impur ; l'indirection ne fait
qu'échapper à l'analyse statique d'ESLint, qui ne reconnaît que les appels
littéraux. Le commentaire décrit donc un effet que le code n'a pas — exactement le
type de commentaire que `CLAUDE.md` demande d'éviter (« le pourquoi non évident,
jamais la narration »). Le « pourquoi » réel — et lui est non évident — est que la
règle n'analyse pas les appels indirects.

**Régression ?** Non.

**Comment je l'ai prouvé.** Lecture des deux fichiers ; `bun run check` exit 0
confirme que la règle est bien éteinte, ce qui n'établit pas que l'impureté a
disparu.

**Correctif suggéré.** Reformuler : « helper au scope module — `react-hooks/purity`
n'analyse que les appels d'horloge littéraux dans le corps du composant ».

---

## 3. Faux positifs écartés

| Soupçon                                                                                                    | Écarté par                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`PauseDialog` casse l'hydratation de la même façon** (décompte à la seconde, même page, même rechargement) | `components/quiz/pause-dialog.tsx:37` — `useState(0)` : le décompte n'est peuplé que dans l'effet (`:54-78`). SSR et hydratation rendent tous deux « 00:00 ». Le flash est le prix payé, mais il n'y a **pas** de divergence de texte.                            |
| **`quiz-runner.tsx:67` (`?? Date.now()` dans un initialiseur `useState`) diverge SSR/client**                | La valeur n'est jamais rendue : elle n'alimente que la prop `pauseStartedAt` de `PauseDialog` (`quiz-runner.tsx:198`), dont l'affichage part de 0. Aucun texte n'en dépend au premier rendu.                                                                     |
| **La règle ment : « le chrono était la dernière exception »**                                               | Balayage de **tous** les fichiers portant `"use client"` sous `app/`, `components/`, `hooks/`. Les `new Date()`/`Date.now()` restants sont dans des handlers (`users-filter-bar.tsx:62` `handlePresetClick`, `export-users-button.tsx:23` `formatDateTime`, `question-image-uploader.tsx:255`) ou dans le `disabled` d'un `Calendar` monté à l'ouverture d'un `Popover` (`exam-form.tsx:448`). Aucune valeur d'horloge rendue au premier rendu SSR. **L'affirmation tient.** |
| **Auto-soumission indue à la reprise** : `setTotalPauseDurationMs(res.totalPauseDurationMs ?? prev)` (`use-quiz-session.ts:345`) garderait `prev = 0`, le tick suivant verrait toute la pause comme du temps écoulé et tirerait `onExpire` | `resumeExam` retourne **toujours** la durée en succès : `return { success: true as const, totalPauseDurationMs: total }` (`features/exams/actions.ts`), et `callAction` renvoie `T` inchangé en succès (`lib/safe-action.ts:44`, `return await fn()`). Le `?? prev` n'est pas atteignable sur un succès. |
| **Le chemin « démarrage depuis la modale » monte le runner avant le refresh**                                | `…/evaluation/page.tsx:52` n'envoie les questions qu'en `in_progress`, et `evaluation-client.tsx:349` rend un squelette tant que `totalQuestions === 0`. Le runner ne peut pas se monter avant l'arrivée du payload rafraîchi. (Seule exception théorique : le cas `startedAt` null du constat #2, non produit par le code.) |
| **`initialNow` figé pendant une pause fait mentir le chrono, voire expirer à tort**                          | L'effet sort avant tout tick quand `isPaused` (`use-exam-timer.ts:62`) → `onExpire` est structurellement inatteignable en pause. Et la sous-évaluation à la reprise-en-pause après rechargement est **identique** à l'ancien code (l'ancien initialiseur lisait `Date.now()` avec le même `totalPauseDurationMs = 0`) → pas une régression. |
| **Le test jumeau passerait aussi sans le correctif**                                                        | Réfuté par composition : le jumeau démontre empiriquement que le harnais **détecte** la divergence quand les deux passes lisent des instants différents — exactement la configuration du hook non corrigé. Le test 1 échouerait donc sans l'ancre. Voir Q4.        |
| **Next 16 interdirait `Date.now()` dans un Server Component**                                               | `next.config.ts:5-11` — `experimental` ne contient que `optimizePackageImports` : ni `cacheComponents` ni `dynamicIO`. Les deux pages sont dynamiques (layouts `requireSession`/`requireRole`). Aucune contrainte de frontière dynamique.                          |
| **Régression de perf admin (`formatWeekdayLongDate` démémoïsé)**                                            | Voir Q5 — non seulement l'impact est nul, mais le changement corrige un défaut latent.                                                                                                                                                                          |

---

## 4. Réponses aux questions ouvertes

### Q1 — Chemin « démarrage depuis la modale » : le retrait du plafond laisse-t-il passer un affichage aberrant ?

**Non sur le chemin nominal, et le risque résiduel est d'un frame.** Le runner ne
peut pas se monter avant le refresh : `page.tsx:52` conditionne les questions à
`in_progress`, et `evaluation-client.tsx:349` intercale un squelette tant que
`totalQuestions === 0`. Si le refresh échoue, l'utilisateur voit le squelette, pas
un chrono faux. Et même dans le cas limite du constat #2, l'aberration est corrigée
par le `tick()` immédiat de l'effet (`use-exam-timer.ts:75`), qui s'exécute dans le
même commit.

**Mais je suis en désaccord avec le raisonnement qui a mené au retrait.** Les deux
tests ne documentent pas que « `remaining > total` est légitime » : ils
construisent un examen qui a accumulé une pause avant d'avoir démarré, ce que
`resumeExam` ne peut pas produire. Le plafond a donc été retiré pour satisfaire un
artefact de harnais, et c'est lui qui aurait borné le constat #1. Recommandation :
rétablir `Math.min` et corriger la chronologie des deux tests.

### Q2 — Pause / reprise : fenêtre où l'affichage ment, ou pire, où `onExpire` se déclenche à tort ?

**Aucune auto-soumission indue possible, prouvé structurellement.** L'effet
retourne avant `tick()` dès que `isPaused` est vrai (`use-exam-timer.ts:62`) :
pendant une pause, ni `setRemainingMs` ni `onExpireRef.current()` ne peuvent
s'exécuter. À la reprise, `computeRemaining` change (nouveau
`totalPauseDurationMs`), l'effet se recrée et son `tick()` immédiat recalcule sur
`Date.now()` avec le crédit de pause à jour — la valeur ancrée est écrasée avant
le prochain paint.

**Une seule fenêtre où l'affichage ment**, et elle est **préexistante, pas
introduite** : au rechargement pendant une pause, `initialPause.totalPauseDurationMs`
vaut encore 0 (le crédit n'est posé qu'au resume, `features/exams/actions.ts`), donc
le premier rendu sous-évalue le temps restant du montant de la pause en cours, et
aucun tick ne le corrige tant que la pause dure. L'ancien code produisait
exactement la même valeur (`Date.now()` avec le même offset nul). Ce n'est pas une
régression, et l'affichage se remet d'aplomb au premier tick post-reprise.

J'ai aussi vérifié le scénario le plus dangereux que je pouvais construire — un
resume dont la durée de pause ne remonte pas, ce qui ferait chuter le décompte de
15 min d'un coup et pourrait tirer `onExpire` : il est **inatteignable**
(`resumeExam` retourne toujours `totalPauseDurationMs` en succès, et `callAction`
renvoie `T` intact, `lib/safe-action.ts:44`).

### Q3 — Interaction `enabled` / `expiredRef` / premier rendu ≠ premier tick

**Saine.** `expiredRef` (`use-exam-timer.ts:53`) n'est consulté que dans `tick()`,
lui-même inatteignable quand `!enabled || isPaused` (`:62`). Le premier rendu ne
peut donc **jamais** armer l'expiration, quelle que soit la valeur qu'il calcule :
le seul chemin vers `onExpire` passe par un tick post-hydratation qui lit
`Date.now()`. Le mode entraînement reste protégé par `enabled: false`
(`use-quiz-session.ts:430`), qui neutralise le `remaining = 0` du montage.

Le cas symétrique est correct aussi : si l'ancre serveur calcule déjà 0 (temps
écoulé au moment du rendu), le HTML porte « 00:00:00 » et l'état critique, puis le
tick d'hydratation tire l'auto-soumission. C'est le comportement voulu.

Un défaut réel existe dans cette zone mais il est **préexistant et hors diff** :
`expiredRef` n'est jamais remis à `false`, donc si `finalizeExam` échoue au réseau,
`confirmFinish` avale l'erreur (`use-quiz-session.ts:373-375`) et plus aucun tick
ne retentera l'auto-soumission. À traiter séparément.

### Q4 — Le test jumeau prouve-t-il vraiment quelque chose ? Existe-t-il un chemin non câblé ?

**Le test 1 est bien sensible au correctif** — c'est-à-dire qu'il échouerait si on
retirait l'ancre. Preuve par composition : le test 2 démontre **empiriquement**
(`expect(recoverable.length).toBeGreaterThan(0)`) que ce harnais détecte la
divergence dès que les deux passes lisent des instants différents ; or c'est
exactement la configuration du hook non corrigé (`Date.now()` au SSR puis à
l'hydratation). Le commentaire du test (« sans lui, il passerait chrono gardé ou
non ») est donc **trop modeste** : le test 1 tient tout seul, le jumeau est un
contrôle positif qui prouve que le harnais n'est pas complaisant. Le garder est le
bon choix, la justification écrite est imprécise.

**Deux réserves, en revanche :**

1. Le câblage n'est couvert par rien — c'est le constat #3, et c'est la vraie
   faille : le hook est verrouillé, sa source ne l'est pas.
2. L'assertion `expect(container.textContent).toBe("00:58:56")` porte sur le tick
   d'**intervalle**, après `advanceTimersByTime(1_000)`. Le tick **immédiat** a
   déjà fait passer l'affichage de « 00:59:00 » à « 00:58:57 » à l'intérieur du
   `act` d'hydratation, et cette transition — la plus intéressante, celle qui prouve
   que l'ancre ne fige rien — n'est pas assertée. Une ligne
   `expect(container.textContent).toBe("00:58:57")` juste après `hydrate` fermerait
   le raisonnement.

**Chemins non câblés** : aucun. Les deux seuls consommateurs de `QuizRunner` sont
`evaluation-client.tsx:364` et `training-session-client.tsx:160` ; le second passe
`timer: null` et retombe sur `enabled: false`. `useExamTimer` n'a qu'un appelant
(`use-quiz-session.ts:429`), et `types.ts:27` rend `initialNow` obligatoire — un
oubli est rattrapé par `tsc`. Vérifié par grep sur `QuizRunner|useQuizSession|useExamTimer`.

### Q5 — Régression admin : `formatWeekdayLongDate` recalculé à chaque rendu ?

**Aucun impact, et le changement corrige un défaut latent — je suis en désaccord
avec l'inquiétude.**

- *Coût* : `formatWeekdayLongDate` (`lib/format.ts:158`) fait un `TZDate`
  (`lib/app-zone.ts:27`) et un `format` date-fns. `AdminDashboardClient` ne re-rend
  que sur `showManualPaymentModal` (`admin-dashboard-client.tsx:68`) et sur un
  nouveau payload RSC — quelques rendus par session. Le coût est de l'ordre de la
  dizaine de microsecondes ; le mémoïser serait de la cérémonie.
- *Bénéfice non mentionné* : l'ancien `useState(() => …)` figeait la date **à vie**.
  Or `admin-dashboard-client.tsx:157` appelle `router.refresh()` après un paiement
  manuel. Avec l'ancienne forme, un onglet admin laissé ouvert à cheval sur minuit
  affichait la veille indéfiniment, refresh compris. Dériver de la prop rend la
  date solidaire du payload. **Remettre un `useState` ici serait une régression** :
  il re-figerait une valeur qui doit suivre sa prop.

---

## 5. Verdict

> **Peut-on merger ce correctif dans `main` et le déployer en production tel quel ?
> → OUI.**

**Aucun point bloquant.** Le correctif attaque la cause réellement établie au
replay (l'initialiseur `useState` s'exécutant au SSR puis à l'hydratation), il est
cohérent avec le patron déjà en place dans `dashboard-hero`, `examen-blanc-client`
et `access-badge`, la garde est verte (`bun run check` exit 0, 1334 tests verts), et
j'ai vérifié qu'aucun chemin ne permet à ce diff de provoquer une auto-soumission
indue — le seul chemin vers `onExpire` est un tick post-hydratation, structurellement
fermé pendant une pause et en mode entraînement.

Les cinq constats sont du durcissement et de la dette de test, pas des défauts de
correction.

| Priorité              | Action                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Bloquant maintenant** | *(aucun)*                                                                                                                    |
| **Avant merge**       | #1 — remplacer `?? 0` par `?? serverStartTime` (une ligne, supprime la seule valeur absurde que le code puisse rendre)         |
| **Avant merge**       | #2 — rétablir `Math.min(totalSeconds * 1000, …)` et corriger la chronologie des deux tests qui s'y opposaient                  |
| **Suivi (issue)**     | #3 — assertion sur le câblage de `initialNow` dans `EvaluationClient` (patron de stub déjà disponible)                          |
| **Suivi (issue)**     | #4 — ticker sur un offset serveur mesuré à l'hydratation, pour que le « Chrono serveur » promis à l'utilisateur en soit un      |
| **Cosmétique**        | #5 — reformuler le commentaire de `currentTimeMs` · Q4.2 — asserter le tick immédiat juste après `hydrate`                      |

**Hors périmètre, remonté au passage** (préexistant, ne bloque pas ce merge) :

- `…/evaluation/page.tsx:38` et `evaluation-client.tsx:59-60` n'emploient pas le
  même prédicat « in_progress » — le premier ignore `startedAt`, colonne pourtant
  nullable (`db/schema/exams.ts:88`). Aucun écrivain ne produit cet état
  aujourd'hui, mais l'écart mérite d'être aligné : c'est la garde anti-fuite des
  questions qui repose dessus.
- `expiredRef` (`use-exam-timer.ts:53`) n'est jamais réarmé : une auto-soumission
  dont le `finalizeExam` échoue au réseau ne sera jamais retentée.

---

## 6. Confirmations de sûreté opérationnelle

- **Lecture seule respectée** : aucun fichier source modifié. Le seul fichier écrit
  est ce rapport. `git status` reste propre en dehors de lui.
- **Aucun serveur de dev lancé** — ni `bun dev`, ni en arrière-plan. Seules
  `bun run check` et `bun run test` (vitest, projet `frontend`) ont été exécutées.
- **`bun test` jamais employé** — uniquement `bun run test`, conformément au projet.
- **Base Neon de production (`br-blue-moon-adhu1l69`) non touchée** : aucune
  commande SQL, aucun test d'intégration, aucun outil Neon appelé.
- **Aucun secret imprimé** : aucun `.env*` lu ni affiché.
- **Aucune commande destructive ni de déploiement.** Le rapport n'est **pas**
  committé — la décision revient à la session demandeuse.
