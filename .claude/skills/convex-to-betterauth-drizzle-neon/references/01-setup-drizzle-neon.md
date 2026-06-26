# 01 — Brancher Drizzle + Neon

## Dépendances

```bash
# Défaut (runtime long/partagé : Vercel Fluid Compute, conteneur, VPS)
bun add drizzle-orm pg
bun add -d drizzle-kit @types/pg dotenv
# Sur Vercel : laisse le runtime drainer les connexions idle
bun add @vercel/functions
# UNIQUEMENT serverless isolé par requête (Netlify/Lambda) : driver HTTP
bun add @neondatabase/serverless
```

## Choix du client DB — selon le runtime

> ⚠️ **Le bon driver dépend de comment l'hébergeur traite ton code** (source : skill `neon-postgres`
>
> - doc Neon « choose-connection »). C'est le point le plus souvent mal transposé.

- **Runtime long/partagé (Vercel Fluid Compute, Neon Functions, conteneur, VPS) — DÉFAUT recommandé**
  → **un seul `pg` Pool (`drizzle-orm/node-postgres`) au scope module**, réutilisé entre les requêtes.
  Vercel tourne en Fluid Compute (les instances sont réutilisées entre requêtes), donc un pool TCP
  persistant est exactement le bon modèle. Le même client `db` sert les **lectures** (DAL), les
  **écritures** (Server Actions) **et** Better Auth, et supporte nativement `db.transaction(...)` —
  **pas besoin d'un second client**.
- **Serverless isolé par requête (Netlify, AWS Lambda)** → driver **HTTP**
  `@neondatabase/serverless` (`drizzle-orm/neon-http`) : une instance fraîche par requête, un pool TCP
  ne survit pas. ⚠️ **le HTTP ne supporte pas les transactions multi-statements** → ajoute alors un
  client `pg` séparé (`db/tx.ts`) pour les écritures atomiques.

> **Sur Vercel** : attache le pool avec `attachDatabasePool` (`@vercel/functions`) pour que le runtime
> draine les connexions idle avant de suspendre l'instance. Utilise la connexion **poolée** (`-pooler`)
> pour le runtime app et la **directe** (`DATABASE_URL_UNPOOLED`) pour drizzle-kit/scripts.

Gabarits : `assets/db-index.ts.md` (client `pg` unique — **défaut Vercel**) et `assets/db-tx.ts.md`
(client `pg` séparé — **uniquement** si tu pars sur le driver HTTP en isolé-par-requête).

```ts
// Mutation atomique (remplace une mutation Convex multi-write).
// Avec le client `pg` par défaut, db.transaction(...) suffit — pas de client séparé.
import { db } from "@/db"

await db.transaction(async (tx) => {
  await tx.insert(orders).values(order)
  await tx
    .update(inventory)
    .set({ qty: sql`${inventory.qty} - 1` })
    .where(eq(inventory.id, id))
})
```

> Convex enveloppait chaque `mutation` dans une transaction implicite. Ici l'atomicité est
> **explicite** : si plusieurs écritures doivent réussir ou échouer ensemble, `db.transaction(...)`.
> (Sur le driver HTTP, c'est `dbTx.transaction(...)` du client `pg` séparé.)

## `server-only`

Le projet source garde la garde `import 'server-only'` dans la **DAL** et non dans les fichiers
client DB (parce que des scripts Bun hors Next importent `db`). Si tu n'as pas de scripts Bun, tu
peux mettre `server-only` directement dans `db/index.ts`. Sinon, mets-le dans `lib/dal.ts`.

## `drizzle.config.ts`

Gabarit : `assets/drizzle.config.ts.md`. Points non négociables :

- **`schema: './db/schema/**/_.ts'`** (glob **récursif**). `./db/schema/_` rend les sous-dossiers
  invisibles à drizzle-kit.
- **URL = la connexion DIRECTE (non-pooled)** de Neon (`DATABASE_URL_UNPOOLED`). La pooled casse les
  migrations.
- **Charger `.env.local` explicitement** via `dotenv` : `config({ path: '.env.local' })`. drizzle-kit
  ne lit pas `.env.local` tout seul.

## Variables d'environnement

```bash
# .env.local
DATABASE_URL=postgresql://...neon.tech/db?sslmode=require          # pooled (runtime app)
DATABASE_URL_UNPOOLED=postgresql://...neon.tech/db?sslmode=require # direct (migrations)
```

Neon fournit les deux dans son dashboard. Valide-les via un schéma env centralisé → voir `07`.

## Commandes de migration

```bash
bun run drizzle-kit generate   # génère le SQL depuis db/schema/** → dossier drizzle/
bun run drizzle-kit migrate    # applique (utilise DATABASE_URL_UNPOOLED)
bun run drizzle-kit studio     # explorateur
```

Scripts `package.json` suggérés : `db:generate`, `db:migrate`, `db:studio`.

## Loi des branches Neon

Une branche Neon par environnement (`dev` / `preview` / `prod`). Ne jamais `db:push` en prod
(toujours `generate` + `migrate` versionnés). Si résidence des données imposée (ex. Loi 25 au
Québec) : fixer la **région** de la branche en conséquence.

## Critère de fin de phase

`drizzle-kit generate` produit une migration (même vide), `drizzle-kit migrate` l'applique sans
erreur, et un `select` trivial via `db` fonctionne contre Neon.
