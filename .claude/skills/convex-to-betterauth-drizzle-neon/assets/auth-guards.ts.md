# Gabarit → `lib/auth-guards.ts`

Gardes serveur appelées dans chaque page/Server Action sensible. **Elles redirigent** → pour un route
handler qui doit renvoyer 401/403, utilise la variante non-redirigeante en bas.

Version générique (redirect `next/navigation`). Le projet source utilise `redirect` de next-intl pour
rester locale-aware — adapte si tu as l'i18n.

```ts
// ADAPT: '@/i18n/navigation' si next-intl
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import "server-only"
import { auth } from "@/lib/auth"
import type { AppRole, statement } from "@/lib/permissions"

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>
type ActiveSession = NonNullable<SessionResult>

export type PermissionInput = {
  [K in keyof typeof statement]?: Array<(typeof statement)[K][number]>
}

const ROLE_HOMES: Record<AppRole, string> = {
  user: "/app", // ADAPT
  admin: "/admin",
}

const getRole = (session: ActiveSession) =>
  session.user.role as AppRole | undefined

export const requireSession = async (): Promise<ActiveSession> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) return session
  redirect("/connexion")
  throw new Error("unreachable") // TS narrowing : redirect() retourne never mais TS ne le voit pas toujours
}

export const requireRole = async (roles: AppRole[]): Promise<ActiveSession> => {
  const session = await requireSession()
  const role = getRole(session)
  if (role && roles.includes(role)) return session
  redirect(role ? ROLE_HOMES[role] : "/")
  throw new Error("unreachable")
}

export const requirePermission = async (
  permissions: PermissionInput,
): Promise<ActiveSession> => {
  const session = await requireSession()
  const result = await auth.api.userHasPermission({
    body: { userId: session.user.id, permissions },
  })
  if (result.success) return session
  const role = getRole(session)
  redirect(role ? ROLE_HOMES[role] : "/")
  throw new Error("unreachable")
}
```

Variante **non-redirigeante** pour les route handlers (webhooks, API) :

```ts
// features/<x>/lib/require-admin.ts
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export const getAdminOrNull = async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const ok = await auth.api.userHasPermission({
    body: {
      userId: session.user.id,
      permissions: {/* resource: ['action'] */},
    },
  })
  return ok.success ? session : null
}
// Dans la route : if (!(await getAdminOrNull())) return new Response('Forbidden', { status: 403 });
```
