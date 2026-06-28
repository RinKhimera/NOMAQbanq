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
- **Extras** : on ajoute `EMAIL_OVERRIDE_TO=dixiades@gmail.com` à l'amorçage
  (redirige tous les emails dev vers cette adresse de test). **Pas** de Stripe
  dev pour l'instant (YAGNI).
- **Wrapper** : nom `bun run env:sync` confirmé.
- **Format du fichier généré** : `.env.local` **regroupé en sections** par
  `scripts/sync-env.ts` (post-traitement du _pull_). Schéma **hybride** :
  sections fonctionnelles (BD, Auth, SES, S3, Tests…) + **tag de tier 🟢/🟡**
  dans chaque en-tête. Clés inconnues → section « Non classé » (rien de perdu).
- **Script de vérif (d)** : **validation jetable, non commitée** (scratchpad),
  jouée une fois pour confirmer le résultat — pas un livrable du repo.

## Contexte (état réel constaté le 2026-06-27)

Projet Vercel lié en mode _repo_ : `nomaqbank`
(`prj_ZOmANdfKfJ9jm34HT5xVM4uLguyg`, team `rinkhimeras-projects` /
`team_0TjTQybtkyhHcGIxbju0GM3e`). CLI Vercel v54.11.1. `.vercel/` est gitignored
(donc absent après un `git clone`).

### Déjà dans Vercel scope `Development` (se _pull_ avec leurs valeurs — pas de souci « sensitive »)

`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SES_REGION`, `SES_ACCESS_KEY_ID`,
`SES_SECRET_ACCESS_KEY`, `EMAIL_FROM`, `SES_CONFIGURATION_SET`,
`SENTRY_AUTH_TOKEN`, `CRON_SECRET` (absent du `.env.local` local),
`NEXT_PUBLIC_SENTRY_DSN` (absent du `.env.local` local). Plus `VERCEL_OIDC_TOKEN`
auto-injecté par le _pull_ (~12 h).

### Dans `.env.local` mais PAS dans Vercel Dev — **un `pull` les effacerait** (à amorcer)

| Var                                                                                                | Catégorie                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_CDN_HOSTNAME` | Médias S3 dev (clés statiques dev)          |
| `NEON_API_KEY`, `NEON_PROJECT_ID`                                                                  | Tests d'intégration (`scripts/neon-api.ts`) |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_RESET_SECRET` | Tests E2E Playwright                        |

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
disparaissent naturellement (le _pull_ régénère le fichier sans elles).

### ⚪ Absentes de `.env.local`, décision prise

- `EMAIL_OVERRIDE_TO` — **on l'ajoute**, valeur `dixiades@gmail.com` (adresse de test ; doit être vérifiée dans SES).
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

## Composants (3 livrables commités + 1 validation jetable)

### (a) Script d'amorçage unique — `scripts/seed-vercel-dev-env.ts`

- Bun/tsx, **multiplateforme** (évite le couple `.ps1` + `.sh` et l'enfer du
  _quoting_ PowerShell/bash).
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

### (b) Wrapper de synchro **avec regroupement** — `scripts/sync-env.ts`

Lancé via le script `package.json` :

```json
"env:sync": "bun run scripts/sync-env.ts"
```

`vercel env pull` écrit un fichier **plat** (pas de commentaires ni de
regroupement). Pour obtenir un `.env.local` rangé sur chaque PC, le script
post-traite le _pull_ :

1. `vercel env pull` vers un fichier **temporaire** (scope `development`).
2. Parse chaque ligne en `(clé, ligne brute)` — la **ligne brute est réutilisée
   telle quelle** (jamais de re-quoting → préserve `+ / & =` des secrets).
3. Réordonne selon la **carte de groupes** (ci-dessous) et insère des en-têtes
   `# === … (tier) ===` — schéma **hybride** : sections fonctionnelles + tag de
   classification 🟢/🟡 dans l'en-tête.
