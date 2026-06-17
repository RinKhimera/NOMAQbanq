---
name: convex-to-betterauth-drizzle-neon
description: >-
  Migrer un backend Convex vers Better Auth + Drizzle ORM + Neon Postgres sur Next.js
  App Router. Utiliser dès qu'il s'agit de migrer/sortir de Convex, remplacer le dossier
  convex/ par Drizzle, passer de Convex Auth / Clerk / Auth0 à Better Auth, retirer la
  réactivité live (useQuery) de Convex, ou porter les crons et httpActions Convex. Couvre
  schéma, migration des données, auth, écart de réactivité, crons et webhooks.
---

# Migrer Convex → Better Auth + Drizzle + Neon (Next.js App Router)

Ce skill encode une stack backend **éprouvée en production** (projet « Proxéa »). Les références
détaillent chaque phase ; `assets/` contient des **gabarits de code réels** à adapter (lignes
marquées `// ADAPT:` = spécifiques au projet d'origine, à remplacer).

## Quand l'utiliser

Dès que la demande touche à : « migrer Convex », « sortir de Convex », « remplacer `convex/` »,
« Convex → Postgres/Drizzle », « passer de Convex Auth / Clerk à Better Auth », « on perd le temps
réel de Convex », « porter les crons/httpActions Convex ».

## ⚠️ Lis ça en premier — le recadrage mental

Convex et la stack cible ont des **modèles d'exécution opposés**. La première erreur de migration
est de transposer 1:1.

|           | Convex                               | Cible (Next + Drizzle + Neon)                                   |
| --------- | ------------------------------------ | --------------------------------------------------------------- |
| Modèle    | Réactif, serverful, fonctions = API  | Requête/réponse, Server Components + Server Actions             |
| Lecture   | `useQuery` **live** (re-render auto) | `await` dans un Server Component / DAL, fraîcheur **explicite** |
| Écriture  | `mutation` (transaction implicite)   | Server Action + Drizzle (`dbTx` pour l'atomicité)               |
| Schéma    | `defineSchema` typé runtime          | SQL réel possédé par toi, migrations `drizzle-kit`              |
| IDs/temps | `_id`, `_creationTime` système       | `createId()` (UUID) + colonnes `timestamp` à toi                |
| Auth      | `ctx.auth` / Convex Auth             | Better Auth (tables `user`/`session`/`account`)                 |
| Fraîcheur | Gratuite et automatique              | À **reconstruire** : `revalidateTag` / refetch / SSE / polling  |

**Conséquence n°1 :** la réactivité live n'existe plus par défaut. La majorité des écrans n'en ont
pas besoin (Server Component + `revalidateTag` sur mutation suffit). Les rares écrans live (chat,
présence) demandent une solution dédiée. → `references/05-reactivity-gap.md`.

**Conséquence n°2 :** tu **possèdes** le schéma SQL et les migrations. Plus de schéma implicite.

## Stack cible — versions de référence

Versions réellement en production dans le projet source (point de départ, vérifie les dernières) :

- `next` 16.2.x (App Router) · `react` 19.2.x
- `better-auth` ^1.6.9 (plugin `admin` pour rôles/ban)
- `drizzle-orm` ^0.45.x · `drizzle-kit` ^0.31.x
- `pg` ^8.x + `drizzle-orm/node-postgres` (driver **par défaut**, runtime long type Vercel Fluid
  Compute) · `@neondatabase/serverless` ^1.x (driver HTTP, **uniquement** serverless isolé par requête
  type Netlify/Lambda) — choix selon le runtime, voir `references/01-setup-drizzle-neon.md`
- `zod` ^4.x · runtime/PM : Bun

## Checklist de phases (ordre recommandé)

Migration **incrémentale (strangler)** : Convex reste branché jusqu'au basculement données + auth.

1. **Inventaire** — cartographier `convex/schema.ts`, chaque `query`/`mutation`/`action`,
   `convex/auth.*`, `convex/crons.ts`, `convex/http.ts`. Lister ce qui est live-critique.
   → `references/00-concept-mapping.md`
2. **Brancher Drizzle + Neon** — clients DB, env, `drizzle.config.ts`, première migration vide qui
   passe. → `references/01-setup-drizzle-neon.md`
3. **Porter le schéma + migrer les données** — `convex/schema.ts` → `db/schema/**`, puis
   `npx convex export` → import dans Neon. → `references/03-schema-and-data-migration.md`
4. **Brancher Better Auth** — remplace l'auth Convex ; tables `user`/`session`/`account`,
   handler, client, guards. → `references/02-better-auth.md`
5. **Convertir l'accès données** — `query` → DAL (`server-only`), `mutation` → Server Action,
   autorisation via guards. → `references/04-queries-mutations.md`
6. **Refermer l'écart de réactivité** — par écran, choisir revalidate / refetch / SSE / polling.
   → `references/05-reactivity-gap.md`
7. **Porter crons + httpActions/webhooks** — crons plateforme + route handlers Next.
   → `references/06-crons-and-webhooks.md`
8. **Env, outillage, garde-fous** — validation env centralisée, `proxy.ts`, headers, retrait de
   `convex/`. → `references/07-env-and-tooling.md` + `references/gotchas.md`

## Aiguillage vers les références

| Tu travailles sur…                                         | Lis                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Le plan global, le mapping des concepts                    | `references/00-concept-mapping.md`                          |
| Connexion DB, transactions, drizzle-kit                    | `references/01-setup-drizzle-neon.md`                       |
| Auth, sessions, OAuth, rôles, ban, **gotchas Better Auth** | `references/02-better-auth.md`                              |
| Tables, types, enums, **export/import des données Convex** | `references/03-schema-and-data-migration.md`                |
| Remplacer `useQuery`/`mutation` par DAL + Server Actions   | `references/04-queries-mutations.md`                        |
| Remplacer la réactivité live de Convex                     | `references/05-reactivity-gap.md`                           |
| `crons.ts` et `httpAction` Convex                          | `references/06-crons-and-webhooks.md`                       |
| Validation env, proxy/middleware, pièges transverses       | `references/07-env-and-tooling.md`, `references/gotchas.md` |
| Copier un fichier de base (auth, clients DB, config…)      | `assets/`                                                   |

## Comment mener la migration (process)

1. **Branche dédiée**, jamais sur `main`.
2. **Inventaire d'abord** : ne touche pas au code avant d'avoir la carte de la phase 1. Si le projet
   est gros, produire un plan écrit (skill `writing-plans` s'il est dispo) et le faire **relire** par
   l'humain avant d'implémenter.
3. **Strangler** : garder Convex fonctionnel ; migrer un domaine de données à la fois ; basculer
   lectures puis écritures ; ne retirer `convex/` qu'à la toute fin.
4. **Vérifier après chaque phase** : `bun run build` (ou équivalent) + type-check doivent passer.
5. **Auth en dernier des gros morceaux** : la migration des `user`/sessions est la plus risquée —
   prévoir un plan de re-login (les sessions Convex/Clerk ne se transfèrent pas vers Better Auth).

## Garde-fou versions

Le projet source est en **Next.js 16**. Certains détails ci-dessous lui sont propres ; si le repo
cible est sur une autre version de Next, **vérifie contre ta version** :

- Fichier proxy racine nommé `proxy.ts` (Next 16) vs `middleware.ts` (≤ 15).
- `revalidateTag(tag, 'max')` exige un 2ᵉ argument en Next 16.
- `cookies()`, `headers()`, `params`, `searchParams` sont **async** (à `await`) en Next ≥ 15.
- `serverActions.bodySizeLimit` (1 Mo par défaut) à relever pour les uploads.

Pour tout ce qui est version-spécifique d'une lib (Better Auth surtout), **lis la doc de ta version
installée** plutôt que de te fier à la mémoire — les signatures changent.
