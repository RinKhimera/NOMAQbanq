# Gabarit → une Server Action (remplace une `mutation` Convex)

Structure complète : authz → validation zod → écriture → revalidation → état discriminé.

```ts
"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { posts } from "@/db/schema/posts"
import { updatePostSchema } from "@/features/posts/schemas"
import { requireSession } from "@/lib/auth-guards"

export type UpdatePostState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error"
      fieldErrors?: Record<string, string>
      formError?: string
    }

// ⚠️ Fonction async LITTÉRALE — une arrow sans `async` casse au build Next.
export const updatePost = async (
  _prev: UpdatePostState,
  formData: FormData,
): Promise<UpdatePostState> => {
  const session = await requireSession() // authz — jamais optionnel

  const parsed = updatePostSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body"),
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (typeof field === "string") fieldErrors[field] = issue.message
    }
    return { status: "error", fieldErrors }
  }

  const { id, title, body } = parsed.data

  try {
    await db
      .update(posts)
      .set({ title, body, updatedAt: new Date() })
      .where(eq(posts.id, id)) // ADAPT: + vérifier l'ownership (posts.authorId === session.user.id)
  } catch (error) {
    if (process.env.NODE_ENV !== "production")
      console.error("[updatePost] DB error:", error)
    return { status: "error", formError: "Erreur serveur. Réessayez." }
  }

  revalidatePath("/posts") // fraîcheur explicite (cf. references/05)
  return { status: "success" }
}
```

> Côté client : `const [state, action, isPending] = useActionState(updatePost, { status: 'idle' })`,
> puis soumettre une `FormData` via `startTransition(() => action(fd))`. Voir `references/04`.
