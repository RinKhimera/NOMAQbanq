# Gabarit → `drizzle.config.ts`

```ts
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit ne lit pas .env.local tout seul — charge-le explicitement.
config({ path: '.env.local' });
config();

// ⚠️ URL DIRECTE (non-pooled) : la pooled casse les migrations.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error(
    'DATABASE_URL_UNPOOLED manquant (URL « direct connection » Neon, pas la pooled).',
  );
}

export default defineConfig({
  schema: './db/schema/**/*.ts', // ⚠️ glob RÉCURSIF — './db/schema/*' rend les sous-dossiers invisibles
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
```

Scripts `package.json` :

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```
