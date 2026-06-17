# 00 — Inventaire & mapping des concepts Convex → stack cible

## Étape 1 — Inventorier l'app Convex

Avant de coder, cartographie. Liste, fichier par fichier :

- **`convex/schema.ts`** : chaque `defineTable`, ses champs, ses `index`/`searchIndex`, les relations
  implicites (champs `v.id('autreTable')`).
- **Functions** : chaque `query`, `mutation`, `action`, et les `internalQuery/Mutation/Action`.
  Note pour chacune : lit/écrit quelles tables, exige quelle auth, est appelée d'où (client `useQuery`/
  `useMutation`, cron, httpAction, autre fonction).
- **Auth** : `convex/auth.ts` / `@convex-dev/auth`, ou Clerk/Auth0 via `ctx.auth`. Note les providers
  OAuth, les champs user custom, les rôles.
- **`convex/crons.ts`** : chaque job planifié.
- **`convex/http.ts`** : chaque `httpAction` (webhooks entrants, endpoints publics).
- **File storage** : usages de `ctx.storage` (upload, `getUrl`, suppression).
- **Réactivité** : repère les `useQuery` dont l'UI **dépend du live** (chat, notifications, présence,
  dashboards temps réel). Marque-les — ce sont les seuls écrans à traiter en phase 6.

Produis une table d'inventaire (tu la réutiliseras comme checklist).

## Étape 2 — La table « Rosetta »

| Concept Convex                       | Équivalent cible                                              | Notes                                                 |
| ------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------- |
| `convex/schema.ts` (`defineTable`)   | `db/schema/**/*.ts` (`pgTable`)                               | Tu possèdes le SQL ; voir `03`.                       |
| `v.id('table')` (référence)          | `text(...).references(() => other.id)` (FK)                   | FK réelles + `onDelete`.                              |
| `_id` (système)                      | PK `text('id').primaryKey()` + `createId()`                   | UUID applicatif, généré côté code.                    |
| `_creationTime` (système)            | `timestamp('created_at').defaultNow()`                        | + `updated_at` que tu gères.                          |
| `query`                              | Fonction DAL `server-only` (lecture)                          | Voir `04`. Pas réactive.                              |
| `mutation`                           | Server Action (`'use server'`)                                | Re-valide en zod, autorise, écrit, `revalidate*`.     |
| `action` (effets externes)           | Server Action **ou** route handler                            | Selon que c'est déclenché par l'UI ou par HTTP.       |
| `internalMutation`/`internalAction`  | Fonction serveur non exportée appelée par les actions/crons   | Pas d'`'use server'`.                                 |
| `ctx.db.get(id)` / `.query(...)`     | Drizzle `db.select().from(t).where(eq(t.id, id))`             |                                                       |
| `ctx.db.insert/patch/replace/delete` | Drizzle `insert`/`update`/`delete`                            | Atomicité multi-statements : `dbTx.transaction(...)`. |
| `ctx.auth.getUserIdentity()`         | `requireSession()` (guard) → `session.user`                   | Voir `02`.                                            |
| `useQuery(api.foo.bar)` (live)       | `await dal()` en Server Component (statique)                  | Live → voir `05`.                                     |
| `useMutation(api.foo.bar)`           | `useActionState` / `startTransition(() => action(fd))`        | Voir `04`.                                            |
| `crons.ts`                           | Crons plateforme (Vercel `vercel.ts`) + route handler protégé | Voir `06`.                                            |
| `httpAction` (`convex/http.ts`)      | Route handler Next `app/api/<x>/route.ts`                     | Webhooks : vérifier la signature. Voir `06`.          |
| `ctx.storage`                        | Vercel Blob / Bunny / S3 / UploadThing                        | Hors scope profond ; choisir un fournisseur.          |
| `ctx.scheduler.runAfter`             | File d'attente (Vercel Queues) ou job différé                 | Pas d'équivalent 1:1 ; modéliser explicitement.       |

## Étape 3 — Ordonnancer

Suis la checklist du `SKILL.md`. Règle d'or : **données et schéma avant auth**, **auth avant la
conversion massive des functions**, **réactivité en avant-dernier**, **retrait de `convex/` en
dernier**.
