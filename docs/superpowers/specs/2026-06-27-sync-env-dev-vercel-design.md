# Sync des variables d'environnement de dev depuis Vercel

**Date** : 2026-06-27
**Statut** : Design validé (prêt pour plan d'implémentation)

## Objectif

Pouvoir reconstruire `.env.local` à l'identique sur **n'importe quel PC** via une
seule commande, en tirant les valeurs **depuis Vercel**, sans jamais toucher les
variables `Preview` ou `Production`. Au passage : classifier les variables d'env
(utilisées / utiles / inutiles) et nettoyer les mortes.

## Décisions prises

- **Portée** : « tout, une seule commande ». Le scope `Development` de Vercel
  devient la **source de vérité unique** et un **sur-ensemble** de `.env.local`.
- **`NEON_API_KEY`** (accès API au compte Neon entier) : **stockée dans Vercel
  Dev** comme les autres (vrai « tout »). Risque accepté.
- **Extras** : on ajoute `EMAIL_OVERRIDE_TO` à l'amorçage (redirige tous les
  emails dev vers une adresse de test vérifiée). **Pas** de Stripe dev pour
  l'instant (YAGNI).

## Contexte (état réel constaté le 2026-06-27)

Projet Vercel lié en mode *repo* : `nomaqbank`
(`prj_ZOmANdfKfJ9jm34HT5xVM4uLguyg`, team `rinkhimeras-projects` /
`team_0TjTQybtkyhHcGIxbju0GM3e`). CLI Vercel v54.11.1. `.vercel/` est gitignored
(donc absent après un `git clone`).

### Déjà dans Vercel scope `Development` (se *pull* avec leurs valeurs — pas de souci « sensitive »)

`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SES_REGION`, `SES_ACCESS_KEY_ID`,
`SES_SECRET_ACCESS_KEY`, `EMAIL_FROM`, `SES_CONFIGURATION_SET`,
`SENTRY_AUTH_TOKEN`, `CRON_SECRET` (absent du `.env.local` local),
`NEXT_PUBLIC_SENTRY_DSN` (absent du `.env.local` local). Plus `VERCEL_OIDC_TOKEN`
auto-injecté par le *pull* (~12 h).

### Dans `.env.local` mais PAS dans Vercel Dev — **un `pull` les effacerait** (à amorcer)

| Var | Catégorie |
| --- | --- |
| `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_CDN_HOSTNAME` | Médias S3 dev (clés statiques dev) |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | Tests d'intégration (`scripts/neon-api.ts`) |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_RESET_SECRET` | Tests E2E Playwright |

→ **13 clés à amorcer** (ces 12 + `EMAIL_OVERRIDE_TO`).

## Classification des variables (livrable demandé)

### 🟢 Runtime de l'app — à utiliser (cœur du « dev », consommé par `bun dev`)

`DATABASE_URL` / `DATABASE_URL_UNPOOLED` (requis), `BETTER_AUTH_SECRET` (requis),
`BETTER_AUTH_URL` (override dev = `http://localhost:3000`), `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET`, `SES_*` + `EMAIL_FROM` + `SES_CONFIGURATION_SET`,
`S3_REGION` / `S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`,
`NEXT_PUBLIC_CDN_HOSTNAME`, `E2E_RESET_SECRET` (protège `/api/e2e`),
`NEXT_PUBLIC_SENTRY_DSN`, `CRON_SECRET`.

### 🟡 Outillage / build / tests — utiles, mais PAS du runtime app

- `SENTRY_AUTH_TOKEN` — upload des source maps **au build** (pas pour `bun dev`).
- `NEON_API_KEY` / `NEON_PROJECT_ID` — tests d'intégration (sensibilité **élevée**).
- `E2E_ADMIN_*` / `E2E_USER_*` — tests Playwright (faux comptes `@nomaqtest.local`,
  sensibilité faible).

### 🔴 Inutiles — à supprimer

`BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_API_KEY`, `BUNNY_CDN_HOSTNAME`
(commentées) — migration Bunny → S3/CloudFront **terminée**, code mort. Elles
disparaissent naturellement (le *pull* régénère le fichier sans elles).

### ⚪ Absentes de `.env.local`, décision prise

- `EMAIL_OVERRIDE_TO` — **on l'ajoute** (valeur = adresse de test vérifiée SES, fournie par l'utilisateur).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — **non** (paiements dev hors scope).
- `MAINTENANCE_MODE` / `MAINTENANCE_BYPASS_TOKEN`, `NEXT_PUBLIC_BASE_URL`,
  `AWS_ROLE_ARN`, `INTEGRATION_*`, `PLAYWRIGHT_BASE_URL` — non requis en dev local
  (générés au runtime / propres à prod-preview / valeurs par défaut OK).

