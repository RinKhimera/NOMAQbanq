# Bascule production — migration média Bunny → S3 (checklist)

> Couplée au go-live de toute la branche `migration/drizzle-neon` (flipper
> `cdn.nomaqbanq.ca` affecte la prod actuelle Convex/Bunny → tout part ensemble).
>
> Ressources : compte AWS `710353053639`, région `us-east-2`, bucket
> `nomaqbanq-710353053639-us-east-2-an`, rôle `nomaqbanq-s3-media`, distribution
> CloudFront `dn5nrir6z5nr7.cloudfront.net`, cert ACM `cdn.nomaqbanq.ca` (us-east-1),
> DNS chez **Porkbun**.

> **Stratégie retenue : cutover en une fenêtre, « déployer-en-maintenance = le
> gel ».** Le déploiement de la nouvelle app (avec `MAINTENANCE_MODE=1`) remplace
> l'app Convex → Convex cesse d'être écrit. On snapshot Convex **APRÈS** ce
> déploiement : aucune écriture n'est perdue (impossible avec import-avant-deploy,
> où l'ancienne app reste live et diverge). Blocus = `proxy.ts` (cf. AGENTS / mémoire).

## A. Préparation (sans impact prod — à l'avance)

- [ ] **Env vars Vercel Production** : `S3_REGION=us-east-2`, `AWS_ROLE_ARN`,
      `S3_BUCKET` ; clés statiques `AWS_ACCESS_KEY_ID/SECRET` **jamais** sur Vercel.
      ⚠️ Région nommée `S3_REGION` (PAS `AWS_REGION`, réservée par le runtime).
- [ ] **IAM rôle `nomaqbanq-s3-media`** : ajouter `tmp/*` (PutObject/DeleteObject) +
      `GetObject` sur `tmp/*` (source de CopyObject), **et règle Lifecycle S3 `tmp/`
      (expire 1 j)** active. (Sans ça l'upload prod casse / orphelins s'accumulent.)
- [ ] **Pré-copier les médias Bunny → S3** (cf. §C) — idempotent, ré-exécuté en B
      pour rattraper. Spot-check `curl -I https://dn5nrir6z5nr7.cloudfront.net/<clé>`.
- [ ] **Migrer le SCHÉMA de la base production Neon (vide)** : pointer
      `DATABASE_URL_UNPOOLED` sur la branche **production**, `bun run db:migrate`,
      puis **remettre** `DATABASE_URL_UNPOOLED` sur develop (dev local).
- [ ] **Préparer le blocus** : poser sur Vercel Production `MAINTENANCE_MODE=1` et
      `MAINTENANCE_BYPASS_TOKEN=<secret>` (NE PAS redéployer maintenant — ça prendra
      effet au déploiement de B).
- [ ] **Abaisser le TTL DNS** de `cdn.nomaqbanq.ca` chez Porkbun (~300 s), ~24 h avant.
- [ ] **Import à blanc** sur une branche Neon **jetable** (dé-risque le run réel).

## B. Bascule (fenêtre unique)

> L'import (`scripts/import-from-convex.ts`) est idempotent (`onConflictDoNothing`)
> et a déjà servi pour `develop`. Rollback tant que le DNS n'est pas basculé :
> re-promouvoir l'ancien déploiement Convex sur Vercel.

- [ ] **Merge `migration/drizzle-neon` → `main` + déploiement** (avec
      `MAINTENANCE_MODE=1` actif) → la nouvelle app sert **503 partout** (Server
      Actions gelées) et **remplace l'app Convex → Convex figé**.
- [ ] **Export Convex final** → décompresser dans `convex-snapshot/` (⚠️ PII : local,
      gitignoré ; ne jamais committer). Convex étant figé, le snapshot est cohérent.
- [ ] **Importer les données** : `bun scripts/import-from-convex.ts` (cible la branche
      production via `DATABASE_URL_UNPOOLED`) → vérifier le tableau de comptes
      (questions, user, exams…) + orphelins ignorés. *(Remettre `DATABASE_URL_UNPOOLED`
      sur develop après.)*
- [ ] **Copie média finale sur la base production** : `bun scripts/migrate-media-to-s3.ts`
      pointé prod (idempotent → rattrape tout média référencé pas encore sur S3).
- [ ] **Flip DNS Porkbun** : `cdn.nomaqbanq.ca` (CNAME) → `dn5nrir6z5nr7.cloudfront.net`.
- [ ] **Smoke test via bypass** : `https://<prod>/?bypass=<token>` (pose le cookie) →
      upload avatar + image de question (édition), affichage via `cdn.nomaqbanq.ca`,
      `curl -I` (200 + `x-content-type-options: nosniff`).
- [ ] **Lever le blocus + nettoyer l'env Production en un seul redéploiement** :
      retirer `MAINTENANCE_MODE` + `MAINTENANCE_BYPASS_TOKEN`, retirer les morts
      Convex/Clerk, vérifier `BETTER_AUTH_URL` = domaine canonique, retirer tout
      override Preview-only (`NEXT_PUBLIC_CDN_HOSTNAME`, `BETTER_AUTH_URL=…vercel.app`)
      → redéploiement → **app ouverte à tous sur Neon**.

## C. Migration des données — script piloté par la base

`scripts/migrate-media-to-s3.ts` copie le média **référencé en base** (avatars,
images de questions, figures d'explication) depuis l'API Bunny Storage vers S3,
à la même clé. Idempotent (skip si déjà sur S3), re-jouable.

1. **Remettre temporairement** dans `.env.local` : `BUNNY_STORAGE_ZONE_NAME`,
   `BUNNY_STORAGE_API_KEY` (+ `BUNNY_STORAGE_HOST` si zone régionale, ex.
   `ny.storage.bunnycdn.com`). Les vars S3 (`S3_REGION`, `S3_BUCKET`,
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) sont déjà là (dev local).
2. **Dry-run** (aucune écriture) :
   ```bash
   bun scripts/migrate-media-to-s3.ts --dry-run
   ```
   → vérifier le nombre de clés et le ratio « à copier / déjà sur S3 ».
3. **Copie réelle** :
   ```bash
   bun scripts/migrate-media-to-s3.ts
   ```
4. **Copie incrémentale finale** : relancer la même commande juste après la
   bascule (rattrape les stragglers ; les déjà-copiés sont skippés).

> Le script lit depuis l'API Bunny Storage (autoritatif), donc indépendant de
> l'état du DNS `cdn.nomaqbanq.ca` → exécutable avant ou après le flip.
> Alternative « miroir intégral » : rclone via Bunny FTP (copie tout le zone,
> orphelins inclus ; FTP Bunny parfois capricieux).

## D. Post-bascule

- [ ] Surveiller Sentry / logs 24-48 h (uploads, affichage images).
- [ ] **Rétention Bunny ~2 semaines** (rollback = repointer le DNS vers Bunny ;
      la base n'a pas changé) → puis **purge Bunny** + retrait des credentials
      Bunny (et des vars temporaires `BUNNY_*` de `.env.local`).
- [ ] Nettoyage optionnel : retirer `*.cloudfront.net` de `next.config.ts` et
      `NEXT_PUBLIC_CDN_HOSTNAME` de l'env Preview.

## Rollback

Tant que la rétention Bunny tient : repointer le CNAME `cdn.nomaqbanq.ca` vers le
pull zone Bunny chez Porkbun. Le DNS et la donnée Bunny restent intacts ~2 semaines ;
la base n'ayant pas changé, l'ancienne appli (si redéployée) refonctionne.
