# Gabarit → `db/tx.ts` (uniquement avec le driver HTTP)

> ⚠️ **Tu n'as PAS besoin de ce fichier si `db/index.ts` est déjà un `pg` Pool** (cas Vercel / runtime
> long — le défaut recommandé) : `db.transaction(...)` fonctionne directement sur ce client.

Ce client `pg` séparé n'est utile que si tu as choisi le driver **HTTP** (`@neondatabase/serverless`)
comme `db` par défaut — c.-à-d. un **serverless isolé par requête** (Netlify/Lambda) — car le HTTP ne
supporte pas les transactions multi-statements. Importe alors `dbTx` **uniquement** dans les Server
Actions qui font plusieurs écritures atomiques.

```ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env/server"
// ADAPT: ou process.env.DATABASE_URL

import * as schema from "./schema"

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
})

export const dbTx = drizzle(pool, { schema })
export type DbTx = typeof dbTx
```

Usage :

```ts
import { dbTx } from "@/db/tx"

await dbTx.transaction(async (tx) => {
  await tx.insert(orders).values(order)
  await tx
    .update(inventory)
    .set({ qty: sql`${inventory.qty} - 1` })
    .where(eq(inventory.id, productId))
})
```