## Architecture

Le scope `Development` de Vercel = source unique et sur-ensemble de `.env.local`.
Toute lecture/écriture reste **scopée `development`**, donc preview/prod intacts
par construction.

```
[PC actuel, .env.local complet]
   │ amorçage unique : vercel env add <KEY> development  (non-sensitive)
   ▼
[Vercel scope "Development"]  ← source de vérité (sur-ensemble de .env.local)
   │ vercel env pull .env.local --environment=development --yes
   ▼
[n'importe quel PC : .env.local reconstruit]
```

## Composants (4 livrables, chacun à responsabilité unique)

### (a) Script d'amorçage unique — `scripts/seed-vercel-dev-env.ts`

- Bun/tsx, **multiplateforme** (évite le couple `.ps1` + `.sh` et l'enfer du
  *quoting* PowerShell/bash).
- Lit les valeurs depuis le `.env.local` **actuel** ; pour chacune des 13 clés
  manquantes, exécute `vercel env add <KEY> development` en **non-sensitive**.
- **Valeur passée par stdin**, jamais en argument positionnel (gère `+ / & =` des
  secrets AWS / `DATABASE_URL` et suit l'avertissement CLI « do NOT pass
  NAME=value as positional »).
- **Idempotent** : lit `vercel env ls development` d'abord et saute les clés déjà
  présentes.
- Lancé **une seule fois**, depuis le PC qui possède le `.env.local` complet.
- `EMAIL_OVERRIDE_TO` : si absente de `.env.local`, le script demande/exige une
  valeur (adresse vérifiée SES) avant de l'ajouter.

### (b) Wrapper de synchro — script `package.json`

```json
"env:sync": "vercel env pull .env.local --environment=development --yes"
```

*La* commande à retenir, identique sur chaque PC.

### (c) Doc bootstrap (section README)

Sur un PC neuf, après `git clone` (`.vercel/` absent car gitignored) :

```bash
bun install
vercel login
vercel link            # team rinkhimeras-projects → projet nomaqbank
bun run env:sync
```

### (d) Script de vérif — `scripts/check-env-sync.ts`

*Pull* dans un fichier temporaire, diffe les **clés** (pas les valeurs) contre
`.env.local`, échoue s'il existe une clé « qui serait effacée » (présente en
local, absente de Vercel Dev). Fige en garde-fou le diagnostic manuel utilisé
pendant le design.

## Garde-fous & edge cases

- **`vercel env pull` remplace tout le fichier** → désormais **sûr** car Vercel
  est le sur-ensemble. **Discipline** : toute nouvelle var dev doit être créée
  AUSSI sur Vercel (`vercel env add … development`), sinon le prochain *pull*
  l'efface. Le script (d) sert de filet.
- **Sensitivity** : ajouter en **non-sensitive** pour que les *pull* renvoient
  les valeurs — cohérent avec les 14 vars déjà en place. Confirmer le flag exact
  via `vercel env add --help` au moment de coder (la valeur par défaut et le nom
  du flag — `--sensitive` opt-in vs `--no-sensitive` — varient selon la version
  CLI ; vérifier sur v54.x).
- **Token OIDC** (`VERCEL_OIDC_TOKEN`, ~12 h) : re-`bun run env:sync` en début de
  session si une auth OIDC échoue. Non bloquant en dev (clés AWS statiques).
- **`EMAIL_OVERRIDE_TO`** : exige une adresse vérifiée dans SES (fournie par
  l'utilisateur).
- **Caractères spéciaux** dans les valeurs (AWS secrets `+`/`/`, `DATABASE_URL`
  `&`/`=`) : gérés par le passage stdin du script (a).

## Tests / acceptation

1. Après amorçage : `vercel env ls development` liste l'ensemble des clés
   attendues (~28).
2. `scripts/check-env-sync.ts` → **zéro** clé « effaçable ».
3. Critère final : sauvegarder puis supprimer `.env.local`, lancer
   `bun run env:sync`, et `bun dev` + `bun run check` passent.

## Sécurité (acceptée)

Tous les secrets dev (dont `NEON_API_KEY`, clés AWS) vivent dans Vercel Dev —
lisibles par qui a accès `Development` au projet. `.env.local` reste gitignored.
*Optionnel (suite)* : rotation des secrets qui ont traîné en clair sur plusieurs
copies de `.env.local`.

## Hors scope (YAGNI)

- Stripe dev (`STRIPE_*`).
- Script de fusion préservant des vars locales hors-Vercel (approche ② —
  pertinent seulement si on décidait de garder `NEON_API_KEY` hors de Vercel).
- dotenvx / SOPS (dotenv chiffré commité) — l'utilisateur veut « depuis Vercel ».
