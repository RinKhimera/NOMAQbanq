---
paths:
  - "features/exams/**"
  - "features/attempts/**"
  - "features/training/**"
  - "features/analytics/**"
  - "features/questions/**"
  - "features/objectives/**"
  - "features/cron/**"
  - "app/(passation)/**"
  - "app/(evaluation)/**"
  - "app/(dashboard)/**"
  - "app/(admin)/admin/examens/**"
  - "app/(admin)/admin/questions/**"
  - "components/quiz/**"
  - "tests/integration/**"
---

# Examens, tentatives et banque de questions

Invariants métier (vocabulaire dans `CONTEXT.md`). Les patterns génériques
(DAL, Server Actions, transactions, pièges Drizzle) sont dans `data-layer.md`.

## Tentatives et passation

- **Écriture sur une tentative = `requireAttempt`** (`features/attempts/guard.ts`,
  `docs/adr/0001`). Toute action qui écrit sur une participation ou une session
  d'entraînement ouvre `db.transaction` et appelle
  `requireAttempt(tx, { kind, ref, actor, now, verb })` : `SELECT … FOR UPDATE`
  sur la tentative (propriété dans le WHERE — autrui = `NOT_FOUND`), puis la
  politique du verbe (table en tête du module : fenêtre/TTL, accès, pause,
  budget). Refus par code, message par `refusalMessage(code, kind)` ; les refus
  propres à l'action (« question hors examen », « déjà en pause ») restent
  locaux. Plus de garde de statut dans le WHERE des UPDATE : le verrou est la
  discipline (seule exception : `closeAttempts`, qui sert aussi le balayage
  du cron sans verrou et re-vérifie « encore ouverte » dans son WHERE final).
  **Le cron est le seul écrivain de la clôture par expiration** :
  une action qui constate l'expiration refuse (`EXPIRED`) sans rien écrire.
  **La clôture elle-même a UN écrivain : `closeAttempts`**
  (`features/attempts/close.ts`, vocabulaire dans `CONTEXT.md`). Il possède le
  compte des justes, le dénominateur par type (questions de l'examen blanc
  pour une participation, nombre tiré pour une session d'entraînement), la
  garde « encore ouverte » et l'écriture (statut, score, `completedAt`) ;
  `{ id }` sous le verrou d'une action, `{ expiredBefore, limit, id? }` pour
  les crons et pour `createTrainingSession` qui libère la place.
  Un appelant ne recopie ni l'agrégat ni la formule (`scoreSql`) ni un UPDATE
  sur la tentative ; la règle est prouvée une fois dans
  `tests/integration/attempt-close.test.ts`, les tests des appelants ne
  gardent que leur mapping (statut demandé, crédit de pause). `isAutoSubmit`
  (client) n'a qu'un effet : exempter le `close` du budget — jamais une
  écriture de réponse.
- **Passation d'examen — invariante d'accès** : le contenu des questions n'est
  livré/écrit que pour une participation `in_progress` (créée par `startExam`,
  seul à vérifier finalisation + audience + fenêtre + accès + examen actif à
  la création ; seuls l'audience et l'accès sont levés pour un admin).
  Désactiver un examen ferme les NOUVELLES participations, admin compris, et le rend
  introuvable à qui n'y a pas participé (page, liste, classement), sans couper
  une épreuve en cours : `requireAttempt` ne lit pas `isActive`,
  volontairement, et la liste garde l'examen pour son participant. La page evaluation
  ne met les questions dans le payload RSC qu'en `in_progress` (le client
  `router.refresh()` après `startExam`) ; `getExamWithQuestions` re-garde
  `hasAccess("exam")` pour `subscribers` (défense en profondeur — un `null` sur
  la page détail rend la carte paywall à un non-abonné, PAS un 404 ; un abonné
  reçoit le 404, il n'a rien à acheter). Budget-temps anti-triche
  gardé À L'ÉCRITURE (verbe `answer` de `requireAttempt`, au-delà de
  `startedAt + completionTime + grâce`), pas seulement à la finalisation.
  Toute écriture du jeu de questions et `startExam` prennent un `FOR UPDATE`
  commun sur la ligne `exams` ; `requireAttempt` ne verrouille QUE la participation (`OF p`).
- **Une participation `in_progress` survit à son budget** : le cron ne la clôt
  qu'à la fermeture de l'examen. Une lecture « examen en cours » teste le
  budget (`remainingMs`) avant d'afficher un temps restant.

## Verrou de clé et lectures de score

