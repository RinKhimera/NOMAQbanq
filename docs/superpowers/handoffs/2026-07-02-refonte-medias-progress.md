# Handoff — Refonte médias + séparation S3 (2026-07-02)

État au moment de la compression de session. Branche : `dev-2`, **rien n'est poussé**.

## Campagne terminée (implémentation + infra)

Spec : `docs/superpowers/specs/2026-07-02-refonte-medias-design.md` (validé,
revue adversariale de DESIGN intégrée avant implémentation).
Plan : `docs/superpowers/plans/2026-07-02-refonte-medias.md` (11 tâches, toutes
exécutées sauf Task 11 devenue caduque — l'audit prod a été fait directement).

### Commits code de la campagne (à couvrir par la revue d'implémentation)

- `ad047a3` UserAvatar unique + tests (mock Radix pour happy-dom)
- `554c630` / `50920db` / `c0ee0df` migration des 12 sites + suppression code mort `user-details-dialog`
- `82b553e` revert `ui/avatar.tsx` au stock shadcn
- `a1a5f33` fix orphelin remplacement avatar (`avatarStoragePathFromImageValue` dans `lib/cdn.ts`) + garde anti-IDOR `avatars/{userId}/` dans `confirmAvatarUpload`
- `c0ab4be` fix test intégration pré-existant (host CDN hardcodé)
- `7ecb03c` `deleteQuestion` hybride hard/soft + toast + tests intégration
- `41f6f71` `lib/media-audit.ts` (pur) + tests
- `153e045` `scripts/audit-medias.ts` + `bun run audit:medias`
- Docs : `3fdc1a5`→`dc39611` (plan), `3755f3a`/`c1744db`/`a5372f1` (rules+spec)

### Découvertes clés (non évidentes)

- **`ON DELETE RESTRICT` lève `23001` (restrict_violation), PAS `23503`** —
  découvert au test d'intégration ; `isForeignKeyViolation` accepte les deux
  (`features/questions/actions.ts`). Documenté dans `.claude/rules/data-layer.md`.
- Gates : tout vert au dernier passage — tsc ✓, eslint ✓, 878 tests frontend ✓,
  214 intégration ✓. `prettier --check .` global échoue UNIQUEMENT sur des
  artefacts de revue non suivis dans `docs/superpowers/reviews/` (faux signal).

## Infra AWS (faite via user IAM `claude-ops`, policy « B déléguée »)

- **Buckets séparés** : dev = `nomaqbanq-710353053639-us-east-2-dev` (PAB, CORS
  localhost+vercel.app, Lifecycle `expire-tmp` 1 j) ; prod = `…-us-east-2-an`
  (inchangé, bucket policy nettoyée d'un ARN fantôme).
- **CloudFront dev dédié** : `E2J8MU7I2MJZ69` → `d3hdk94nda1u0x.cloudfront.net`
  (OAC réutilisé E24FMB7W6PMGDI). La distribution prod `E3C195G9FCGY7I`
  (`cdn.nomaqbanq.ca`) n'a pas été touchée. Il n'y a JAMAIS eu de « CF dev »
  avant : `dn5nrir6z5nr7` était le domaine par défaut de la distribution prod.
- Policy de la clé app dev (`nomaqbanq-s3-local-dev-policy-2`) : bucket dev
  UNIQUEMENT + `s3:ListBucket`/`GetLifecycleConfiguration` (audit). `.env.local`
  mis à jour (S3_BUCKET, NEXT_PUBLIC_CDN_HOSTNAME) → **relancer `bun dev`**.
- **Nettoyage Clerk** : `user.image` `img.clerk.com` → NULL, DEV (182) et
  PROD (183) faits. L'utilisateur peut fermer son projet Clerk sans impact.
- **Audits finaux** : dev et prod = 0 orphelin, 0 lien cassé, Lifecycle active,
  0 GC. (Reste 1 résidu de test dans le bucket DEV, 60 Ko, purgeable après 24 h
  via `bun run audit:medias -- --purge`.)

## Prochaine étape immédiate : trier le rapport de revue d'implémentation

L'utilisateur colle le rapport d'une revue adversariale d'IMPLÉMENTATION lancée
dans une autre session (fichier probable :
`docs/superpowers/reviews/2026-07-02-revue-impl-routes-et-medias.md`, non suivi —
il couvre peut-être AUSSI la campagne « routes françaises » antérieure).

Protocole de triage (établi avec l'utilisateur) :

1. Pour CHAQUE constat : vérifier contre le code réel (ne pas croire sur parole),
   puis corriger (commit ciblé conventionnel, sans attribution Claude) ou réfuter
   avec preuve.
2. Le rapport est un **artefact jetable** : ne JAMAIS le committer ; le supprimer
   une fois le triage terminé (et il fait échouer `prettier --check .` tant qu'il
   existe).
3. Gates après correctifs : `bun run check` (tolérer le faux signal prettier sur
   les .md de reviews non suivis), `bun run test` ; `bun run test:integration`
   seulement si `features/**` touché.
4. Piège connu : ne pas « corriger » la détection FK vers 23503-seul (c'est bien
   23001 pour RESTRICT), ne pas réintroduire la résolution CDN dans
   `components/ui/avatar.tsx` (stock voulu), ne pas re-tester `getInitials`
   (couvert par `tests/lib/utils.test.ts`).

Après triage : proposer e2e (`/e2e-scenario`, parcours upload avatar — CDN dev
neuf) puis décider du merge/push de `dev-2` (jamais sans demande explicite).
