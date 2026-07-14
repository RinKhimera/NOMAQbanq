# Récupération du merge fantôme PR #96 + campagne de clôture des issues

Date : 2026-07-13 · Branche : `fix/recuperation-merge-fantome`

## Constat

Le squash `c7638a2` (PR #96) annonçait « Closes #84 #85 #87 #88 #91 » mais ne
contient **que** le travail #91 (21 fichiers : quiz-token, rate-limit, docs #91).
La PR a été mergée depuis un état obsolète de la branche distante ; GitHub a
fermé les 4 autres issues sans que leur code n'atteigne `main`.

Preuves :

- `features/marketing/dal.ts:56-57` porte encore `successRate: "85%"` /
  `rating: "4.9/5"` dans `main` ;
- `git show c7638a2 --numstat` : aucun fichier `features/marketing/**`,
  `constants/index.tsx`, `docs/STRIPE_FRONTEND_SPEC.md` ni
  `profile-preferences.tsx`.

Les commits perdus vivent uniquement sur la branche locale
`fix/91-quiz-public-answer-key` (à conserver jusqu'à la fin de la récupération).

## Campagne B — récupération (cette branche)

Cherry-pick des 10 commits perdus, dans l'ordre chronologique d'origine :

| #   | SHA     | Objet                                                               |
| --- | ------- | ------------------------------------------------------------------- |
| 1   | 8d34117 | docs : spec + plan taux de réussite marketing (#84 #85)             |
| 2   | 942156c | #88 : retrait du scaffolding mort de `profile-preferences`          |
| 3   | 60b0484 | #87 : réécriture `docs/STRIPE_FRONTEND_SPEC.md`                     |
| 4   | 4126f27 | docs : triage revue design #84/#85                                  |
| 5   | 977f8c6 | #84 : constante `MARKETING_CLAIMS` (`constants/index.tsx`)          |
| 6   | fc611cd | #85 : `resolveSuccessRate` + seuils (`features/marketing/lib.ts`)   |
| 7   | c8438e3 | #91 : fix du test flaky « jeton falsifié »                          |
| 8   | c139516 | #85 : successRate calculé sur les participations, `rating` hors DAL |
| 9   | 2a0982e | #84 : les affichages marketing lisent `MARKETING_CLAIMS`            |
| 10  | 4b5b194 | #87 : corrections doc post-revue                                    |

Conflits attendus : mineurs, sur les composants marketing touchés depuis par
`96f6987` (fallbacks stats) et les évolutions de `hooks/useMarketingStats.ts`
(PR #97/#100/#107). Résolution en faveur de l'intention combinée (fallbacks de
main + claims centralisés de la branche).

Ce code a déjà été revu (revue d'implémentation groupée : « OUI mergeable,
0 bloquant ») — pas de nouvelle revue du contenu, seulement des résolutions de
conflits.

Gates : `bun run check`, `bun run test`, coverage ≥ 80 %, `bun run
test:integration`.

Critères d'acceptation (reprennent l'épic #78) :

- [ ] `grep -rn "85%\|4\.9/5"` ne retourne plus rien hors `MARKETING_CLAIMS`
      (source unique) et docs historiques ;
- [ ] `features/marketing/dal.ts` ne retourne plus de constante déguisée en
      métrique (`rating` hors du type, `successRate` calculé au-delà du seuil) ;
- [ ] les gates passent.

## Campagne A — Stripe (branche suivante, après B)

1. **#92** : le webhook accepte `payment_status ∈ {"paid", "no_payment_required"}`
   au fulfillment (promo 100 %) ; test d'intégration `amountTotal: 0` →
   transaction `completed`, `amountPaid = 0`, accès accordé ; idempotence
   inchangée.
2. **#81** : script one-off `scripts/` de lecture seule (clé live limitée
   existante `nomaqbanq-prod-app`, fournie localement le moment venu ; lecture
   DB prod via branche Neon éphémère) ; rapport chiffré posté sur l'issue ;
   décision backfill documentée → fermeture de l'épic #76.

Outillage : Stripe CLI profil `nomaqbanq` (mode test) + `stripe listen` pour la
vérification vraie-vie de #92.

## Toute fin — purge Convex (dans la dernière PR)

- Supprimer `.claude/skills/convex-*` (6 dossiers) et
  `scripts/import-from-convex.ts` ;
- purger les mentions Convex de `.claude/CLAUDE-GUIDELINES.md`,
  `.claude/rules/data-layer.md`, `.claude/settings.local.json`, `AGENTS.md` et
  des commentaires de `features/marketing/dal.ts`, `lib/upload-rate-limit.ts`,
  `app/api/e2e/route.ts` ;
- les docs historiques (`docs/superpowers/**`, handoffs) sont conservées telles
  quelles (archives).

## PR

Aucun push avant la toute fin (demande explicite). Deux PR : campagne B, puis
campagne A (qui embarque la purge Convex). Les épics #78 et #76 se ferment
après merge, avec un commentaire de traçabilité expliquant le merge fantôme.
