# Gabarit → `app/api/cron/<job>/route.ts` (remplace un cron Convex)

Route handler protégé par `CRON_SECRET` (header `Authorization: Bearer …` injecté par la plateforme).
Le schedule vit dans `vercel.ts` (voir `references/06`).

```ts
import { and, eq, isNull, lte, sql } from "drizzle-orm"
import { db } from "@/db"
import { posts } from "@/db/schema/posts"
import { env } from "@/lib/env/server"

export const GET = async (request: Request) => {
  const authHeader = request.headers.get("authorization")
  // Fail-closed : sans secret configuré, on refuse tout (jamais « Bearer undefined »).
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Travail idempotent et borné (sûr à rejouer).
  const expired = await db
    .update(posts)
    .set({ status: "expired", updatedAt: sql`now()` })
    .where(
      and(
        eq(posts.status, "scheduled"),
        lte(posts.publishAt, sql`now()`),
        isNull(posts.deletedAt),
      ),
    )
    .returning({ id: posts.id })

  console.log(`[expire-posts] expired ${expired.length} post(s)`)
  return Response.json({ expired: expired.length })
}
```

Entrée correspondante dans `vercel.ts` :

```ts
import { type VercelConfig } from "@vercel/config/v1"

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/cron/expire-posts", schedule: "0 4 * * *" }], // UTC
}
```