4. Toute clé absente de la carte → section **« Non classé »** en fin de fichier
   (rien n'est perdu silencieusement ; `log` du nombre de clés non classées).
5. Écrit `.env.local`.

_La_ commande à retenir, identique sur chaque PC.

#### Carte de groupes (hybride fonctionnel + tier)

| Section (en-tête)              | Tier                  | Clés                                                                                                                   |
| ------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Base de données — Neon         | 🟢 REQUIS             | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`                                                                                |
| Better Auth                    | 🟢 REQUIS             | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                                                                |
| OAuth Google                   | 🟢                    | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                             |
| AWS SES — emails               | 🟢                    | `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `EMAIL_FROM`, `SES_CONFIGURATION_SET`, `EMAIL_OVERRIDE_TO` |
| AWS S3 + CloudFront — médias   | 🟢                    | `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_CDN_HOSTNAME`                     |
| Cron Vercel                    | 🟢                    | `CRON_SECRET`                                                                                                          |
| Sentry — monitoring            | 🟡 build + 🟢 runtime | `SENTRY_AUTH_TOKEN` (build), `NEXT_PUBLIC_SENTRY_DSN` (runtime)                                                        |
| Tests d'intégration — Neon API | 🟡 outillage          | `NEON_API_KEY`, `NEON_PROJECT_ID`                                                                                      |
| Tests E2E — Playwright         | 🟡 tests              | `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_RESET_SECRET`                     |
| Vercel (auto-injecté)          | —                     | `VERCEL_OIDC_TOKEN`                                                                                                    |
| Non classé                     | —                     | (toute clé inconnue, en fin de fichier)                                                                                |

La carte est le **point unique de catégorisation** ; la garder alignée sur
`.env.example` quand une section est ajoutée.

### (c) Doc bootstrap (section README)

Sur un PC neuf, après `git clone` (`.vercel/` absent car gitignored) :

```bash
bun install
vercel login
vercel link            # team rinkhimeras-projects → projet nomaqbank
bun run env:sync
```

### (d) Validation jetable — script de vérif (non commité, scratchpad)

_Pull_ dans un fichier temporaire, diffe les **clés** (pas les valeurs) contre
`.env.local`, échoue s'il existe une clé « qui serait effacée » (présente en
local, absente de Vercel Dev). **Non commité** : créé dans le scratchpad, joué
ponctuellement, puis supprimé. Sert à confirmer l'amorçage (zéro clé effaçable).

> **Validé le 2026-06-27** (avant amorçage) : 24 clés locales / 15 clés Vercel
> Dev → le script détecte correctement les 3 clés ajoutées par le _pull_
> (`CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `VERCEL_OIDC_TOKEN`) et les **12**
> clés à amorcer. Logique de diff confirmée fonctionnelle.

## Garde-fous & edge cases

- **`vercel env pull` remplace tout le fichier** → désormais **sûr** car Vercel
  est le sur-ensemble. **Discipline** : toute nouvelle var dev doit être créée
  AUSSI sur Vercel (`vercel env add … development`), sinon le prochain _pull_
  l'efface. Le script (d) sert de filet.
- **Sensitivity** : ajouter en **non-sensitive** pour que les _pull_ renvoient
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
2. La validation jetable (d) → **zéro** clé « effaçable ».
3. Critère final : sauvegarder puis supprimer `.env.local`, lancer
   `bun run env:sync`, et `bun dev` + `bun run check` passent.
4. Le `.env.local` généré est **regroupé en sections** avec en-têtes + tags de
   tier ; section « Non classé » **vide** (sinon = une clé à ajouter à la carte).
   Diff des **valeurs** (pas seulement des clés) avant/après `env:sync` =
   identique (le regroupement ne modifie aucune valeur).

## Sécurité (acceptée)

Tous les secrets dev (dont `NEON_API_KEY`, clés AWS) vivent dans Vercel Dev —
lisibles par qui a accès `Development` au projet. `.env.local` reste gitignored.
_Optionnel (suite)_ : rotation des secrets qui ont traîné en clair sur plusieurs
copies de `.env.local`.

## Hors scope (YAGNI)

- Stripe dev (`STRIPE_*`).
- Script de fusion préservant des vars locales hors-Vercel (approche ② —
  pertinent seulement si on décidait de garder `NEON_API_KEY` hors de Vercel).
- dotenvx / SOPS (dotenv chiffré commité) — l'utilisateur veut « depuis Vercel ».
