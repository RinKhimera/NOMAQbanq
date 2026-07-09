# Handoff — Campagne fix des issues GitHub (2026-07-08)

Reprise dans une session fraîche. Contexte : audit du 2026-07-07 des 13 issues
ouvertes (toutes issues de revues adversariales), fixées par incréments — chaque
incrément suit le même cycle : **TDD (RED observé avant le code) → gates →
revue adversariale dans une session séparée → triage → commit → PR**.

## Fait et mergé dans main (ne pas re-traiter)

| PR (mergée) | Contenu                                                                                                                                                                                                                                                                | Issues closes                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| #93         | Anti-triche : verrou `getOpenExamLockedQuestionIds` sur les 5 canaux de révision (explications lazy branches training+examen, `getTrainingSessionById` tuteur inclus, `getTrainingSessionResults`, `getParticipantExamResults`, reveal tuteur de `saveTrainingAnswer`) | #86                                   |
| #94         | Concurrence training : UPDATE gardés `status='in_progress'` + `.returning()` (complete/abandon + chemin expiré de `saveTrainingAnswer`), refus des sessions expirées                                                                                                   | #82, #83 (+ epic #77 fermé à la main) |
| #95         | Stripe : `amount_total`/`currency` réels persistés au fulfillment, **XAF converti zéro-décimal → centièmes**, valeurs inexploitables → provisoire conservé + log                                                                                                       | #79, #80                              |

## Restant, par priorité

1. **#91 — P0 sécurité** : `scoreQuizAnswers` (`features/questions/actions.ts`,
   quiz marketing public SANS auth) sert la clé de N'IMPORTE QUELLE question de
   la banque via `getQuizAnswerKey` (`features/questions/dal.ts:522`). Deux
   angles : fuite pendant un examen ouvert + scraping de la banque (50/lot,
   pas de rate-limit). **C'est la tâche de cette session** — passer par
   /brainstorming → spec + plan → revue de design AVANT d'implémenter.
2. **#84** : sortir `successRate`/`rating` du DAL marketing → constante
   éditoriale centralisée (`constants/index.tsx`). Petit.
3. **#85** (après #84) : vrai taux de réussite — ⚠️ valider les seuils (60 %
   réussite, 50 participations) avec le responsable produit AVANT de coder.
4. **#87 + #88** : doc Stripe obsolète + code mort « Bientôt ». Rapides,
   groupables en une PR.
5. **#92** : webhook — accepter `no_payment_required` (promo 100 %).
6. **#81** : audit historique Stripe — ⚠️ lecture PROD (Stripe live + base),
   demander les accès avant de commencer. Sa décision de backfill conditionne
   la fermeture de l'epic #76.

Epics encore ouverts : #76 (attend #81), #78 (attend #84+#85).

## Acquis techniques pour #91 (vérifiés dans le code)

- Le quiz marketing tire ses questions **dans toute la banque**
  (`getRandomQuizQuestions`, aléatoire) — pas de pool démo. Le fix ne peut donc
  pas borner à un pool : exclure les questions d'examens **ouverts**
  (`endDate > now`) et rate-limiter.
- `getOpenExamLockedQuestionIds(userId, questionIds)`
  (`features/exams/dal.ts`) : helper mergé par PR #93, corrélé à un utilisateur
  (participation). Pour #91 l'appelant est **anonyme** → écrire une variante
  sans dimension utilisateur (toute question d'un examen ouvert), au même
  endroit.
- Pattern rate-limit existant : `lib/upload-rate-limit.ts` (consommé à l'étape
  presign). À adapter aux Server Actions publiques du quiz.
- Piste de la revue : borner aussi le scoring aux questions réellement servies
  par `loadRandomQuizQuestions` (le client ne score que ce qu'on lui a donné) —
  décision de design à trancher au spec.

## Conventions et pièges de la campagne

- `bun run test` (JAMAIS `bun test`) ; `bun run test:integration` = branche
  Neon éphémère (~90 s) ; `test:integration:keep` la conserve pour itérer.
- Tests d'intégration : `fileParallelism: false` → agrégats testables en
  delta-vs-baseline. Cleanup `afterAll` dans l'ordre des FK.
- Scénarios anti-triche : isoler les branches d'autorisation (une question dans
  examen clos + ouvert est accordée par l'AUTRE branche → témoins dédiés,
  cf. q10 « clos seul » et participation `in_progress` dans
  `tests/integration/exams.test.ts`).
- SonarLint (`typescript:Sxxxx`) = IDE-only, ne casse pas `bun run check` — ne
  pas refactorer pour lui (règle `.claude/rules/data-layer.md`).
- Revue adversariale : générer le prompt avec le skill `adversarial-review-prompt`,
  l'exécuter dans une session séparée, trier ici, supprimer le rapport après
  triage (artefact jetable, jamais committé).
- Si un worktree git vit sous `.claude/worktrees/`, le `prettier --check .` du
  checkout principal le scanne aussi → échecs fantômes si le worktree est sur
  une vieille base. (Envisager `.prettierignore`.)

## Gates avant tout commit

`bun run check` (prettier + tsc + eslint) · `bun run test` · `bun run test:integration`.
