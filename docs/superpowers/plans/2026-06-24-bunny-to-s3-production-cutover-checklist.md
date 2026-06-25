# Bascule production — migration média Bunny → S3 (checklist)

> Couplée au go-live de toute la branche `migration/drizzle-neon` (flipper
> `cdn.nomaqbanq.ca` affecte la prod actuelle Convex/Bunny → tout part ensemble).
>
> Ressources : compte AWS `710353053639`, région `us-east-2`, bucket
> `nomaqbanq-710353053639-us-east-2-an`, rôle `nomaqbanq-s3-media`, distribution
> CloudFront `dn5nrir6z5nr7.cloudfront.net`, cert ACM `cdn.nomaqbanq.ca` (us-east-1),
> DNS chez **Porkbun**.

## A. Préparation (sans impact prod)

- [ ] **Env vars vérifiées** (Vercel Preview/Prod : `S3_REGION`=`us-east-2`,
      `AWS_ROLE_ARN`, `S3_BUCKET` ; clés statiques `AWS_ACCESS_KEY_ID/SECRET`
      **uniquement** en local, jamais sur Vercel). ⚠️ Région nommée `S3_REGION`
      (PAS `AWS_REGION`, réservée par le runtime Lambda de Vercel).
- [ ] **IAM rôle `nomaqbanq-s3-media`** : `tmp/*` (PutObject/DeleteObject) +
      `GetObject` sur `tmp/*` appliqués, **et règle Lifecycle S3 `tmp/` (expire 1 j)**
      active. (Sans ça, l'upload prod casse / les orphelins s'accumulent.)
- [ ] **Copier les données Bunny → S3** (cf. §C) + **vérifier** : comptes du
      résumé du script, et spot-check `curl -I https://dn5nrir6z5nr7.cloudfront.net/<clé>`.
- [ ] **Abaisser le TTL DNS** de `cdn.nomaqbanq.ca` chez Porkbun (ex. 300 s),
      ~24 h avant la bascule.
- [ ] **Répéter l'import de données à blanc** : export Convex de test →
      `bun scripts/import-from-convex.ts` sur une branche Neon **jetable** → vérifier
      le tableau de comptes (de-risque le run prod réel).
- [ ] (Optionnel) **Revue antagoniste** des correctifs (domaine + orphelins).

## B. Bascule (fenêtre de maintenance)

> Fais l'**import des données en dernier** (au plus près du go-live) pour ne pas
> perdre les écritures Convex faites entre-temps. L'import
> (`scripts/import-from-convex.ts`) est idempotent (`onConflictDoNothing`) et a
> déjà servi pour `develop`.

- [ ] **(Optionnel) Figer/limiter les écritures Convex** pendant la fenêtre.
- [ ] **Export Convex final** → décompresser dans `convex-snapshot/`
      (⚠️ PII : reste local, déjà gitignoré ; ne jamais committer).
- [ ] **Schéma base production** : pointer temporairement `DATABASE_URL_UNPOOLED`
      sur la branche Neon **production**, puis `bun run db:migrate`.
- [ ] **Importer les données** : `bun scripts/import-from-convex.ts` (cible la branche
      production via `DATABASE_URL_UNPOOLED`) → vérifier le tableau de comptes (questions,
      user, exams…) + orphelins ignorés. *(Remettre `DATABASE_URL_UNPOOLED` sur develop
      après, pour le dev local.)*
- [ ] **Copie média sur la base production** : `bun scripts/migrate-media-to-s3.ts`
      pointé sur la base **production** (idempotent → copie tout média référencé pas
      encore sur S3).
- [ ] **Nettoyer les env vars Production** : retirer les morts Convex/Clerk,
      vérifier `BETTER_AUTH_URL` prod = domaine canonique, retirer tout override
      Preview-only (`NEXT_PUBLIC_CDN_HOSTNAME`, `BETTER_AUTH_URL=…vercel.app`) qui
      traînerait en prod.
- [ ] **Merge `migration/drizzle-neon` → `main`** + déploiement production.
- [ ] **Flip DNS Porkbun** : `cdn.nomaqbanq.ca` (CNAME) → `dn5nrir6z5nr7.cloudfront.net`.
- [ ] **Copie incrémentale finale** Bunny → S3 (`bun scripts/migrate-media-to-s3.ts`)
      pour rattraper les derniers uploads via l'ancienne appli.
- [ ] **Smoke test prod** : upload avatar + image de question (en édition),
      affichage via `cdn.nomaqbanq.ca`, `curl -I` (200 + `x-content-type-options: nosniff`).

> ⚠️ Fenêtre entre *déploiement* et *flip DNS* : un upload juste après le déploiement
> part sur S3 mais s'affiche via `cdn`→Bunny → 404 temporaire. Mitigation : TTL bas
> + enchaîner B rapidement (ou figer brièvement les uploads admin). Volume faible →
> négligeable.

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