- **Verrou de clé de réponse = un seul module**,
  `features/questions/answer-key-lock.ts` (voir `CONTEXT.md`). Tant qu'un
  examen contenant une question est ouvert, sa clé est retenue pour tout
  lecteur qui y participe (pour tout le monde sur le canal anonyme ; jamais
  pour un admin). Trois entrées, à ne pas contourner : `lockFor(viewer,
candidats)` → `Lock.reveal(row, niveau)` sur les canaux de RÉVÉLATION
  (correction d'entraînement, résultats et explications d'examen, notation du
  quiz public) — `reveal` décide quels champs de CORRECTION blanchir et pose
  `keyWithheld` ; `isCorrect` d'une réponse se masque à côté, par `Lock.has`,
  car il révèle la clé combiné à `selectedAnswer` ; `excludeLocked(viewer,
colonne)` dans le WHERE des canaux de
  SÉLECTION (corpus de révision, tirage du quiz public). Masquer la correction
  ne suffit pas : l'appartenance d'une question au lot « mes ratées » dit déjà
  « tu t'es trompé ». `pickRevisionQuestionIds` et `getRevisionCounts`
  prennent le `viewer` en paramètre **requis** : un oubli casse la
  compilation au lieu du silence. Une réponse dont la clé est retenue n'est
  **ni juste ni fausse** : `SessionResults` la compte « différée », et un
  lecteur qui dérive un compteur de `isCorrect` doit d'abord lire
  `keyWithheld`. Troisième entrée, pour les LECTURES DE SCORE :
  `scoreWithheldForOwner(colonneUserId, réponsesSQL, examenPropre?)` — le
  score enregistré compte les réponses différées, le lire à côté des
  compteurs qui les excluent (ou avant/après dans une moyenne) redonnerait la
  clé par soustraction. Une PARTICIPATION passe en plus son examen propre
  (`exam_participations.exam_id`) : son score est retenu tant que cet examen
  est ouvert (`end_date > now()`, la borne du verrou), réponses ou non — une
  participation auto-soumise sans réponse a un score `0` enregistré qui, lu
  pendant la fenêtre, fabrique « 0 réussi · 0 % ». Une session
  d'entraînement n'a pas d'examen propre : retenue par ses réponses seules.
  La retenue s'indexe sur le PROPRIÉTAIRE du score, pas sur le lecteur : son
  score lu par un camarade (classement) ou envoyé par courriel (cron de
  clôture) lui revient. `scoreWithheldFor(viewer, …)` est la forme
  « je lis mes propres scores » (admin jamais retenu) ; un lecteur admin lit
  le score brut partout. Toute lecture étudiant d'un `score` (session,
  participation, historique, graphique, moyenne, classement, courriel) le
  projette en `null` quand il est retenu et l'exclut des agrégats — une
  moyenne sans lecture lisible est `null`, jamais `0` (faux « 0 % »). Les
  composants rendent `null` comme « retenu » (`formatScore`). Le score n'est
  jamais recalculé ni réécrit ; les vues de passation (`getExamSession`,
  `getTrainingSessionById`) ne le portent pas. Corollaire :
  `completeTrainingSession`/`finalizeExam` ne renvoient plus le décompte des
  justes au navigateur.
- **Population d'examen = un seul module**, `features/exams/population.ts`
  (`SUBMITTED`, `populationAccount`, `examPopulation`) : classement candidat,
  percentile et chiffres de la fiche. Ne pas recopier `role = 'user'`,
  `deleted_at IS NULL` ni la liste des statuts soumis (`isSubmitted` en est la
  forme TS). Un fragment SQL construit au chargement lit `@/db/schema` à
  l'import : jamais dans un module largement importé (`dal.shared.ts`), sinon
  un test unitaire qui mocke le schéma partiellement casse au chargement.
