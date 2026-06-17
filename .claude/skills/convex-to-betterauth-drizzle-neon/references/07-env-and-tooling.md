# 07 — Env, proxy/middleware, outillage, garde-fous finaux

## Validation d'environnement centralisée

Convex gère ses env vars dans son dashboard. Ici, **une source unique de vérité validée par zod**,
qui fait **échouer le build/boot** si une variable requise manque. Gabarit : `assets/env-schema.ts.md`.

Principes du projet source :

- **Schémas zod purs** (aucun import Next / `server-only`) → réutilisables côté serveur, client,
  scripts, `next.config.ts`.
- **`''` (présent mais vide) = absent** : un `stripEmpty()` normalise avant parse (sinon une var vide
  passe les checks et casse au runtime).
- **Distinguer prod-like** (`VERCEL_ENV` production/preview) : certaines vars sont requises en prod
  mais optionnelles en dev (ex. `CRON_SECRET`).
- **Vars client** = `NEXT_PUBLIC_*` accédées **littéralement** (`process.env.NEXT_PUBLIC_X`) : Next
  n'inline que les références explicites.
- Un test de scan empêche d'importer l'env serveur depuis un fichier `'use client'`.

## Proxy / middleware (protection des zones authentifiées)

Convex n'a pas d'équivalent ; côté Next, un fichier racine protège les préfixes privés.

- **Next 16 : `proxy.ts`** (fonction exportée `proxy()`). **Next ≤ 15 : `middleware.ts`** (`middleware()`).
- **Tourne en edge** → **ne peut pas importer de module `server-only`** (auth, db, permissions).
  Récupère la session via un fetch HTTP (`betterFetch('/api/auth/get-session', { headers: { cookie }})`)
  et **duplique** les constantes partagées (mapping rôle→home) au lieu de les importer.
- **Double l'authz** : le proxy bloque l'accès aux zones, mais **chaque Server Action re-vérifie**
  (cf. `04`). Ne fais jamais confiance au seul proxy.
- **`config.matcher` doit être une chaîne littérale plain** — **jamais** `String.raw` ni une regex
  construite. Sinon le matcher s'applique à `/_next/static/*` et **casse tout le CSS**. Exclure
  `/api/*` du matcher (sinon les rewrites i18n cassent les route handlers).

## Headers de cache sur les zones PII

`Cache-Control: private, no-store, max-age=0` sur les préfixes authentifiés (`/admin/*`, espaces
membres). Configuré dans `vercel.ts` (`routes.header(...)`).

## Outillage

- **Runtime/PM** : Bun (`bun install`, `bun add`, `bunx --bun ...`). Lockfile `bun.lock`.
- **Gate avant commit** : `type-check` (tsc --noEmit) + `eslint` (0 warning). Reproduis un script
  `check` et fais-le passer avant chaque commit.
- **`serverActions.bodySizeLimit`** (1 Mo par défaut) à relever dans `next.config.ts` pour les
  uploads via FormData → Server Action (sinon « Body exceeded 1 MB limit » **avant** d'atteindre
  l'action). ⚠️ Changement de `next.config.ts` **non pris en HMR** → redémarrer le dev server.
- **Fins de ligne** : si l'équipe est multi-OS, forcer LF (`.gitattributes : * text=auto eol=lf`)
  pour éviter que Prettier (LF) et `core.autocrlf` (CRLF) se battent à chaque format.

## Retrait final de Convex

Quand toutes les phases passent et que l'app tourne sur la nouvelle stack :

1. Supprimer le dossier `convex/`, le `ConvexProvider`/`ConvexReactClient` du layout client, et les
   imports `convex/react`.
2. `bun remove convex @convex-dev/auth` (et dépendances Convex associées).
3. Retirer les env vars Convex (`CONVEX_*`, `NEXT_PUBLIC_CONVEX_URL`).
4. Vérifier qu'aucun `useQuery`/`useMutation` Convex ne subsiste (grep `convex/react`,
   `api.` générés).
5. `bun run build` + type-check verts.

## Critère de fin de phase

Env validé au boot, zones privées protégées par le proxy **et** par les guards, build vert, plus
aucune trace de `convex/`.
