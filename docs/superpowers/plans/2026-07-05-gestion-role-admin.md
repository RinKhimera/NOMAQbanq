# Gestion du rôle administrateur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un admin de promouvoir/rétrograder n'importe quel utilisateur depuis la fiche `/admin/utilisateurs/[id]`, avec l'invariant « jamais zéro admin actif ».

**Architecture:** Une Server Action `updateUserRole` (guard → zod → transaction avec verrous `for update` sur appelant + cible → revalidation) et une carte client `UserRoleSection` dans la fiche utilisateur (AlertDialog de confirmation → action → `router.refresh()`). Les 15 endpoints HTTP inutilisés du plugin admin Better Auth sont fermés via `disabledPaths` pour que l'action soit l'unique chemin de mutation du rôle. Aucun changement de schéma DB.

**Tech Stack:** Next.js 16 Server Actions, Drizzle/Neon, zod, shadcn AlertDialog, Vitest (integration Neon éphémère + frontend happy-dom).

**Spec:** `docs/superpowers/specs/2026-07-05-gestion-role-admin-design.md`

**Rappels projet :** messages de commit conventionnels SANS attribution Claude ; `bun run test` (jamais `bun test`) ; on part de `main` propre → créer une branche d'abord.

---

### Task 0: Branche de travail

- [ ] **Step 1: Créer la branche**

```bash
git checkout -b feat/gestion-role-admin
```

---

### Task 1: Schéma zod `updateUserRoleSchema`

**Files:**

- Modify: `features/users/schemas.ts` (append à la fin)

- [ ] **Step 1: Ajouter le schéma**

```ts
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  role: z.enum(["user", "admin"]),
})
```

(Pas de test dédié : le schéma est couvert par les tests d'intégration de l'action en Task 2/3.)

- [ ] **Step 2: Vérifier la compile**

Run: `bun run check`
Expected: PASS (0 erreur, 0 warning). NB : `check` inclut `prettier --check .`
(AGENTS.md a été corrigé en ce sens) — spec et plan sont déjà formatés ; si un
doc est retouché en cours de route, `bun run format` avant de relancer.

- [ ] **Step 3: Commit**

```bash
git add features/users/schemas.ts
git commit -m "feat: schema zod updateUserRole"
```

---

### Task 2: Tests d'intégration de `updateUserRole` (rouges)

**Files:**

- Create: `tests/integration/users-role.test.ts`

Conventions copiées de `tests/integration/users-account.test.ts` : le projet `integration` tourne sur une branche Neon éphémère (`bun run test:integration` = créer branche → migrer → vitest → détruire). Les guards sont mockés ; le mock factory de `@/lib/auth-guards` doit exporter **requireSession ET requireRole** (les deux sont importés par `actions.ts`).

- [ ] **Step 1: Écrire le fichier de test complet**

