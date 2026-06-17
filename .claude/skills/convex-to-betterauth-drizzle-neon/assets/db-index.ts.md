# Gabarit → `db/index.ts`

Client DB **unique** pour runtime long/partagé (**Vercel Fluid Compute**, conteneur, VPS) : un `pg`
Pool créé **une fois au scope module**, réutilisé par chaque requête de l'instance. Sert les lectures
(DAL), les écritures (Server Actions) **et** Better Auth, et supporte `db.transaction(...)`
directement — pas besoin d'un client transactionnel séparé.

```ts
import { attachDatabasePool } from '@vercel/functions'; // ADAPT: retirer hors Vercel
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '@/lib/env/server'; // ADAPT: ou process.env.DATABASE_URL

import * as schema from './schema';

// Créé une fois au scope module, réutilisé par chaque requête de l'instance.
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 }); // pooled (-pooler)
attachDatabasePool(pool); // Vercel : laisse le runtime drainer les connexions idle

export const db = drizzle(pool, { schema });
export type Db = typeof db;
```

> **Runtime isolé par requête (Netlify/Lambda)** : un pool TCP ne survit pas → utilise le driver HTTP
> `@neondatabase/serverless` (`drizzle-orm/neon-http`) comme `db`, et ajoute un client `pg` séparé
> pour les transactions (voir `db-tx.ts.md`).
>
> **`server-only`** : si aucun script Bun hors-Next n'importe `db`, ajoute `import 'server-only';` en
> tête pour interdire l'import côté client. Sinon, garde la garde `server-only` dans la DAL.