- **Tableau de bord étudiant** (`features/analytics/dal.dashboard.ts`) :
  `getMyDashboard(period)` porte la période (`lib/dashboard-period.ts`,
  journées civiles de l'Est, aujourd'hui compris) et la tendance contre la
  période précédente de même durée. Filtrés : score moyen, séries, courbes ;
  toujours sur « Tout » : examens complétés, disponibles, anneau N / M. Une
  participation soumise à un examen encore ouvert COMPTE comme complétée (le
  compte ne révèle rien) mais son score retenu sort de toute moyenne, de la
  courbe et du « N / M réussis ». Le taux de complétion divise par les examens
  disponibles (actifs, dans l'audience) les participations à CES examens :
  jamais celles d'un examen désactivé depuis. Moyennes et tendance au
  PLANCHER (`floor`, tendance calculée sur les moyennes brutes) : 59,67 ne
  s'affiche jamais 60 % « réussite », un recul de 1,7 s'affiche −2. La
  courbe d'entraînement est une moyenne par semaine civile
  (`date_trunc('week', … at time zone …)`), bornée strictement par la
  période : une semaine entamée avant ne compte que ses jours dans la
  période (`startDay`, libellé « Depuis le … ») ; une semaine sans série
  lisible n'a pas de point, jamais un point à 0.

## Composition d'un examen

- **Examen en préparation** (`exams.finalized_at IS NULL`, `CONTEXT.md`) :
  dates et durée nullables, exigées par la contrainte
  `exams_finalized_complete` dès la finalisation. Toute lecture étudiante
  filtre `finalized_at IS NOT NULL` (liste, page, classement, résultats,
  tableau de bord) et lit les dates par `finalizedDates`/`finalizedDate`
  (`features/exams/dal.shared.ts`), qui affirment l'invariant ; une lecture
  qui part d'une participation n'a pas à filtrer (`startExam` refuse un examen
  non finalisé, admin compris, et le jeu ne repasse en préparation qu'avant
  la première participation). Côté admin, `getAdminExam` et `adminPhaseOf`.
  Un compteur par phase filtre `finalized_at` en plus des dates : un examen
  remis en préparation garde les siennes. Écritures : `saveExam`
  (« Enregistrer » : titre et visé suffisent à le rendre valide, mais dates,
  pause et audience sont toujours envoyées, un champ omis est refusé, jamais
  lu comme « effacer » ; seul `questionIds` absent conserve le jeu) et
  `finalizePreparedExam` partagent avec les écritures du compositeur les
  étapes de `features/exams/actions.ts`, sous le verrou `exams FOR UPDATE` ; changer
  le jeu ou le visé d'un examen finalisé le remet en préparation (un visé
  ramené à la taille du jeu n'est pas un changement). Tout écrivain pose
  `finalized_at` et `target_question_count` explicitement : aucune des deux
  colonnes n'a de défaut, fixtures de test comprises. Le verrou
  de clé anonyme couvre aussi un examen en préparation, dates ou non.
- **Compositeur d'examen** : la règle de complétion est pure
  (`planCompletion`, `features/exams/completion.ts` : prorata des questions
  disponibles par domaine, anciennes puis récentes du même domaine, report
  sur les autres domaines, jamais une clé à vérifier) ; la DAL fournit l'offre
  (`getBankSupply`) et tire au hasard (`drawFromBank`). Les écritures
  (`addExamQuestions`, `removeExamQuestions`) passent par `composeTx`, sous le
  verrou de l'examen, avec les gardes de `saveExam` (participation, visé) ;
  l'aperçu n'écrit rien.
- **Dernière utilisation** : `notUsedInLastExams(n, colonne)`
  (`features/questions/last-use.ts`), prédicat corrélé (examens par date
  d'ouverture, désactivés compris, examens en préparation exclus) ; sa
  lecture par question est `getLastUses` (même ordre), et une question est
  récente quand cet examen est l'un des `RECENT_EXAMS_DEFAULT` derniers.

## Banque de questions

- **Clé à vérifier / clé confirmée = une règle, deux formes** :
  `keyReview` (`features/questions/key-review.ts`, pure : fiche, formulaire)
  et `keyToVerifySql` (`features/questions/dal.ts` : onglet, compteur, export),
  sur les mêmes constantes. Une confirmation tient tant que les réponses n'ont
  pas doublé (10 nouvelles au moins) ; `updateQuestion` l'efface quand
  l'énoncé, les options ou la clé changent. **Choix figés** : `updateQuestion`
  refuse, sous verrou de la ligne, un changement de clé ou d'options tant
  qu'un examen ouvert (`end_date > now()`) et finalisé contient la question.
- **Référentiel des objectifs du CMC** (`features/objectives/`, vocabulaire
  dans `CONTEXT.md`) : toute question porte `objective_id`, jamais un libellé
  libre. Les règles d'un libellé et la clé normalisée vivent dans `label.ts`
  (pur, partagé avec le formulaire ; la migration 0023 recopie le nettoyage
  en SQL). Toute écriture d'un libellé pose aussi
  `cmc_objectives.normalized_key = objectiveKey(label)` (`labelled`, fixtures
  de test comprises), calculée en JS : Postgres n'a pas d'équivalent exact de
  `\p{Diacritic}` ni de `toLocaleLowerCase("fr")`, ne jamais la recalculer en
  SQL. Unicité de la clé entre objectifs valides : index partiel
  `cmc_objectives_normalized_key_key` (`WHERE needs_fix = false`, les valeurs
  invalides se réduisant souvent à une clé vide). `assertUniqueKey` la
  vérifie d'abord sous `pg_advisory_xact_lock` pour proposer l'objectif
  existant ; un `23505` (écriture hors du verrou) donne le même refus, sans
  capture (`settle`). Ordre des verrous : objectif(s), puis question —
  partout (`updateQuestion`, fusion, correction), sinon une fusion
  concurrente interbloque. Une entrée `needs_fix` (valeur invalide) n'est
  proposée nulle part et refusée par `createQuestion`/`updateQuestion`. La
  fusion et la correction ne changent que `objective_id` (date de
  modification comprise). Lecture du libellé : `objectiveLabelSql`, corrélée
  sur `"questions"`. La vitrine passe par `getCachedDomainObjectives`
  (étiquette `objectives`, 14 j), que toute écriture du référentiel invalide,
  comme les écritures de question qui changent domaine, objectif ou
  existence.
- **Suppression de question = hybride** (`deleteQuestion`) : on TENTE le hard
  delete, arbitré par les FK `restrict` — Postgres lève `23001`
  (restrict_violation ; PAS `23503`, réservé aux inserts) → fallback soft
  delete ; aucun check applicatif → aucune race. Hard = cascade DB + purge S3
  best-effort ; soft = médias CONSERVÉS (encore servis en passation/correction :
  `exams/dal` ne filtre pas `deletedAt`, c'est voulu). Audit/GC des orphelins :
  `bun run audit:medias` (dry-run ; `--purge` explicite ; exige `s3:ListBucket`).
