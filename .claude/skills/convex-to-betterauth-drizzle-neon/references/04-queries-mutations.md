# 04 — `query` → DAL · `mutation` → Server Action

## `query` Convex → fonction DAL (`server-only`)

Toutes les lectures DB passent par une **DAL** (Data Access Layer) marquée `import 'server-only'`.
Jamais d'import de `db` depuis un Client Component. Gabarit : `assets/dal-example.ts.md`.

```ts
import { and, eq, isNull } from 'drizzle-orm';
import 'server-only';

import { db } from '@/db';
import { posts } from '@/db/schema/posts';

export const getPostsByAuthor = async (authorId: string) =>
  db
    .select()
    .from(posts)
    .where(and(eq(posts.authorId, authorId), isNull(posts.deletedAt))); // filtre soft-delete si applicable
```

- **Sessions aussi via la DAL** : wrappe `auth.api.getSession` dans un `cache(...)` React
  (dédoublonnage par requête) et **taint** le PII (`experimental_taintObjectReference`) pour empêcher
  toute fuite vers le client. Voir `assets/dal-example.ts.md`.
- **Filtrer `deletedAt IS NULL`** systématiquement si tu as adopté le soft-delete.
- Les Server Components `await` directement ces fonctions. **Pas réactif** — voir `05` pour le live.

## `mutation` Convex → Server Action (`'use server'`)

Une Server Action = re-validation zod + autorisation + écriture + revalidation. Gabarit complet :
`assets/server-action-example.ts.md`. Structure type :

```ts
'use server';
import { revalidatePath } from 'next/cache';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { posts } from '@/db/schema/posts';
import { requireSession } from '@/lib/auth-guards';

import { postSchema } from './schemas';

export type UpdatePostState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; fieldErrors?: Record<string, string>; formError?: string };

export const updatePost = async (
  _prev: UpdatePostState,
  formData: FormData,
): Promise<UpdatePostState> => {
  const session = await requireSession(); // 1. authn/authz (jamais optionnel)

  const parsed = postSchema.safeParse({
    // 2. validation serveur (défense en profondeur)
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const f = issue.path[0];
      if (typeof f === 'string') fieldErrors[f] = issue.message;
    }
    return { status: 'error', fieldErrors };
  }

  try {
    // 3. écriture
    await db.update(posts).set(parsed.data).where(eq(posts.id, /* ... */ ''));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[updatePost]', error);
    return { status: 'error', formError: 'Erreur serveur. Réessayez.' };
  }

  revalidatePath('/posts'); // 4. fraîcheur explicite (cf. 05)
  return { status: 'success' };
};
```

Règles dérivées de l'expérience du projet source :

- **La validation serveur n'est jamais optionnelle**, même si le client valide déjà (RHF + zod). Le
  client peut être contourné. Réutilise **le même** schéma zod côté client et serveur.
- **Autorisation dans chaque action sensible** : `requireSession()` / `requireRole([...])` /
  `requirePermission({ resource: ['action'] })`. Convex faisait l'authz dans la fonction ; ici aussi,
  explicitement, dans l'action (pas seulement dans le proxy).
- **`'use server'` : chaque export doit être une fonction `async` _littérale_.** Une arrow qui
  _renvoie_ une promesse sans le mot-clé `async` passe `tsc`/`eslint` mais **casse au build Next**
  (« Server Actions must be async functions »). Toujours `export const x = async (...) => ...`.
- **`revalidatePath`/`revalidateTag` après mutation** sinon le Server Component parent ne refetch pas
  (UI figée). Voir `05`.
- **Atomicité multi-écritures** → `dbTx.transaction(...)` au lieu de `db` (cf. `01`).

## Câblage client : `useMutation` Convex → Server Action côté UI

Convex `useMutation` → l'un de ces deux patterns :

```tsx
// A. Formulaire à champs (RHF + zodResolver est le standard)
const [state, action, isPending] = useActionState(updatePost, { status: 'idle' });
const form = useForm({ resolver: zodResolver(postSchema) });
const onSubmit = form.handleSubmit((values) => {
  const fd = new FormData();
  fd.append('title', values.title);
  startTransition(() => action(fd));
});
```

```tsx
// B. Dialog / bouton d'action SANS formulaire — appeler l'action inline dans startTransition
// (évite la règle eslint react-hooks/set-state-in-effect : pas de setState dans un useEffect
//  qui réagit à `state`).
const [isPending, startTransition] = useTransition();
const confirm = () =>
  startTransition(async () => {
    const result = await deletePost({ status: 'idle' }, fd);
    if (result.status === 'success') {
      toast.success('OK');
      setOpen(false);
      router.refresh();
    } else if (result.formError) toast.error(result.formError);
  });
```

## Critère de fin de phase

Un écran lit via la DAL et une action écrit via Server Action, avec autorisation et revalidation. Les
`useQuery`/`useMutation` Convex de ce domaine sont retirés.
