# 03 — Schéma + migration des données

## A. Porter le schéma Convex → Drizzle

Convex `defineTable` → Drizzle `pgTable`. Organise par domaine sous `db/schema/<domaine>/*.ts` et
**centralise les enums** dans `db/schema/enums.ts`.

### Mapping des types

| Convex (`v.*`)                            | Drizzle (`pg-core`)                                                      | Notes                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `v.string()`                              | `text(...)`                                                              |                                                         |
| `v.number()`                              | `integer(...)` / `numeric(...)` / `doublePrecision(...)`                 | Convex `number` = float64 ; choisis selon l'usage réel. |
| `v.int64()`                               | `bigint(..., { mode: 'number' \| 'bigint' })`                            |                                                         |
| `v.boolean()`                             | `boolean(...)`                                                           |                                                         |
| `v.null()` / champ absent                 | colonne **nullable** (pas de `.notNull()`)                               |                                                         |
| `v.optional(x)`                           | colonne nullable                                                         |                                                         |
| `v.array(...)` / `v.object(...)`          | `jsonb(...)`                                                             | Ou table jointe si tu veux requêter dedans.             |
| `v.union(v.literal('a'), v.literal('b'))` | `pgEnum('name', ['a','b'])`                                              | Centralise dans `enums.ts`.                             |
| `v.id('autreTable')`                      | `text('x_id').references(() => autre.id, { onDelete: ... })`             | FK réelle. Choisis le `onDelete`.                       |
| `_id`                                     | `text('id').primaryKey()` + `createId()`                                 | Voir IDs ci-dessous.                                    |
| `_creationTime`                           | `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()` | Ajoute `updated_at` que tu gères.                       |
| `index('by_x', ['x'])`                    | `(t) => [index('t_x_idx').on(t.x)]`                                      | Recrée tous les index utiles aux requêtes.              |

### IDs applicatifs

Convex génère les `_id`. Ici, génère-les côté code. Helper `lib/ids.ts` :

```ts
import { randomUUID } from 'node:crypto';

export const createId = () => randomUUID();
// + éventuellement un createPublicId(len) avec un alphabet sans 0/O/I/l pour les URLs publiques.
```

### Soft delete (optionnel mais recommandé)

Si le projet a des contraintes vie privée / audit, adopte le pattern du projet source : colonnes
`deleted_at` / `anonymized_at`, **jamais de hard delete** pour un user lié à du contenu, et **filtrer
`deletedAt IS NULL`** sur toutes les lectures (`user`, et tes tables métier). Sinon, ignore.

## B. Migrer les données

> Fais-le **après** que le schéma cible est créé et migré, et **avant** la conversion des functions.
> Garde Convex en lecture seule pendant la bascule (strangler).

### 1. Exporter depuis Convex

```bash
npx convex export --path convex-snapshot.zip
```

Le snapshot contient un dossier par table avec des documents **JSONL** (un JSON par ligne), incluant
`_id` et `_creationTime`.

### 2. Transformer & charger

Écris un script Bun jetable (`scripts/import-from-convex.ts`) qui, **table par table dans l'ordre des
FK** (parents avant enfants) :

1. lit le JSONL,
2. mappe chaque document → une ligne Drizzle,
3. insère par **batches** (ex. 500) via le client `db`.

Conseils :

- **Stabilité des IDs** : si tu veux préserver les relations, construis une **map `ancien _id →
nouvel id`** (ou réutilise directement `_id` comme PK `text` si tu n'as pas besoin d'UUID). Résous
  les champs `v.id('x')` via cette map.
- `_creationTime` (ms epoch) → `new Date(ms)` pour `created_at`.
- **Idempotence** : `onConflictDoNothing()` sur la PK pour pouvoir relancer le script.
- **Auth** : les `user` migrés vont dans la table `user` de Better Auth (voir `02`) ; pas de mots de
  passe importables → reset au 1er login.

```ts
// esquisse
const rows = jsonl.map((doc) => ({
  id: idMap.get(doc._id) ?? doc._id,
  // ...mappe chaque champ...
  createdAt: new Date(doc._creationTime),
}));
for (const batch of chunk(rows, 500)) {
  await db.insert(table).values(batch).onConflictDoNothing();
}
```

### 3. Vérifier

Compter les lignes par table côté Convex vs Neon. Repérer les FK orphelines (documents référençant
un `_id` absent — fréquent si des données Convex étaient incohérentes).

## Critère de fin de phase

Schéma migré, comptes de lignes concordants, aucune FK orpheline non expliquée, et les écrans en
lecture (une fois la DAL branchée en `04`) affichent les données réelles.