```ts
import { eq } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import { updateUserRole } from "@/features/users/actions"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

// Mêmes stubs que users-account.test.ts : on ne charge pas la stack Better Auth,
// et les guards sont pilotés par le test (le re-check transactionnel, lui, lit la
// vraie base — c'est précisément ce qu'on teste).
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

const adminId = createId()
const targetId = createId()
const adminEmail = `role-admin-${adminId}@test.invalid`
const targetEmail = `role-target-${targetId}@test.invalid`

const mockCallerSession = () =>
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, email: adminEmail, role: "admin" },
    session: { id: createId() },
  } as never)

const getUserRow = async (id: string) => {
  const [row] = await db
    .select({ role: user.role, updatedAt: user.updatedAt })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return row
}

const getRole = async (id: string) => (await getUserRow(id))?.role

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: adminId,
      name: "Admin Test",
      email: adminEmail,
      emailVerified: true,
      role: "admin",
    },
    {
      id: targetId,
      name: "Cible Test",
      email: targetEmail,
      emailVerified: true,
    },
  ])
})

afterAll(async () => {
  await db.delete(user).where(eq(user.id, adminId))
  await db.delete(user).where(eq(user.id, targetId))
})

beforeEach(async () => {
  // Remet l'état de référence : appelant admin actif, cible user active.
  await db
    .update(user)
    .set({ role: "admin", deletedAt: null })
    .where(eq(user.id, adminId))
  await db
    .update(user)
    .set({ role: "user", deletedAt: null })
    .where(eq(user.id, targetId))
  mockCallerSession()
})

describe("updateUserRole", () => {
  it("promeut un utilisateur en admin", async () => {
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result).toEqual({ success: true })
    expect(await getRole(targetId)).toBe("admin")
  })

  it("rétrograde un admin en utilisateur", async () => {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, targetId))
    const result = await updateUserRole({ userId: targetId, role: "user" })
    expect(result).toEqual({ success: true })
    expect(await getRole(targetId)).toBe("user")
  })

  it("est idempotent si le rôle est déjà celui demandé (aucune écriture)", async () => {
    const before = await getUserRow(targetId)
    const result = await updateUserRole({ userId: targetId, role: "user" })
    expect(result).toEqual({ success: true })
    const after = await getUserRow(targetId)
    expect(after?.role).toBe("user")
    // `updatedAt` a $onUpdate (db/schema/auth.ts) : tout UPDATE le bump —
    // l'égalité prouve qu'aucune écriture n'a eu lieu.
    expect(after?.updatedAt?.getTime()).toBe(before?.updatedAt?.getTime())
  })

  it("refuse l'auto-modification", async () => {
    const result = await updateUserRole({ userId: adminId, role: "user" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Vous ne pouvez pas modifier votre propre rôle.")
    expect(await getRole(adminId)).toBe("admin")
  })

  it("refuse si l'appelant n'est plus admin actif en base (re-check transactionnel)", async () => {
    // La session mockée dit encore « admin », mais la base a changé entre-temps.
    await db.update(user).set({ role: "user" }).where(eq(user.id, adminId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      "Votre compte n'a plus les droits administrateur.",
    )
    expect(await getRole(targetId)).toBe("user")
  })

  it("refuse si l'appelant est soft-deleted", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, adminId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result.success).toBe(false)
    expect(await getRole(targetId)).toBe("user")
  })

  it("refuse une cible inexistante", async () => {
    const result = await updateUserRole({ userId: createId(), role: "admin" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Utilisateur introuvable.")
  })

  it("refuse une cible soft-deleted", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, targetId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Utilisateur introuvable.")
    expect(await getRole(targetId)).toBe("user")
  })

  it("refuse un rôle hors enum (zod)", async () => {
    const result = await updateUserRole({
      userId: targetId,
      role: "superadmin" as never,
    })
    expect(result.success).toBe(false)
    expect(await getRole(targetId)).toBe("user")
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test:integration`
Expected: FAIL — `users-role.test.ts` échoue à l'import (`updateUserRole` n'existe pas encore dans `@/features/users/actions`). Les autres fichiers d'intégration restent verts.

