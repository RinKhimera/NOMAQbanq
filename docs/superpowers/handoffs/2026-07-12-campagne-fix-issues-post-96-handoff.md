# Handoff — Campagne fix issues GitHub, post-merge PR #96 (2026-07-12)

Reprise dans une session fraîche après compaction. Ce fichier est le point de
reprise ; la mémoire auto (`project_campagne_fix_issues_github.md`) porte le
détail complet.

## Ce qui vient d'être livré (PR #96 ✅ MERGÉE dans main, squash `c7638a2`)

Une seule branche empilée `fix/91-quiz-public-answer-key`, mergée en squash.
Les 5 issues sont **closes** :

- **#91** (P0 sécurité) — quiz marketing public : jeton HMAC liant scoring↔tirage,
  exclusion des examens ouverts (tirage SQL + re-check), rate-limit IP
  (`quiz_rate_limits`), clamp 10, écrans d'erreur client. E2E validé.
- **#84 + #85** — taux de réussite marketing : constante `MARKETING_CLAIMS`,
  `resolveSuccessRate` (seuils 60/50/70), agrégat SQL `count(*) filter`, `rating`
  retiré du type, affichages rebranchés.
- **#87** — doc `docs/STRIPE_FRONTEND_SPEC.md` réécrite (Convex → Drizzle).
- **#88** — scaffolding mort « Bientôt » retiré de `profile-preferences.tsx`.

Chaque lot est passé par revue design + revue implémentation (adversariales,
sessions séparées), triées. Gates au merge : `check` exit 0 · `test` 899 ·
`test:coverage` exit 0 · `test:integration` 270.

## État git à la reprise

- Working tree **propre**. HEAD encore sur `fix/91-quiz-public-answer-key`
  (obsolète : squash-mergée, ses commits ne sont pas ancêtres de `main` — normal).
- `origin/main` = `c7638a2` (contient tout #96). **Local main est en retard.**
- **Premier geste** : `git checkout main && git pull` (ou reset sur origin/main),
  puis **nouvelle branche par issue**. Ne rien empiler sur `fix/91`.
- ⚠️ **Stash `stash@{0}` = "On develop: !!GitHub_Desktop<develop>"** : c'est un
  WIP de l'utilisateur (refonte dashboard), **PAS à moi**. Ne jamais le pop/drop.
  Voir `feedback_never_stash_pop_blindly`.

## Restant de la campagne (issues ouvertes vérifiées 2026-07-12)

1. **#92** — Webhook Stripe : une session promo 100 % (`payment_status =
no_payment_required`) n'accorde jamais l'accès (le gate est `=== "paid"`).
   Self-contained, **pas d'accès prod requis**. Candidat évident pour la
   prochaine session. Fichier : `app/api/stripe/webhook/route.ts` (le switch
   `checkout.session.completed` ne traite que `payment_status === "paid"`).
2. **#81** — Audit des transactions Stripe historiques (écart montant/devise,
   décision de backfill). ⚠️ **Lecture PROD (Stripe live + base) — demander les
   accès à l'utilisateur AVANT de commencer.** Sa décision ferme l'épic **#76**.
3. **Épic #78** (stats marketing honnêtes) — ses sous-issues #84+#85 sont FAITES.
   Le « rating 4.9/5 » reste éditorial **par design** (aucune table d'avis en
   base). #78 est donc _potentiellement closable avec caveat_ — **décision
   produit de l'utilisateur**, ne pas fermer d'office.
4. **Épic #76** (Stripe montant/devise) — attend #81.

## Conventions de la campagne (rappel)

- Cycle par incrément : brainstorming → spec+plan (`docs/superpowers/{specs,plans}`)
  → revue design (session séparée) → TDD (RED observé) → revue implém → triage →
  commit. Rapports de revue = jetables, supprimés après triage.
- `bun run test` (JAMAIS `bun test`) ; `bun run test:integration` = branche Neon
  éphémère clonée de `develop` (~90-120 s, baseline JAMAIS vide → oracles exacts,
  pas de tautologie). Ne jamais lancer `bun dev` soi-même.
- ⚠️ **Après un `db:generate`, appliquer `bun run db:migrate` à la main sur dev**
  (la branche Neon dev ne se migre pas seule ; prod migre au build). Sinon l'app
  dev crashe 500 sur la nouvelle table. Voir `reference_vercel_migrate_on_deploy`.
- Commits conventionnels SANS attribution Claude. Committer/pusher/PR seulement
  quand l'utilisateur le demande ; sur main → brancher d'abord.
