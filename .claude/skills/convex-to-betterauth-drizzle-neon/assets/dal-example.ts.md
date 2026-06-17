# Gabarit → `lib/dal.ts` + une lecture type

DAL (Data Access Layer) : **toutes** les lectures DB et la session passent par ici. `server-only`
interdit l'import côté client. `cache()` dédoublonne par requête. `taint` empêche la fuite du PII.

```ts
// lib/dal.ts
import { headers } from 'next/headers';
import { cache, experimental_taintObjectReference } from 'react';

import 'server-only';

import { auth } from '@/lib/auth';

export const getCurrentSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    // Empêche de passer l'objet session complet (PII) à un Client Component.
    experimental_taintObjectReference(
      'Ne pas exposer la session complète au client. Utiliser un sous-ensemble explicite.',
      session.user,
    );
  }
  return session;
});
```

> `experimental_taintObjectReference` exige `experimental.taint: true` dans `next.config.ts`.
> Optionnel mais fortement recommandé pour le PII.

Exemple de lecture métier (avec filtre soft-delete si tu l'as adopté) :

```ts
// features/posts/dal/get-posts.ts
import { and, desc, eq, isNull } from 'drizzle-orm';
import 'server-only';

import { db } from '@/db';
import { posts } from '@/db/schema/posts';

export const getPublishedPostsByAuthor = async (authorId: string) =>
  db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.authorId, authorId),
        eq(posts.status, 'published'),
        isNull(posts.deletedAt), // filtre soft-delete — retire si pas de soft delete
      ),
    )
    .orderBy(desc(posts.createdAt));
```

> Remplace chaque `query` Convex par une fonction de ce type. Un Server Component fait
> `const posts = await getPublishedPostsByAuthor(id)` — pas de réactivité (voir `references/05`).