(Coût : chaque run crée/migre/détruit une branche Neon, ~1-2 min — pas d'itération fine ici, un run rouge + un run vert en Task 3 suffisent.)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/users-role.test.ts
git commit -m "test: couverture integration updateUserRole (rouge)"
```

---

### Task 3: Server Action `updateUserRole`

**Files:**

- Modify: `features/users/actions.ts` (imports + nouvelle action, à placer après `loadUserPanelData`)

- [ ] **Step 1: Étendre les imports drizzle et schémas**

Ligne 3, ajouter `inArray` :

```ts
import { and, eq, inArray, isNull, ne } from "drizzle-orm"
```

Ligne 15, importer le nouveau schéma :

```ts
import { profileSchema, updateUserRoleSchema } from "@/features/users/schemas"
```

- [ ] **Step 2: Écrire l'action**

Réutilise `AccountActionResult` (défini dans ce même fichier, ligne ~225 : `{ success: boolean; error?: string }`).

```ts
// [Admin] Change le rôle d'un utilisateur. Invariant « jamais zéro admin
// actif » garanti sans compter les admins : l'auto-modification est interdite
// ET l'appelant est re-vérifié admin actif sous verrou dans la transaction —
// après l'écriture il reste donc toujours au moins lui. Le verrou couvre la
// race « l'appelant vient d'être rétrogradé » (requireRole est hors
// transaction). Pas de révocation de sessions : sans cookieCache, Better Auth
// relit le rôle en base à chaque requête.
export const updateUserRole = async (input: {
  userId: string
  role: "user" | "admin"
}): Promise<AccountActionResult> => {
  const authSession = await requireRole(["admin"])

  const parsed = updateUserRoleSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  const { userId: targetId, role } = parsed.data

  if (targetId === authSession.user.id) {
    return {
      success: false,
      error: "Vous ne pouvez pas modifier votre propre rôle.",
    }
  }

  const result = await db.transaction(async (tx) => {
    // Un seul SELECT ... FOR UPDATE trié par id : verrouille appelant + cible
    // dans un ordre déterministe (pas de deadlock entre deux appels croisés).
    const rows = await tx
      .select({ id: user.id, role: user.role, deletedAt: user.deletedAt })
      .from(user)
      .where(inArray(user.id, [authSession.user.id, targetId]))
      .orderBy(user.id)
      .for("update")

    const caller = rows.find((r) => r.id === authSession.user.id)
    if (!caller || caller.role !== "admin" || caller.deletedAt !== null) {
      return {
        ok: false as const,
        error: "Votre compte n'a plus les droits administrateur.",
      }
    }

    const target = rows.find((r) => r.id === targetId)
    if (!target || target.deletedAt !== null) {
      return { ok: false as const, error: "Utilisateur introuvable." }
    }

    if (target.role !== role) {
      await tx.update(user).set({ role }).where(eq(user.id, targetId))
    }
    return { ok: true as const }
  })

  if (!result.ok) {
    return { success: false, error: result.error }
  }

  revalidatePath("/admin/utilisateurs")
  revalidatePath(`/admin/utilisateurs/${targetId}`)
  return { success: true }
}
```

Piège TS connu (cf. `.claude/rules/data-layer.md`) : la valeur est retournée
DEPUIS le callback de `db.transaction` (pas via un `let` capturé), sinon le
narrowing après `if (!result.ok)` casse.

- [ ] **Step 3: Vérifier compile + lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 4: Vérifier le vert**

Run: `bun run test:integration`
Expected: PASS — les 9 tests de `users-role.test.ts` verts, le reste de la suite inchangé.

- [ ] **Step 5: Commit**

```bash
git add features/users/actions.ts
git commit -m "feat: server action updateUserRole (promotion/retrogradation admin)"
```

---

### Task 4: Fermer les endpoints HTTP du plugin admin Better Auth

**Files:**

- Modify: `lib/auth.ts` (config `betterAuth`, juste avant `plugins:`)

Contexte (revue adversariale du 2026-07-05, constat #2) : le plugin admin
n'est là que pour le champ `role`, mais il expose 15 endpoints HTTP via
`app/api/auth/[...all]` — dont `POST /admin/set-role` (aucune garde
self/dernier-admin : lock-out en un fetch) et `POST /admin/remove-user`
(suppression dure contournant la garde de `deleteMyAccount`). Aucun code de
l'app ne les utilise. `disabledPaths` (vérifié sur better-auth 1.6.20 :
match exact au routeur → 404, `better-auth/dist/api/index.mjs:164-166`)
ferme la surface.

- [ ] **Step 1: Ajouter `disabledPaths` dans `lib/auth.ts`**

Insérer juste avant la ligne `  plugins: [` :

```ts
  // Le plugin admin n'est configuré que pour porter `role` sur session.user :
  // ses endpoints HTTP ne sont pas utilisés par l'app et contournent les
  // gardes applicatives (auto-modification, dernier admin) de updateUserRole /
  // deleteMyAccount → fermés au routeur (404). Match EXACT : re-vérifier la
  // liste à chaque montée de version de better-auth.
  disabledPaths: [
    "/admin/set-role",
    "/admin/get-user",
    "/admin/create-user",
    "/admin/update-user",
    "/admin/list-users",
    "/admin/list-user-sessions",
    "/admin/unban-user",
    "/admin/ban-user",
    "/admin/impersonate-user",
    "/admin/stop-impersonating",
    "/admin/revoke-user-session",
    "/admin/revoke-user-sessions",
    "/admin/remove-user",
    "/admin/set-user-password",
    "/admin/has-permission",
  ],
```

- [ ] **Step 2: Vérifier compile + lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Vérifier le 404 (rapide, sans session)**

```bash
bun dev
# dans un autre terminal :
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/admin/set-role -H "Content-Type: application/json" -d "{}"
```

Expected: `404` (sans `disabledPaths`, cet appel non authentifié répondrait
401). Arrêter le serveur dev ensuite.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "fix: fermeture des endpoints HTTP inutilises du plugin admin better-auth"
```

---

### Task 5: Composant `UserRoleSection` (test d'abord)

**Files:**

- Create: `tests/components/admin/UserRoleSection.test.tsx`
- Create: `app/(admin)/admin/utilisateurs/[id]/_components/user-role-section.tsx`

- [ ] **Step 1: Écrire le test frontend (rouge)**

Conventions de `tests/users/profile-danger-zone.test.tsx` (mocks hoisted) +
mock motion via `tests/helpers/motion-mock.tsx`. Les dialogs Radix
fonctionnent en happy-dom (cf. `tests/components/quiz/FinishDialog.test.tsx`).

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRoleSection } from "@/app/(admin)/admin/utilisateurs/[id]/_components/user-role-section"
import { motionMockFactory } from "../../helpers/motion-mock"

const mocks = vi.hoisted(() => ({
  updateUserRole: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/features/users/actions", () => ({
  updateUserRole: mocks.updateUserRole,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock("motion/react", () => motionMockFactory)

const baseUser = {
  id: "user-1",
  name: "Marie Curie",
  email: "marie@exemple.com",
  role: "user" as const,
}

beforeEach(() => {
  mocks.updateUserRole.mockReset()
  mocks.refresh.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  mocks.updateUserRole.mockResolvedValue({ success: true })
})

describe("UserRoleSection", () => {
  it("affiche « Promouvoir administrateur » pour un utilisateur simple", () => {
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    expect(screen.getByTestId("role-toggle-open")).toHaveTextContent(
      "Promouvoir administrateur",
    )
  })

  it("affiche « Retirer le rôle administrateur » pour un admin", () => {
    render(
      <UserRoleSection
        user={{ ...baseUser, role: "admin" }}
        currentUserId="viewer-1"
      />,
    )
    expect(screen.getByTestId("role-toggle-open")).toHaveTextContent(
      "Retirer le rôle administrateur",
    )
  })

  it("masque le bouton sur sa propre fiche et affiche la note", () => {
    render(<UserRoleSection user={baseUser} currentUserId={baseUser.id} />)
    expect(screen.queryByTestId("role-toggle-open")).toBeNull()
    expect(screen.getByTestId("role-self-note")).toHaveTextContent(
      "Vous ne pouvez pas modifier votre propre rôle",
    )
  })

  it("confirme la promotion : dialog avec nom + email, appel action, refresh", async () => {
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Marie Curie")
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "marie@exemple.com",
    )
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() =>
      expect(mocks.updateUserRole).toHaveBeenCalledWith({
        userId: "user-1",
        role: "admin",
      }),
    )
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Utilisateur promu administrateur.",
    )
  })

  it("demande role=user pour rétrograder un admin", async () => {
    render(
      <UserRoleSection
        user={{ ...baseUser, role: "admin" }}
        currentUserId="viewer-1"
      />,
    )
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() =>
      expect(mocks.updateUserRole).toHaveBeenCalledWith({
        userId: "user-1",
        role: "user",
      }),
    )
  })

  it("affiche le toast d'erreur et n'appelle pas refresh quand l'action échoue", async () => {
    mocks.updateUserRole.mockResolvedValue({
      success: false,
      error: "Utilisateur introuvable.",
    })
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Utilisateur introuvable."),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
    // Le dialog reste ouvert en échec (fermeture pilotée par le succès).
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test -- UserRoleSection`
Expected: FAIL — module `user-role-section` introuvable.

- [ ] **Step 3: Écrire le composant**

```tsx
"use client"

import { ShieldCheck, ShieldOff } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { updateUserRole } from "@/features/users/actions"
import type { AdminUserDetail } from "@/features/users/dal"

interface UserRoleSectionProps {
  user: Pick<AdminUserDetail, "id" | "name" | "email" | "role">
  currentUserId: string
}

export const UserRoleSection = ({
  user,
  currentUserId,
}: UserRoleSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isSelf = user.id === currentUserId
  const isAdmin = user.role === "admin"

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await updateUserRole({
        userId: user.id,
        role: isAdmin ? "user" : "admin",
      })
      if (result.success) {
        toast.success(
          isAdmin
            ? "Rôle administrateur retiré."
            : "Utilisateur promu administrateur.",
        )
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Une erreur est survenue.")
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Rôle administrateur
        </h3>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {isAdmin
          ? "Cet utilisateur a un accès complet au back-office : questions, examens, utilisateurs et transactions."
          : "Promouvoir cet utilisateur lui donne un accès complet au back-office : questions, examens, utilisateurs et transactions."}
      </p>

      {isSelf ? (
        <p
          data-testid="role-self-note"
          className="mt-4 text-sm text-gray-400 italic dark:text-gray-500"
        >
          Vous ne pouvez pas modifier votre propre rôle.
        </p>
      ) : (
        <>
          <Button
            data-testid="role-toggle-open"
            variant={isAdmin ? "outline" : "default"}
            className={
              isAdmin
                ? "mt-4 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                : "mt-4 w-full rounded-xl"
            }
            onClick={() => setOpen(true)}
          >
            {isAdmin ? (
              <ShieldOff className="mr-2 h-4 w-4" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {isAdmin
              ? "Retirer le rôle administrateur"
              : "Promouvoir administrateur"}
          </Button>

          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isAdmin
                    ? "Retirer le rôle administrateur ?"
                    : "Promouvoir administrateur ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {user.name} ({user.email}){" "}
                  {isAdmin
                    ? "perdra immédiatement l'accès au back-office."
                    : "obtiendra un accès complet au back-office."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  data-testid="role-toggle-confirm"
                  disabled={isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    handleConfirm()
                  }}
                  className={
                    isAdmin ? "bg-red-600 text-white hover:bg-red-700" : ""
                  }
                >
                  {isAdmin ? "Retirer le rôle" : "Promouvoir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </motion.div>
  )
}
```

Note : `e.preventDefault()` sur `AlertDialogAction` empêche Radix de fermer le
dialog avant la fin de l'action ; la fermeture est pilotée par `setOpen(false)`
au succès (le dialog reste ouvert en cas d'erreur).

- [ ] **Step 4: Vérifier le vert**

Run: `bun run test -- UserRoleSection`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/components/admin/UserRoleSection.test.tsx "app/(admin)/admin/utilisateurs/[id]/_components/user-role-section.tsx"
git commit -m "feat: carte de gestion du role admin sur la fiche utilisateur"
```

---

### Task 6: Câblage page + wrapper client

**Files:**

- Modify: `app/(admin)/admin/utilisateurs/[id]/page.tsx:20` (capturer la session)
- Modify: `app/(admin)/admin/utilisateurs/[id]/page.tsx:59-68` (prop `currentUserId`)
- Modify: `app/(admin)/admin/utilisateurs/[id]/user-detail-client.tsx` (prop + rendu)

- [ ] **Step 1: Capturer la session dans la page**

Dans `page.tsx`, remplacer :

```ts
await requireRole(["admin"])
```

par :

```ts
const session = await requireRole(["admin"])
```

et dans le JSX final, ajouter la prop (uniquement l'id — jamais l'objet
session complet côté client, cf. `data-layer.md` PII) :

```tsx
<UserDetailClient
  user={user}
  currentUserId={session.user.id}
  initialAccess={access ?? { examAccess: null, trainingAccess: null }}
  initialTransactions={txPage.items}
  initialCursor={txPage.nextCursor}
  products={products}
  selectableUsers={selectableUsers}
/>
```

- [ ] **Step 2: Rendre la carte dans `user-detail-client.tsx`**

Ajouter l'import :

```ts
import { UserRoleSection } from "./_components/user-role-section"
```

Étendre l'interface et la signature :

```ts
interface UserDetailClientProps {
  user: AdminUserDetail
  currentUserId: string
  initialAccess: AccessStatus
  initialTransactions: AdminTransactionView[]
  initialCursor: string | null
  products: ProductView[]
  selectableUsers: SelectableUser[]
}
```

(et ajouter `currentUserId` à la destructuration des props.)

Remplacer la colonne gauche :

```tsx
<div className="lg:col-span-1">
  <UserInfoCard user={user} />
</div>
```

par :

```tsx
<div className="space-y-6 lg:col-span-1">
  <UserInfoCard user={user} />
  <UserRoleSection user={user} currentUserId={currentUserId} />
</div>
```

- [ ] **Step 3: Gates complets**

Run: `bun run check && bun run test`
Expected: PASS partout.

- [ ] **Step 4: Vérification manuelle (optionnelle mais recommandée)**

`bun dev` → `/admin/utilisateurs` → ouvrir une fiche : carte visible, dialog,
promotion effective (badge passe à « Admin » après confirmation), note « propre
rôle » sur sa propre fiche. Arrêter le serveur dev ensuite.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/utilisateurs/[id]/page.tsx" "app/(admin)/admin/utilisateurs/[id]/user-detail-client.tsx"
git commit -m "feat: cablage de la gestion du role admin dans la fiche utilisateur"
```

---

### Task 7: Documentation des specs/plans

- [ ] **Step 1: Formater puis committer spec + plan**

`bun run check` inclut `prettier --check .` : les docs doivent être formatés
pour ne pas casser la CI.

```bash
bunx prettier --write docs/superpowers/specs/2026-07-05-gestion-role-admin-design.md docs/superpowers/plans/2026-07-05-gestion-role-admin.md
git add docs/superpowers/specs/2026-07-05-gestion-role-admin-design.md docs/superpowers/plans/2026-07-05-gestion-role-admin.md
git commit -m "docs: spec + plan gestion du role administrateur"
```

---

## Hors scope (rappel spec)

Notification email au promu, table d'audit, rôles intermédiaires, action dans
le side panel de la liste. Ne rien implémenter de tout ça.

Suite recommandée par la revue, à proposer SÉPARÉMENT (pas dans ce plan) :
durcir le TOCTOU de `deleteMyAccount` (décider la branche « dernier admin »
sur le rôle lu en base sous verrou, pas sur `authSession.user.role`).
