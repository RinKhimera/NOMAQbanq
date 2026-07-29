# Refonte des états de chargement — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les six mécanismes de chargement incohérents de l'app par une doctrine unique — squelette pour la navigation, contenu grisé pour le rechargement en place, spinner unique dans les déclencheurs — et supprimer l'overlay plein écran qui bloque chaque page authentifiée.

**Architecture:** Un socle de primitives dans `components/ui/` (`Spinner`, `PageSkeleton`, patterns de squelette, `PendingRegion`), consommé par des squelettes co-localisés (`_components/*-skeleton.tsx`) et par un `loading.tsx` déclaré explicitement sur chaque segment feuille. L'overlay disparaît en faisant descendre l'utilisateur du layout serveur jusqu'à la sidebar en props, ce qui supprime l'état de chargement au lieu de l'habiller.

**Tech Stack:** Next.js 16 (App Router, Server Components, Suspense) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · lucide-react · Vitest + Testing Library (happy-dom) · Playwright

**Spec:** `docs/superpowers/specs/2026-07-28-refonte-etats-de-chargement-design.md`

---

## Structure des fichiers

**Créés — socle (`components/ui/`, exclu de la couverture par `vitest.config.ts:41`) :**

| Fichier                               | Responsabilité                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `components/ui/spinner.tsx`           | Le seul spinner de l'app. 3 tailles, `currentColor`, `role="status"`, `motion-reduce`. |
| `components/ui/skeleton-patterns.tsx` | `SkeletonText`, `SkeletonCard`, `SkeletonStatRow`, `SkeletonTable`, `PageSkeleton`.    |
| `components/ui/pending-region.tsx`    | Grisage + `aria-busy` d'une zone en rechargement.                                      |

**Créés — squelettes de route :**

| Fichier                                                                              | Responsabilité                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `components/admin/admin-list-skeleton.tsx`                                           | Squelette mutualisé des 4 écrans de liste admin.      |
| `app/(dashboard)/tableau-de-bord/entrainement/_components/entrainement-skeleton.tsx` | Squelette dédié entraînement.                         |
| `app/(marketing)/evaluation/_components/evaluation-skeleton.tsx`                     | Squelette de `QuestionCard` pour le quiz public.      |
| 14 `loading.tsx`                                                                     | Un par segment feuille (liste exhaustive en Phase 3). |

**Créés — garde-fous :**

| Fichier                                          | Responsabilité                                 |
| ------------------------------------------------ | ---------------------------------------------- |
| `.claude/rules/loading-ui.md`                    | La doctrine, chargée par les futures sessions. |
| `tests/architecture/loading-conventions.test.ts` | Échoue si `animate-spin` fuit hors du socle.   |

**Modifiés (principaux) :** `components/shared/{generic-nav-user,dashboard-shell}.tsx`, `app/(dashboard)/layout.tsx`, `app/(admin)/layout.tsx`, `app/(dashboard)/tableau-de-bord/{page,bienvenue/page}.tsx`, `app/(admin)/admin/utilisateurs/_components/users-table.tsx`, `components/shared/payments/transaction-table.tsx`, `vitest.config.ts`, `AGENTS.md`, + ~30 fichiers de substitution de spinner (Phase 5).

**Supprimés :** `app/(admin)/admin/utilisateurs/_components/user-table-skeleton.tsx` (code mort).

**Explicitement NON touchés :** `components/shared/onboarding-guard.tsx` et `tests/components/OnboardingGuard.test.tsx` (constat 🔴1 de la revue — un layout ne peut pas lire `pathname`).

---

## Préalable : la branche

- [ ] **Étape 1 : Créer la branche de travail**

```bash
git checkout -b refonte-etats-chargement
git status
```

Attendu : `On branch refonte-etats-chargement`, working tree propre (le spec et le plan sont déjà présents, non suivis ou déjà committés selon ton choix).

- [ ] **Étape 2 : Vérifier que la barrière est verte AVANT de commencer**

```bash
bun run check
```

Attendu : exit 0. Si prettier râle sur des fichiers que tu n'as pas touchés, lance `bunx prettier --write` **uniquement** sur ceux-là et recommence.

---

# Phase 1 — Le socle

Aucun composant existant ne change en Phase 1 : on crée les primitives et on les teste. Rien ne casse.

## Tâche 1.1 : Le composant `Spinner`

**Fichiers :**

- Créer : `components/ui/spinner.tsx`
- Test : `tests/components/ui/Spinner.test.tsx`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `tests/components/ui/Spinner.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Spinner } from "@/components/ui/spinner"

describe("Spinner", () => {
  it("expose un role status et un libellé lecteur d'écran", () => {
    render(<Spinner />)
    const status = screen.getByRole("status")
    expect(status).toBeInTheDocument()
    expect(screen.getByText("Chargement…")).toBeInTheDocument()
  })

  it("accepte un libellé personnalisé", () => {
    render(<Spinner label="Envoi en cours…" />)
    expect(screen.getByText("Envoi en cours…")).toBeInTheDocument()
  })

  it("applique la taille demandée", () => {
    const { rerender } = render(<Spinner size="sm" />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "size-4",
    )

    rerender(<Spinner size="lg" />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "size-8",
    )
  })

  it("désactive l'animation quand le mouvement est réduit", () => {
    render(<Spinner />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "motion-reduce:animate-none",
    )
  })

  it("fusionne les classes fournies par l'appelant", () => {
    render(<Spinner className="text-white" />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "text-white",
    )
  })
})
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test tests/components/ui/Spinner.test.tsx
```

Attendu : ÉCHEC — `Failed to resolve import "@/components/ui/spinner"`.

- [ ] **Étape 3 : Écrire l'implémentation minimale**

Créer `components/ui/spinner.tsx` :

```tsx
import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const

type SpinnerProps = {
  /** `sm` dans un bouton ou un champ, `md` par défaut, `lg` pour un écran d'attente dédié. */
  size?: keyof typeof SIZES
  /** Classes du SVG. La couleur vient de `currentColor` : hériter plutôt que forcer. */
  className?: string
  /** Annoncé aux lecteurs d'écran. */
  label?: string
}

/**
 * Le seul spinner de l'application. Réservé aux attentes déclenchées par une
 * action de l'utilisateur (bouton, formulaire, upload) — jamais pour une
 * navigation, qui relève du squelette. Voir `.claude/rules/loading-ui.md`.
 */
export const Spinner = ({
  size = "md",
  className,
  label = "Chargement…",
}: SpinnerProps) => (
  <span role="status" className="inline-flex items-center">
    <LoaderCircle
      aria-hidden="true"
      className={cn(
        SIZES[size],
        "animate-spin motion-reduce:animate-none",
        className,
      )}
    />
    <span className="sr-only">{label}</span>
  </span>
)
```

- [ ] **Étape 4 : Lancer le test pour vérifier qu'il passe**

```bash
bun run test tests/components/ui/Spinner.test.tsx
```

Attendu : PASS, 5 tests.

- [ ] **Étape 5 : Commit**

```bash
git add components/ui/spinner.tsx tests/components/ui/Spinner.test.tsx
git commit -m "feat(ui): ajouter le composant Spinner unique"
```

## Tâche 1.2 : `PendingRegion`

**Fichiers :**

- Créer : `components/ui/pending-region.tsx`
- Test : `tests/components/ui/PendingRegion.test.tsx`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `tests/components/ui/PendingRegion.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PendingRegion } from "@/components/ui/pending-region"

describe("PendingRegion", () => {
  it("rend toujours ses enfants, en attente comme au repos", () => {
    const { rerender } = render(
      <PendingRegion isPending={false}>
        <p>Contenu</p>
      </PendingRegion>,
    )
    expect(screen.getByText("Contenu")).toBeInTheDocument()

    rerender(
      <PendingRegion isPending>
        <p>Contenu</p>
      </PendingRegion>,
    )
    expect(screen.getByText("Contenu")).toBeInTheDocument()
  })

  it("marque la zone occupée et la rend inerte pendant l'attente", () => {
    render(
      <PendingRegion isPending data-testid="region">
        <button type="button">Modifier</button>
      </PendingRegion>,
    )
    const region = screen.getByTestId("region")
    expect(region).toHaveAttribute("aria-busy", "true")
    expect(region).toHaveClass("pointer-events-none")
    expect(region).toHaveClass("opacity-60")
  })

  it("ne marque rien au repos", () => {
    render(
      <PendingRegion isPending={false} data-testid="region">
        <button type="button">Modifier</button>
      </PendingRegion>,
    )
    const region = screen.getByTestId("region")
    expect(region).toHaveAttribute("aria-busy", "false")
    expect(region).not.toHaveClass("pointer-events-none")
  })
})
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test tests/components/ui/PendingRegion.test.tsx
```

Attendu : ÉCHEC — `Failed to resolve import "@/components/ui/pending-region"`.

- [ ] **Étape 3 : Écrire l'implémentation minimale**

Créer `components/ui/pending-region.tsx` :

```tsx
import { cn } from "@/lib/utils"

type PendingRegionProps = React.ComponentProps<"div"> & {
  isPending: boolean
}

/**
 * Zone en cours de rechargement : le contenu reste à l'écran (pas de saut de
 * layout, l'utilisateur garde son repère) mais devient inerte le temps de la
 * requête. Pour un rechargement en place uniquement — une navigation relève du
 * squelette. Voir `.claude/rules/loading-ui.md`.
 */
export const PendingRegion = ({
  isPending,
  className,
  children,
  ...props
}: PendingRegionProps) => (
  <div
    aria-busy={isPending}
    className={cn(
      "transition-opacity duration-200",
      isPending && "pointer-events-none opacity-60",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)
```

- [ ] **Étape 4 : Lancer le test pour vérifier qu'il passe**

```bash
bun run test tests/components/ui/PendingRegion.test.tsx
```

Attendu : PASS, 3 tests.

- [ ] **Étape 5 : Commit**

```bash
git add components/ui/pending-region.tsx tests/components/ui/PendingRegion.test.tsx
git commit -m "feat(ui): ajouter PendingRegion pour le rechargement en place"
```

> **Note d'accessibilité (traitée ici, pas plus tard) :** `pointer-events-none` neutralise la souris mais **pas le clavier** — un bouton à l'intérieur reste focusable et actionnable via `Entrée`. C'est volontaire et suffisant : l'attente dure ~300 ms, la zone est annoncée `aria-busy`, et rendre les enfants `inert` casserait la position du focus au retour. Ne pas « corriger » sans mesurer.

## Tâche 1.3 : Les patterns de squelette

**Fichiers :**

- Créer : `components/ui/skeleton-patterns.tsx`
- Modifier : `components/ui/skeleton.tsx`
- Test : `tests/components/ui/SkeletonPatterns.test.tsx`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `tests/components/ui/SkeletonPatterns.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  PageSkeleton,
  SkeletonStatRow,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/skeleton-patterns"

const slots = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')

describe("SkeletonText", () => {
  it("rend le nombre de lignes demandé", () => {
    const { container } = render(<SkeletonText lines={4} />)
    expect(slots(container)).toHaveLength(4)
  })

  it("rend 3 lignes par défaut", () => {
    const { container } = render(<SkeletonText />)
    expect(slots(container)).toHaveLength(3)
  })
})

describe("SkeletonStatRow", () => {
  it("rend le nombre de cartes demandé", () => {
    const { container } = render(<SkeletonStatRow count={5} />)
    expect(
      container.querySelectorAll('[data-testid="skeleton-stat"]'),
    ).toHaveLength(5)
  })
})

describe("SkeletonTable", () => {
  it("rend une grille de lignes × colonnes", () => {
    const { container } = render(<SkeletonTable columns={3} rows={4} />)
    // 1 ligne d'en-tête + 4 lignes de corps, à 3 colonnes chacune
    expect(slots(container)).toHaveLength(3 * 5)
  })
})

describe("PageSkeleton", () => {
  it("est annoncé comme un chargement de page", () => {
    render(<PageSkeleton />)
    // Requête par libellé plutôt que par rôle : `<output>` porte implicitement
    // role="status", mais on ne veut pas que le test dépende du mapping ARIA
    // de happy-dom.
    expect(screen.getByLabelText("Chargement de la page")).toBeInTheDocument()
  })
})
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test tests/components/ui/SkeletonPatterns.test.tsx
```

Attendu : ÉCHEC — `Failed to resolve import "@/components/ui/skeleton-patterns"`.

- [ ] **Étape 3 : Ajouter `motion-reduce` à la primitive existante**

Dans `components/ui/skeleton.tsx`, remplacer la ligne 7 :

```tsx
      className={cn("bg-accent animate-pulse rounded-md", className)}
```

par :

```tsx
      className={cn(
        "bg-accent animate-pulse rounded-md motion-reduce:animate-none",
        className,
      )}
```

- [ ] **Étape 4 : Écrire l'implémentation minimale**

Créer `components/ui/skeleton-patterns.tsx` :

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const LINE_WIDTHS = ["w-full", "w-11/12", "w-9/12", "w-10/12", "w-8/12"]

/** n lignes de texte en creux, de largeur décroissante pour éviter l'effet « bloc ». */
export const SkeletonText = ({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        className={cn("h-4", LINE_WIDTHS[i % LINE_WIDTHS.length])}
      />
    ))}
  </div>
)

/** Carte générique : en-tête + corps. */
export const SkeletonCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900",
      className,
    )}
  >
    <div className="mb-4 flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-5 w-40" />
    </div>
    <SkeletonText lines={3} />
  </div>
)

/** La rangée de cartes KPI présente sur les tableaux de bord et les listes admin. */
export const SkeletonStatRow = ({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) => (
  <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        data-testid="skeleton-stat"
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="mt-2 h-3 w-28" />
      </div>
    ))}
  </div>
)

/**
 * Table en creux : hauteur figée pour qu'aucun saut de layout ne survienne à
 * l'arrivée des données.
 */
export const SkeletonTable = ({
  columns = 4,
  rows = 8,
  className,
}: {
  columns?: number
  rows?: number
  className?: string
}) => (
  <div
    className={cn(
      "overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900",
      className,
    )}
  >
    <div
      className="grid gap-4 border-b border-gray-200/80 p-4 dark:border-gray-700/50"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} className="h-4 w-24" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div
        key={r}
        className="grid gap-4 border-b border-gray-100 p-4 last:border-0 dark:border-gray-800"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-5 w-full" />
        ))}
      </div>
    ))}
  </div>
)

/**
 * Repli de navigation des routes authentifiées sans squelette dédié. Toujours
 * monté explicitement par un `loading.tsx` — jamais hérité par accident d'un
 * segment parent, sous peine d'afficher la mauvaise forme.
 */
export const PageSkeleton = () => (
  <output
    aria-label="Chargement de la page"
    className="flex w-full flex-col gap-6 p-4 md:gap-8 lg:p-6"
  >
    <div className="space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
    <SkeletonStatRow count={4} />
    <SkeletonCard />
  </output>
)
```

> `<output>` porte implicitement `role="status"` : pas besoin de l'écrire, et ça évite un `<div role="status">` que le linter jsx-a11y signalerait.

- [ ] **Étape 5 : Lancer les tests pour vérifier qu'ils passent**

```bash
bun run test tests/components/ui/SkeletonPatterns.test.tsx
```

Attendu : PASS, 6 tests.

- [ ] **Étape 6 : Lancer la barrière**

```bash
bun run check
```

Attendu : exit 0.

- [ ] **Étape 7 : Commit**

```bash
git add components/ui/skeleton-patterns.tsx components/ui/skeleton.tsx tests/components/ui/SkeletonPatterns.test.tsx
git commit -m "feat(ui): ajouter les patterns de squelette et PageSkeleton"
```

---

# Phase 2 — Supprimer l'overlay bloquant

C'est la seule phase avec une surface comportementale (auth, frontière PII). À réviser en diff avant d'empiler les phases suivantes.

## Tâche 2.1 : Faire descendre l'utilisateur du layout serveur

**Fichiers :**

- Modifier : `components/shared/dashboard-shell.tsx`
- Modifier : `app/(dashboard)/layout.tsx`
- Modifier : `app/(admin)/layout.tsx`
- Créer : `lib/session-user.ts`

- [ ] **Étape 1 : Créer la projection de session**

Créer `lib/session-user.ts` :

```ts
import type { getCurrentSession } from "@/lib/dal"

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>

/**
 * Sous-ensemble de la session destiné au client. La session Better Auth porte
 * `session.token` : elle ne doit JAMAIS traverser la frontière serveur-client
 * (`.claude/rules/data-layer.md`). On projette explicitement, on ne « nettoie »
 * pas — un champ ajouté à Better Auth ne doit pas fuiter par défaut.
 */
export type SessionUser = {
  name: string
  email: string
  image: string | null
  role: "user" | "admin"
}

export const toSessionUser = (session: Session): SessionUser => ({
  name: session.user.name,
  email: session.user.email,
  image: session.user.image ?? null,
  role: (session.user.role ?? "user") as "user" | "admin",
})
```

- [ ] **Étape 2 : Passer l'utilisateur en prop du shell**

Dans `components/shared/dashboard-shell.tsx`, remplacer le bloc `type DashboardShellProps` … jusqu'à la balise `<AppSidebar>` incluse :

```tsx
type DashboardShellProps = {
  children: React.ReactNode
  variant: "admin" | "user"
}

export const DashboardShell = ({ children, variant }: DashboardShellProps) => {
  const isAdmin = variant === "admin"
  const navigation = isAdmin ? adminNavigation : dashboardNavigation
  const homeUrl = isAdmin ? "/admin" : "/tableau-de-bord"
```

par :

```tsx
type DashboardShellProps = {
  children: React.ReactNode
  variant: "admin" | "user"
  user: SessionUser
}

export const DashboardShell = ({
  children,
  variant,
  user,
}: DashboardShellProps) => {
  const isAdmin = variant === "admin"
  const navigation = isAdmin ? adminNavigation : dashboardNavigation
  const homeUrl = isAdmin ? "/admin" : "/tableau-de-bord"
```

Puis remplacer la prop `userComponent` (lignes 36-38) :

```tsx
        userComponent={
          <GenericNavUser requireAdmin={isAdmin} redirectUrl="/" />
        }
```

par :

```tsx
        userComponent={<GenericNavUser user={user} isAdmin={isAdmin} />}
```

Et ajouter l'import en tête de fichier, après l'import de `constants` :

```tsx
import type { SessionUser } from "@/lib/session-user"
```

- [ ] **Étape 3 : Alimenter le shell depuis les deux layouts**

Remplacer intégralement `app/(dashboard)/layout.tsx` :

```tsx
import { DashboardShell } from "@/components/shared/dashboard-shell"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { requireSession } from "@/lib/auth-guards"
import { toSessionUser } from "@/lib/session-user"

// Garde SERVEUR : exige une session pour toute la zone dashboard (le proxy reste optimiste).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <>
      <OnboardingGuard />
      <DashboardShell variant="user" user={toSessionUser(session)}>
        {children}
      </DashboardShell>
    </>
  )
}
```

Remplacer intégralement `app/(admin)/layout.tsx` :

```tsx
import { DashboardShell } from "@/components/shared/dashboard-shell"
import { requireRole } from "@/lib/auth-guards"
import { toSessionUser } from "@/lib/session-user"

// Garde SERVEUR (la vraie barrière) : redirige tout non-admin avant le moindre rendu.
// Le proxy.ts ne fait qu'un check optimiste de cookie ; l'autorisation fait foi ICI.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireRole(["admin"])

  return (
    <DashboardShell variant="admin" user={toSessionUser(session)}>
      {children}
    </DashboardShell>
  )
}
```

- [ ] **Étape 4 : Vérifier que le type-check échoue à l'endroit attendu**

```bash
bun run type-check
```

Attendu : ÉCHEC dans `components/shared/dashboard-shell.tsx` — `GenericNavUser` n'accepte pas encore les props `user` / `isAdmin`. C'est la tâche 2.2 qui le corrige : ne pas committer ici.

## Tâche 2.2 : `GenericNavUser` redevient un item de menu

**Fichiers :**

- Modifier : `components/shared/generic-nav-user.tsx`

- [ ] **Étape 1 : Remplacer l'en-tête du composant**

Remplacer le bloc des lignes 1-105 (des imports jusqu'à la fin de `handleSignOut`) par :

```tsx
"use client"

import { IconDotsVertical, IconLogout } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { UserAvatar } from "@/components/shared/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import type { SessionUser } from "@/lib/session-user"
import { cn } from "@/lib/utils"

interface NavUserProps {
  user: SessionUser
  isAdmin?: boolean
}

/**
 * Item de menu utilisateur de la sidebar. L'utilisateur vient du layout serveur
 * (qui a déjà gardé la zone via `requireSession`/`requireRole`) : ce composant
 * n'a donc AUCUN état de chargement et ne garde ni ne redirige rien. Ne pas y
 * réintroduire de `useSession` — c'était la cause de l'overlay plein écran.
 */
export const GenericNavUser = ({ user, isAdmin = false }: NavUserProps) => {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/connexion")
  }
```

- [ ] **Étape 2 : Renommer les références dans le JSX restant**

Dans tout le JSX qui suit (lignes 107 à la fin), remplacer :

- `requireAdmin` → `isAdmin` (7 occurrences)
- `currentUser.name` → `user.name` (3 occurrences)
- `currentUser.image` → `user.image` (2 occurrences)
- `currentUser.email` → `user.email` (2 occurrences)

Vérification :

```bash
grep -n "requireAdmin\|currentUser\|useCurrentUser\|useEffect\|fixed inset-0" components/shared/generic-nav-user.tsx
```

Attendu : **aucune sortie**.

- [ ] **Étape 3 : Lancer type-check et lint**

```bash
bun run type-check && bun run lint
```

Attendu : exit 0 pour les deux.

- [ ] **Étape 4 : Vérifier que les deux overlays ont disparu du code**

```bash
grep -rn "fixed inset-0 z-50" components/shared/
```

Attendu : **aucune sortie** (les seuls `fixed inset-0` restants sont dans `components/ui/{dialog,sheet,alert-dialog}.tsx` et `components/quiz/`, tous légitimes).

- [ ] **Étape 5 : Commit**

```bash
git add components/shared/generic-nav-user.tsx components/shared/dashboard-shell.tsx app/\(dashboard\)/layout.tsx app/\(admin\)/layout.tsx lib/session-user.ts
git commit -m "fix(ui): supprimer l'overlay de chargement plein écran de la sidebar"
```

## Tâche 2.3 : `bienvenue` en Server Component

**Fichiers :**

- Modifier : `app/(dashboard)/tableau-de-bord/bienvenue/page.tsx`
- Créer : `app/(dashboard)/tableau-de-bord/bienvenue/_components/onboarding-form.tsx`

- [ ] **Étape 1 : Extraire le formulaire dans un composant client**

Créer `app/(dashboard)/tableau-de-bord/bienvenue/_components/onboarding-form.tsx` avec l'intégralité du contenu actuel de `bienvenue/page.tsx`, puis appliquer ces modifications :

1. Remplacer la signature et les hooks d'en-tête :

```tsx
export default function OnboardingPage() {
  const { currentUser, isLoading, refetch } = useCurrentUser()
  const router = useRouter()

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", username: "", bio: "" },
    mode: "onChange",
  })

  const prefilled = useRef(false)

  useEffect(() => {
    if (isLoading || !currentUser) return
    if (currentUser.username) {
      router.replace("/tableau-de-bord")
      return
    }
    if (prefilled.current) return
    prefilled.current = true
    form.reset({
      name: currentUser.name ?? "",
      username: "",
      bio: currentUser.bio ?? "",
    })
  }, [currentUser, isLoading, router, form])
```

par :

```tsx
type OnboardingFormProps = {
  defaultName: string
  defaultBio: string
}

export const OnboardingForm = ({
  defaultName,
  defaultBio,
}: OnboardingFormProps) => {
  const { refetch } = useCurrentUser()
  const router = useRouter()

  // Valeurs initiales rendues côté serveur : plus d'effet de préremplissage,
  // donc plus d'état de chargement à afficher. La redirection « déjà onboardé »
  // reste à la charge d'OnboardingGuard, monté dans le layout.
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: defaultName, username: "", bio: defaultBio },
    mode: "onChange",
  })
```

2. Supprimer les imports devenus inutiles : `useEffect`, `useRef`.
3. Supprimer intégralement les deux branches de rendu conditionnel (le bloc `if (isLoading || currentUser === undefined)` et le bloc `if (!currentUser)`), spinner `min-h-96` compris.

- [ ] **Étape 2 : Réécrire la page en Server Component**

Remplacer intégralement `app/(dashboard)/tableau-de-bord/bienvenue/page.tsx` :

```tsx
import type { Metadata } from "next"
import { requireSession } from "@/lib/auth-guards"
import { OnboardingForm } from "./_components/onboarding-form"

export const metadata: Metadata = { title: "Bienvenue" }

export default async function BienvenuePage() {
  const session = await requireSession()

  return (
    <OnboardingForm
      defaultName={session.user.name ?? ""}
      defaultBio={session.user.bio ?? ""}
    />
  )
}
```

- [ ] **Étape 3 : Vérifier qu'il ne reste aucun spinner sur ce parcours**

```bash
grep -rn "animate-spin" "app/(dashboard)/tableau-de-bord/bienvenue/"
```

Attendu : **aucune sortie**.

- [ ] **Étape 4 : Lancer la barrière et la suite de tests**

```bash
bun run check && bun run test
```

Attendu : exit 0. `tests/components/OnboardingPage.test.tsx` cible l'ancien composant par défaut — s'il échoue, adapter son import vers `OnboardingForm` et lui passer `defaultName=""` / `defaultBio=""`, **sans changer ses assertions**.

- [ ] **Étape 5 : Commit**

```bash
git add "app/(dashboard)/tableau-de-bord/bienvenue" tests/components/OnboardingPage.test.tsx
git commit -m "refactor(onboarding): rendre la page bienvenue côté serveur"
```

- [ ] **Étape 6 : POINT DE CONTRÔLE — revue de diff recommandée**

C'est la fin de la seule phase à surface comportementale. Avant d'empiler les phases 3 à 5 :

```bash
git diff main...HEAD --stat
```

Faire relire ce diff (revue adversariale sur diff, session séparée) avant de continuer. Les phases suivantes sont cosmétiques et ne le justifient pas isolément.

---

# Phase 3 — Un `loading.tsx` par segment

Aucun héritage implicite : chaque segment feuille déclare le sien. C'est le constat 🟠4 de la revue.

## Tâche 3.1 : `AdminListSkeleton` et les 4 listes admin

**Fichiers :**

- Créer : `components/admin/admin-list-skeleton.tsx`
- Créer : `app/(admin)/admin/{utilisateurs,questions,examens,transactions}/loading.tsx`
- Modifier : `vitest.config.ts`
- Supprimer : `app/(admin)/admin/utilisateurs/_components/user-table-skeleton.tsx`

- [ ] **Étape 1 : Créer le squelette mutualisé**

Créer `components/admin/admin-list-skeleton.tsx` :

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import {
  SkeletonStatRow,
  SkeletonTable,
} from "@/components/ui/skeleton-patterns"

type AdminListSkeletonProps = {
  statCount?: number
  columns?: number
}

/**
 * Squelette des 4 écrans de liste admin (utilisateurs, questions, examens,
 * transactions), qui partagent la même anatomie : stat cards → barre de filtres
 * → table paginée. Monté par le `loading.tsx` de ces routes UNIQUEMENT — leurs
 * segments enfants (détail, création, modification) ont leur propre `loading.tsx`
 * avec `PageSkeleton`, sinon ils hériteraient d'un squelette de liste.
 */
export const AdminListSkeleton = ({
  statCount = 4,
  columns = 5,
}: AdminListSkeletonProps) => (
  <output
    aria-label="Chargement de la liste"
    className="flex w-full flex-col gap-6 p-4 md:gap-8 lg:p-6"
  >
    <div className="space-y-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
    <SkeletonStatRow count={statCount} />
    <div className="flex flex-wrap gap-3">
      <Skeleton className="h-10 min-w-64 flex-1" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-10 w-40" />
    </div>
    <SkeletonTable columns={columns} rows={8} />
  </output>
)
```

- [ ] **Étape 2 : Créer les 4 `loading.tsx`**

`app/(admin)/admin/utilisateurs/loading.tsx` :

```tsx
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={4} columns={5} />
}
```

`app/(admin)/admin/questions/loading.tsx` :

```tsx
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={4} columns={5} />
}
```

`app/(admin)/admin/examens/loading.tsx` :

```tsx
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={4} columns={4} />
}
```

`app/(admin)/admin/transactions/loading.tsx` :

```tsx
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={3} columns={6} />
}
```

- [ ] **Étape 3 : Exclure le squelette de la couverture**

Dans `vitest.config.ts`, dans le tableau `coverage.exclude`, après la ligne `"components/admin/dashboard/skeleton.tsx",` (ligne 79), ajouter :

```ts
        "components/admin/admin-list-skeleton.tsx",
```

> Sans cette ligne, un composant de balisage pur sans test ferait baisser la couverture globale sous le seuil de 80 %, exactement comme les squelettes déjà listés au-dessus.

- [ ] **Étape 4 : Supprimer le squelette mort**

```bash
git rm "app/(admin)/admin/utilisateurs/_components/user-table-skeleton.tsx"
grep -rn "UserTableSkeleton" app components tests
```

Attendu : **aucune sortie** pour le grep.

- [ ] **Étape 5 : Lancer la barrière**

```bash
bun run check
```

Attendu : exit 0.

- [ ] **Étape 6 : Commit**

```bash
git add components/admin/admin-list-skeleton.tsx "app/(admin)/admin" vitest.config.ts
git commit -m "feat(admin): squelette de navigation mutualisé pour les listes"
```

## Tâche 3.2 : Les segments enfants admin

**Fichiers :** créer 8 `loading.tsx`.

- [ ] **Étape 1 : Créer les fichiers**

Le même contenu pour les 8 :

```tsx
import { PageSkeleton } from "@/components/ui/skeleton-patterns"

export default function Loading() {
  return <PageSkeleton />
}
```

Aux emplacements suivants :

1. `app/(admin)/admin/utilisateurs/[id]/loading.tsx`
2. `app/(admin)/admin/questions/nouvelle/loading.tsx`
3. `app/(admin)/admin/questions/[questionId]/modifier/loading.tsx`
4. `app/(admin)/admin/examens/creer/loading.tsx`
5. `app/(admin)/admin/examens/modifier/[id]/loading.tsx`
6. `app/(admin)/admin/examens/[id]/loading.tsx`
7. `app/(admin)/admin/examens/[id]/resultats/[userId]/loading.tsx`
8. `app/(admin)/admin/profil/loading.tsx`

- [ ] **Étape 2 : Vérifier la couverture des segments**

```bash
find "app/(admin)" -name "page.tsx" | sed 's|/page.tsx||' | while read -r d; do
  [ -f "$d/loading.tsx" ] || echo "MANQUE: $d"
done
```

Attendu : **aucune sortie**.

- [ ] **Étape 3 : Commit**

```bash
git add "app/(admin)/admin"
git commit -m "feat(admin): loading.tsx explicite sur chaque segment enfant"
```

## Tâche 3.3 : Les segments étudiant et marketing

**Fichiers :**

- Modifier : `app/(dashboard)/tableau-de-bord/{profil,entrainement,examen-blanc,abonnements}/loading.tsx`
- Créer : `app/(dashboard)/tableau-de-bord/{examen-blanc/[examId],entrainement/[sessionId]}/loading.tsx`
- Créer : `app/(dashboard)/tableau-de-bord/entrainement/_components/entrainement-skeleton.tsx`
- Modifier : `app/(marketing)/evaluation/loading.tsx`

- [ ] **Étape 1 : Ressusciter `ProfileSkeleton`**

Remplacer intégralement `app/(dashboard)/tableau-de-bord/profil/loading.tsx` :

```tsx
import { ProfileSkeleton } from "./_components/profile-skeleton"

export default function Loading() {
  return <ProfileSkeleton />
}
```

- [ ] **Étape 2 : Créer le squelette entraînement**

Créer `app/(dashboard)/tableau-de-bord/entrainement/_components/entrainement-skeleton.tsx` :

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard, SkeletonText } from "@/components/ui/skeleton-patterns"

/** Forme réelle de l'écran : formulaire de configuration, puis historique. */
export const EntrainementSkeleton = () => (
  <output
    aria-label="Chargement de l'entraînement"
    className="flex w-full flex-col gap-6 p-4 md:gap-8 lg:p-6"
  >
    <div className="space-y-3">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <Skeleton className="mb-6 h-6 w-56" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <Skeleton className="mt-6 h-11 w-48" />
    </div>
    <SkeletonCard />
    <SkeletonText lines={2} />
  </output>
)
```

Remplacer intégralement `app/(dashboard)/tableau-de-bord/entrainement/loading.tsx` :

```tsx
import { EntrainementSkeleton } from "./_components/entrainement-skeleton"

export default function Loading() {
  return <EntrainementSkeleton />
}
```

- [ ] **Étape 3 : Basculer les segments restants sur `PageSkeleton`**

Le même contenu pour les 4 :

```tsx
import { PageSkeleton } from "@/components/ui/skeleton-patterns"

export default function Loading() {
  return <PageSkeleton />
}
```

Aux emplacements suivants (remplacer le contenu pour les deux premiers, créer les deux derniers) :

1. `app/(dashboard)/tableau-de-bord/examen-blanc/loading.tsx` (remplace le spinner)
2. `app/(dashboard)/tableau-de-bord/abonnements/loading.tsx` (remplace le spinner)
3. `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/loading.tsx` (nouveau)
4. `app/(dashboard)/tableau-de-bord/entrainement/[sessionId]/loading.tsx` (nouveau)

- [ ] **Étape 4 : Créer le squelette du quiz public**

Créer `app/(marketing)/evaluation/_components/evaluation-skeleton.tsx` :

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonText } from "@/components/ui/skeleton-patterns"

/** Forme d'une QuestionCard : énoncé puis options de réponse. */
export const EvaluationSkeleton = () => (
  <output
    aria-label="Chargement de l'évaluation"
    className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6"
  >
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-24" />
    </div>
    <Skeleton className="h-2 w-full rounded-full" />
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <SkeletonText lines={4} />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </output>
)
```

Remplacer intégralement `app/(marketing)/evaluation/loading.tsx` :

```tsx
import { EvaluationSkeleton } from "./_components/evaluation-skeleton"

export default function Loading() {
  return <EvaluationSkeleton />
}
```

- [ ] **Étape 5 : Vérifier qu'aucun `loading.tsx` ne contient plus de spinner**

```bash
grep -rn "animate-spin" --include="loading.tsx" app/
```

Attendu : **aucune sortie**.

- [ ] **Étape 6 : Lancer la barrière**

```bash
bun run check
```

Attendu : exit 0.

- [ ] **Étape 7 : Commit**

```bash
git add "app/(dashboard)" "app/(marketing)"
git commit -m "feat(ui): squelettes de navigation sur les segments étudiant et marketing"
```

> **Le streaming interne des deux tableaux de bord est traité en Phase 6**, après tout le reste. Motif : `DashboardClient` (10 props) et `AdminDashboardClient` (8 props) reçoivent aujourd'hui **toutes** leurs données en props ; les découper touche les deux écrans les plus vus de l'app. C'est la seule partie de ce plan qui soit détachable, et elle doit venir en dernier.

---

# Phase 4 — Rechargement en place et états dégradés

## Tâche 4.1 : La table admin utilisateurs garde son contenu

**Fichiers :**

- Modifier : `app/(admin)/admin/utilisateurs/_components/users-table.tsx`

- [ ] **Étape 1 : Lire le bloc à remplacer**

```bash
sed -n '110,135p' "app/(admin)/admin/utilisateurs/_components/users-table.tsx"
```

- [ ] **Étape 2 : Remplacer le spinner par le grisage**

Supprimer la branche qui remplace la table par un spinner centré (autour de la ligne 123, celle qui rend `<LoaderCircle className="mx-auto h-8 w-8 animate-spin text-gray-400" />`), et envelopper le rendu de la table dans `PendingRegion` :

```tsx
return (
  <PendingRegion isPending={isLoading}>
    {/* … le JSX existant de la table, inchangé … */}
  </PendingRegion>
)
```

Ajouter l'import :

```tsx
import { PendingRegion } from "@/components/ui/pending-region"
```

Supprimer l'import `LoaderCircle` s'il n'est plus utilisé dans le fichier.

- [ ] **Étape 3 : Vérifier**

```bash
grep -n "animate-spin\|LoaderCircle" "app/(admin)/admin/utilisateurs/_components/users-table.tsx"
```

Attendu : **aucune sortie**.

- [ ] **Étape 4 : Lancer la barrière**

```bash
bun run check
```

Attendu : exit 0.

## Tâche 4.2 : La table des transactions signale son rechargement

**Fichiers :**

- Modifier : `components/shared/payments/transaction-table.tsx`
- Test : `tests/components/payments/TransactionTable.test.tsx`

- [ ] **Étape 1 : Écrire le test qui échoue**

Ajouter dans `tests/components/payments/TransactionTable.test.tsx`, à l'intérieur du `describe` existant :

```tsx
it("garde les lignes affichées et marque la zone occupée pendant un rechargement", () => {
  const { container } = render(
    <TransactionTable transactions={[baseTransaction]} isLoading />,
  )
  // Le contenu reste : pas de squelette qui remplace une liste non vide.
  expect(screen.getByText(baseTransaction.userName)).toBeInTheDocument()
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
})
```

> `baseTransaction` : réutiliser la fixture déjà définie en tête du fichier de test. Si elle porte un autre nom, l'utiliser tel quel et adapter l'assertion sur le libellé affiché.

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bun run test tests/components/payments/TransactionTable.test.tsx
```

Attendu : ÉCHEC — aucun élément `aria-busy="true"`.

- [ ] **Étape 3 : Replier la `TableSkeleton` locale et ajouter le grisage**

Dans `components/shared/payments/transaction-table.tsx` :

1. Remplacer le corps de la `TableSkeleton` locale (définie autour de la ligne 180) par un appel à la primitive partagée :

```tsx
const TableSkeleton = ({
  rows,
  showUserColumn,
}: {
  rows: number
  showUserColumn: boolean
}) => <SkeletonTable columns={showUserColumn ? 6 : 5} rows={rows} />
```

2. Envelopper le rendu principal (le `return` final du composant) dans `PendingRegion` :

```tsx
return (
  <PendingRegion isPending={isLoading}>
    {/* … le JSX existant, inchangé … */}
  </PendingRegion>
)
```

3. Ajouter les imports :

```tsx
import { PendingRegion } from "@/components/ui/pending-region"
import { SkeletonTable } from "@/components/ui/skeleton-patterns"
```

La branche `if (isLoading && transactions.length === 0)` (ligne 220) est **conservée** : afficher un squelette quand il n'y a rien à conserver est conforme à la doctrine.

- [ ] **Étape 4 : Lancer le test pour vérifier qu'il passe**

```bash
bun run test tests/components/payments/TransactionTable.test.tsx
```

Attendu : PASS.

- [ ] **Étape 5 : Commit**

```bash
git add "app/(admin)/admin/utilisateurs/_components/users-table.tsx" components/shared/payments/transaction-table.tsx tests/components/payments/TransactionTable.test.tsx
git commit -m "feat(ui): conserver le contenu pendant les rechargements en place"
```

## Tâche 4.3 : Supprimer le spinner mort de l'historique d'entraînement

**Fichiers :**

- Modifier : `app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx`

- [ ] **Étape 1 : Confirmer que la branche est morte**

```bash
sed -n '66,70p' "app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx"
```

Attendu : la ligne `const isLoading = false`.

- [ ] **Étape 2 : Supprimer la variable et sa branche**

1. Supprimer la ligne `const isLoading = false` (ligne 68).
2. Supprimer la branche de rendu `{isLoading ? (…) : (…)}` autour de la ligne 137, en **conservant uniquement le contenu de la branche `else`** (le rendu réel de la liste).

Le `isLoadingMore` du bouton « voir plus » (ligne 268) est **conservé** : c'est une attente sur action utilisateur, conforme à la doctrine. Il passera au `Spinner` commun en Phase 5.

- [ ] **Étape 3 : Vérifier**

```bash
grep -n "isLoading\b" "app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx"
```

Attendu : **aucune sortie** (seul `isLoadingMore` subsiste, qui ne matche pas `isLoading\b`).

## Tâche 4.4 : Replier le squelette du navigateur de questions

**Fichiers :**

- Modifier : `components/admin/question-browser/question-browser-table.tsx`

Ce composant est **conforme à la doctrine** (squelette au premier chargement uniquement, `isLoading = !hasLoaded`) : on ne change pas son comportement, seulement son implémentation, qui duplique `SkeletonTable`.

- [ ] **Étape 1 : Remplacer la `TableSkeleton` locale**

Remplacer intégralement la fonction locale (lignes 35-56, de `function TableSkeleton() {` jusqu'à sa `}` fermante) par :

```tsx
function TableSkeleton() {
  return <SkeletonTable columns={7} rows={8} />
}
```

- [ ] **Étape 2 : Ajuster les imports**

Ajouter :

```tsx
import { SkeletonTable } from "@/components/ui/skeleton-patterns"
```

Supprimer l'import `Skeleton` (ligne 15) **s'il n'est plus utilisé ailleurs dans le fichier** :

```bash
grep -n "<Skeleton" components/admin/question-browser/question-browser-table.tsx
```

Si la sortie est vide, retirer la ligne d'import — sinon `bun run lint` échoue en `--max-warnings 0`.

- [ ] **Étape 3 : Lancer la barrière**

```bash
bun run check
```

Attendu : exit 0.

- [ ] **Étape 4 : Commit**

```bash
git add components/admin/question-browser/question-browser-table.tsx "app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx"
git commit -m "refactor(admin): replier les squelettes de table sur la primitive partagée"
```

## Tâche 4.5 : Le squelette n'est plus un état terminal

**Fichiers :**

- Modifier : `app/(dashboard)/tableau-de-bord/page.tsx`
- Créer : `app/(dashboard)/tableau-de-bord/_components/dashboard-error-state.tsx`

- [ ] **Étape 1 : Créer l'état d'erreur**

Créer `app/(dashboard)/tableau-de-bord/_components/dashboard-error-state.tsx` :

```tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Rendu quand les statistiques sont introuvables. Remplace un squelette qui
 * pulsait indéfiniment : un squelette n'est jamais un état terminal.
 */
export const DashboardErrorState = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
      Impossible de charger vos statistiques
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Une erreur est survenue pendant la récupération de vos données.
    </p>
    <Button asChild>
      <Link href="/tableau-de-bord">Réessayer</Link>
    </Button>
  </div>
)
```

- [ ] **Étape 2 : Brancher l'état d'erreur**

Dans `app/(dashboard)/tableau-de-bord/page.tsx`, remplacer :

```tsx
// Le layout dashboard garde déjà la session ; `stats` n'est null que sans
// session (cas limite) — on retombe alors sur le squelette.
if (!stats) return <DashboardSkeleton />
```

par :

```tsx
// Le layout dashboard garde déjà la session ; `stats` n'est null que sans
// session (cas limite) — état terminal explicite, jamais un squelette.
if (!stats) return <DashboardErrorState />
```

Remplacer l'import de `DashboardSkeleton` par celui de `DashboardErrorState` (le squelette reste importé par `loading.tsx`, pas par la page).

- [ ] **Étape 3 : Lancer la barrière et les tests**

```bash
bun run check && bun run test
```

Attendu : exit 0.

- [ ] **Étape 4 : Commit**

```bash
git add "app/(dashboard)/tableau-de-bord"
git commit -m "fix(dashboard): état d'erreur explicite au lieu d'un squelette permanent"
```

---

# Phase 5 — Substitution des spinners et garde-fous

## Tâche 5.1 : Substituer les ~30 spinners

**Fichiers :** voir la liste ci-dessous.

- [ ] **Étape 1 : Établir la liste de travail**

```bash
grep -rln "animate-spin" app/ components/ | grep -v "components/ui/spinner.tsx" | sort
```

Attendu : la liste des fichiers restants (≈25 après les phases 2 à 4).

- [ ] **Étape 2 : Substituer, fichier par fichier**

Pour chaque fichier, appliquer la transformation correspondant à sa forme actuelle :

| Forme actuelle                                                                                | Remplacement                                    |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />`                                      | `<Spinner size="sm" className="mr-2" />`        |
| `<LoaderCircle className="h-4 w-4 animate-spin" />`                                           | `<Spinner size="sm" />`                         |
| `<LoaderCircle className="h-5 w-5 animate-spin" />`                                           | `<Spinner />`                                   |
| `<LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />`                             | `<Spinner className="text-muted-foreground" />` |
| `<LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />`                             | `<Spinner size="lg" />`                         |
| `<Loader2 className="h-4 w-4 animate-spin" />`                                                | `<Spinner size="sm" />`                         |
| `<div className="… animate-spin rounded-full border-b-2 border-blue-600" />`                  | `<Spinner size="lg" />`                         |
| `<div className="… animate-spin rounded-full border-2 border-white border-t-transparent" />`  | `<Spinner size="sm" className="text-white" />`  |
| `<span className="… animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />` | `<Spinner size="sm" />`                         |

Règles :

- ajouter `import { Spinner } from "@/components/ui/spinner"` ;
- **supprimer** l'import `LoaderCircle` / `Loader2` s'il devient inutilisé (sinon `bun run lint` échoue en `--max-warnings 0`) ;
- ne **jamais** forcer une couleur autre que `text-white` sur fond coloré : `currentColor` fait le travail ;
- si le spinner était accompagné d'un texte visible (« Chargement… », « Enregistrement… »), **conserver le texte** et ajouter `label` au `Spinner` seulement s'il n'y a aucun texte visible à côté.

- [ ] **Étape 3 : Traiter les deux écrans plein cadre du quiz public**

Dans `app/(marketing)/evaluation/quiz/page.tsx` :

1. Le bloc « Chargement des questions… » (ligne 179-190) devient :

```tsx
if (!quizBundle) {
  return <EvaluationSkeleton />
}
```

avec `import { EvaluationSkeleton } from "../_components/evaluation-skeleton"`.

2. Le bloc « Calcul du score… » (ligne 222-233) **reste un écran dédié** (transition attendue après un clic explicite) ; seul son spinner change :

```tsx
<div className="mx-auto mb-4 flex justify-center">
  <Spinner size="lg" />
</div>
```

- [ ] **Étape 3 bis : Convertir l'écran d'attente de la page évaluation d'examen**

Dans `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx`, le bloc de la ligne 346 est un écran `min-h-screen` centré affiché pendant le démarrage de l'examen. Le spec le veut en squelette : c'est une attente de contenu, pas une action.

Remplacer le bloc :

```tsx
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        <div className="text-muted-foreground flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
```

par un squelette de carte d'examen :

```tsx
<output
  aria-label="Préparation de l'examen"
  className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6"
>
  <Skeleton className="h-8 w-2/3" />
  <SkeletonText lines={3} />
  <SkeletonCard />
</output>
```

en supprimant le texte et le `</div>` de fermeture correspondants, et en ajoutant les imports :

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard, SkeletonText } from "@/components/ui/skeleton-patterns"
```

Le bouton « Démarrer » (ligne 326, `isStarting`) garde son spinner : c'est bien une action utilisateur. Il passe au `<Spinner size="sm" />` comme les autres.

**Ne toucher à aucune autre ligne de ce fichier** : chronomètre, budget-temps anti-triche et invariants d'accès sont hors périmètre (`.claude/rules/data-layer.md`).

- [ ] **Étape 4 : Vérifier qu'aucun spinner ne subsiste hors du socle**

```bash
grep -rn "animate-spin" app/ components/ | grep -v "components/ui/spinner.tsx"
```

Attendu : **aucune sortie**.

- [ ] **Étape 5 : Lancer la barrière et les tests**

```bash
bun run check && bun run test
```

Attendu : exit 0. Les tests qui ciblaient un `LoaderCircle` par sélecteur CSS doivent basculer sur `getByRole("status")`.

- [ ] **Étape 6 : Commit**

```bash
git add app components
git commit -m "refactor(ui): unifier tous les spinners sur le composant Spinner"
```

## Tâche 5.2 : Le test d'architecture

**Fichiers :**

- Créer : `tests/architecture/loading-conventions.test.ts`

- [ ] **Étape 1 : Écrire le test**

Créer `tests/architecture/loading-conventions.test.ts` :

```ts
import fg from "fast-glob"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const SOCLE = "components/ui/spinner.tsx"

describe("conventions de chargement", () => {
  it("n'autorise `animate-spin` que dans le composant Spinner", async () => {
    const files = await fg(["app/**/*.tsx", "components/**/*.tsx"], {
      cwd: ROOT,
      ignore: [`${SOCLE}`],
    })

    const offenders = files.filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes("animate-spin"),
    )

    expect(
      offenders,
      `Utiliser <Spinner> (${SOCLE}) au lieu d'une animation faite main. Voir .claude/rules/loading-ui.md`,
    ).toEqual([])
  })

  it("n'autorise aucun squelette dans un loading.tsx sans rôle d'annonce", async () => {
    const files = await fg(["app/**/loading.tsx"], { cwd: ROOT })
    expect(files.length).toBeGreaterThan(0)

    const silent = files.filter((file) => {
      const source = readFileSync(join(ROOT, file), "utf8")
      // Chaque loading.tsx monte un squelette du socle ; ceux-ci portent tous
      // un rôle d'annonce (<output>). Un loading.tsx qui rend du JSX brut y
      // échapperait.
      return !/Skeleton|PageSkeleton/.test(source)
    })

    expect(
      silent,
      "Chaque loading.tsx doit monter un squelette du socle. Voir .claude/rules/loading-ui.md",
    ).toEqual([])
  })
})
```

- [ ] **Étape 2 : Vérifier que `fast-glob` est disponible**

```bash
grep -n "fast-glob" package.json || bun add -d fast-glob
```

Si le paquet n'est pas présent, l'ajouter en dépendance de développement.

- [ ] **Étape 3 : Lancer le test**

```bash
bun run test tests/architecture/loading-conventions.test.ts
```

Attendu : PASS, 2 tests. S'il échoue, c'est qu'un fichier de la Tâche 5.1 a été oublié — le corriger plutôt que d'assouplir le test.

- [ ] **Étape 4 : Commit**

```bash
git add tests/architecture/loading-conventions.test.ts package.json bun.lock
git commit -m "test(archi): verrouiller l'usage unique du composant Spinner"
```

## Tâche 5.3 : La règle de projet

**Fichiers :**

- Créer : `.claude/rules/loading-ui.md`
- Modifier : `AGENTS.md`

- [ ] **Étape 1 : Écrire la règle**

Créer `.claude/rules/loading-ui.md` :

```markdown
---
paths:
  - "app/**"
  - "components/**"
---

# États de chargement

Un indicateur par **type d'attente**. Cette table fait foi ; toute exception se
justifie dans le code.

| Type d'attente                                  | Indicateur                                                      | Jamais             |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------ |
| **Navigation** (le contenu n'existe pas encore) | Squelette à la forme du contenu (`loading.tsx` ou `<Suspense>`) | Spinner, overlay   |
| **Rechargement en place** (filtre, tri, page)   | `<PendingRegion isPending>` — contenu conservé, grisé           | Squelette, spinner |
| **Action utilisateur** (bouton, form, upload)   | `<Spinner size="sm">` DANS le déclencheur + `disabled`          | Écran d'attente    |
| **Attente sur un tiers** (Stripe)               | Écran dédié plein cadre, texte explicite                        | —                  |

## Invariants

- **Aucun `fixed inset-0` pour un chargement.** Un chargement ne bloque que sa
  propre zone. (Les `fixed inset-0` de `components/ui/{dialog,sheet,alert-dialog}.tsx`
  et l'overlay anti-triche de `components/quiz/pause-dialog.tsx` sont légitimes :
  ce ne sont pas des chargements.)
- **Un squelette n'est jamais un état terminal.** Absence de données = message
  explicite + recours.
- **Un seul spinner** : `components/ui/spinner.tsx`. Aucune animation faite main —
  verrouillé par `tests/architecture/loading-conventions.test.ts`.
- **Pas d'état de chargement pour la session.** Les layouts `(dashboard)`/`(admin)`
  gardent déjà la zone côté serveur et font descendre l'utilisateur en props :
  ne jamais réintroduire un `authClient.useSession()` dans le shell (c'était la
  cause de l'overlay plein écran supprimé le 2026-07-28).

## Socle

`components/ui/spinner.tsx` · `components/ui/skeleton.tsx` ·
`components/ui/skeleton-patterns.tsx` (`SkeletonText`, `SkeletonCard`,
`SkeletonStatRow`, `SkeletonTable`, `PageSkeleton`) ·
`components/ui/pending-region.tsx` · `components/admin/admin-list-skeleton.tsx`.

## `loading.tsx` — pas d'héritage implicite

Next fait remonter le `loading.tsx` du parent sur un segment enfant qui n'a pas
le sien : le résultat est un squelette **de la mauvaise forme**. Chaque segment
feuille déclare donc le sien — `PageSkeleton` par défaut, un squelette dédié
quand la forme le justifie. À l'ajout d'une route, ajouter son `loading.tsx`.

## Couverture

Les squelettes sont du balisage sans logique : les ajouter à `coverage.exclude`
de `vitest.config.ts` (comme `components/admin/dashboard/skeleton.tsx`) plutôt
que d'écrire des tests vides. `components/ui/**` est déjà exclu.
```

- [ ] **Étape 2 : Référencer la règle**

Dans `AGENTS.md`, dans la table _Instruction Routing_, ajouter une ligne après celle de `data-layer.md` :

```markdown
| `loading-ui.md` | `app/**`, `components/**` | Doctrine des états de chargement, socle Spinner/Skeleton, `loading.tsx` par segment |
```

- [ ] **Étape 3 : Lancer la barrière complète**

```bash
bun run check && bun run test
```

Attendu : exit 0 pour les deux.

- [ ] **Étape 4 : Commit**

```bash
git add .claude/rules/loading-ui.md AGENTS.md
git commit -m "docs: ajouter la règle de projet sur les états de chargement"
```

## Tâche 5.4 : Le test e2e de non-régression

**Fichiers :**

- Modifier : `e2e/tests/dashboard.spec.ts`
- Modifier : `e2e/pages/dashboard.page.ts`

> On ajoute au spec **existant** plutôt que d'en créer un nouveau : tout nouveau
> fichier devrait être enregistré dans un `testMatch` de `playwright.config.ts`
> (voir `.claude/rules/e2e-testing.md`), et `dashboard.spec.ts` est déjà dans le
> projet `chromium-auth`.

- [ ] **Étape 1 : Ajouter l'assertion au POM**

Dans `e2e/pages/dashboard.page.ts`, ajouter une méthode à la classe :

```ts
  /**
   * Non-régression de l'overlay plein écran supprimé le 2026-07-28 : le shell
   * doit être visible et interactif immédiatement, sans écran bloquant.
   */
  async expectNoBlockingOverlay() {
    await expect(this.page.locator('[data-sidebar="content"]')).toBeVisible({
      timeout: 5_000,
    })
    await expect(this.page.getByText("Vérification des permissions")).toHaveCount(
      0,
    )
    await expect(this.page.getByText("Connexion en cours")).toHaveCount(0)
  }
```

- [ ] **Étape 2 : Ajouter le test**

Dans `e2e/tests/dashboard.spec.ts`, ajouter dans le `describe` existant :

```ts
test("affiche le shell immédiatement, sans overlay de chargement", async ({
  page,
}) => {
  const dashboard = new DashboardPage(page)
  await dashboard.goto()
  await dashboard.expectNoBlockingOverlay()
  await dashboard.waitForReady()
})
```

- [ ] **Étape 3 : Lancer le test e2e**

```bash
bun run test:e2e e2e/tests/dashboard.spec.ts --reporter=list
```

Attendu : PASS. **Ne pas** lancer `bunx playwright test` (flaky sous Bun) ni démarrer `bun dev` en parallèle — Playwright démarre son propre serveur.

- [ ] **Étape 4 : Barrière e2e**

```bash
bun run type-check && bun run lint
bunx prettier --write e2e/tests/dashboard.spec.ts e2e/pages/dashboard.page.ts
```

Attendu : exit 0. (Pour `e2e/**`, la règle projet impose `type-check` + `lint` plutôt que `bun run check`.)

- [ ] **Étape 5 : Commit**

```bash
git add e2e/tests/dashboard.spec.ts e2e/pages/dashboard.page.ts
git commit -m "test(e2e): vérifier l'absence d'overlay bloquant au dashboard"
```

---

# Phase 6 — Streaming interne des tableaux de bord (détachable)

**Cette phase est la seule qui puisse être coupée sans abîmer le reste.** Les squelettes des phases 1 à 5 apportent déjà l'essentiel du gain perçu ; le streaming interne ajoute l'apparition progressive une fois le shell rendu. Si le diff paraît risqué à l'exécution, livrer les phases 1 à 5 et ouvrir un ticket — ce n'est pas un échec.

**Pourquoi c'est délicat :** `DashboardClient` (10 props) et `AdminDashboardClient` (8 props) reçoivent toutes leurs données en props. On ne les découpe **pas** : on isole uniquement les deux requêtes les plus lentes de chaque page — les séries d'historique qui alimentent les graphiques — en passant des **promesses** que les composants de graphique déballent avec `use()` de React 19.

## Tâche 6.1 : Streamer les historiques du tableau de bord étudiant

**Fichiers :**

- Modifier : `app/(dashboard)/tableau-de-bord/page.tsx`
- Modifier : `app/(dashboard)/tableau-de-bord/_components/dashboard-client.tsx`
- Modifier : `app/(dashboard)/tableau-de-bord/_components/{score-evolution-chart,training-score-chart}.tsx`

- [ ] **Étape 1 : Sortir les deux historiques du `Promise.all`**

Dans `app/(dashboard)/tableau-de-bord/page.tsx`, remplacer le bloc `Promise.all` par :

```tsx
const [stats, availableExams, recentExams, accessStatus, trainingStats] =
  await Promise.all([
    getMyDashboardStats(),
    getMyAvailableExams(),
    getMyRecentExams(),
    getAccessStatus(),
    getTrainingStats(),
  ])

// Les deux historiques alimentent les graphiques et sont les requêtes les plus
// lentes de la page. On les passe NON attendues : les KPI (agrégats rapides)
// s'affichent sans les attendre, les graphiques streament derrière leur
// Suspense. Ne pas remettre ces deux appels dans le Promise.all.
const scoreHistoryPromise = getMyScoreHistory()
const trainingScoreHistoryPromise = getMyTrainingScoreHistory()
```

Puis, dans le JSX de retour, remplacer les deux props :

```tsx
scoreHistory = { scoreHistory }
trainingScoreHistory = { trainingScoreHistory }
```

par :

```tsx
scoreHistoryPromise = { scoreHistoryPromise }
trainingScoreHistoryPromise = { trainingScoreHistoryPromise }
```

- [ ] **Étape 2 : Changer le type des deux props du client**

Dans `dashboard-client.tsx`, dans `DashboardClientProps`, remplacer :

```tsx
  scoreHistory: MyScoreHistoryItem[]
  trainingScoreHistory: TrainingScoreHistory
```

par :

```tsx
scoreHistoryPromise: Promise<MyScoreHistoryItem[]>
trainingScoreHistoryPromise: Promise<TrainingScoreHistory>
```

Renommer les deux entrées correspondantes dans la déstructuration des props, puis envelopper chaque graphique dans son propre `<Suspense>` là où il est monté :

```tsx
<Suspense fallback={<SkeletonCard className="h-80" />}>
  <ScoreEvolutionChart dataPromise={scoreHistoryPromise} />
</Suspense>
```

```tsx
<Suspense fallback={<SkeletonCard className="h-80" />}>
  <TrainingScoreChart dataPromise={trainingScoreHistoryPromise} />
</Suspense>
```

Imports à ajouter :

```tsx
import { Suspense } from "react"
import { SkeletonCard } from "@/components/ui/skeleton-patterns"
```

- [ ] **Étape 3 : Déballer la promesse dans chaque graphique**

Dans `score-evolution-chart.tsx`, remplacer la prop de données par une promesse et la déballer en tête de composant :

```tsx
import { use } from "react"

// … dans la signature du composant :
export const ScoreEvolutionChart = ({
  dataPromise,
}: {
  dataPromise: Promise<MyScoreHistoryItem[]>
}) => {
  const data = use(dataPromise)
  // … le reste du composant, inchangé, continue d'utiliser `data`
```

Appliquer la transformation identique à `training-score-chart.tsx` avec le type `TrainingScoreHistory`.

> Si le composant nommait déjà sa prop autrement que `data`, garder son nom local : `const <nomExistant> = use(dataPromise)`. Aucune autre ligne ne change.

- [ ] **Étape 4 : Lancer la barrière et les tests**

```bash
bun run check && bun run test
```

Attendu : exit 0. Les tests des deux graphiques passent aujourd'hui un tableau : les adapter en `dataPromise={Promise.resolve([...])}` et envelopper le rendu d'un `<Suspense>` dans le test.

- [ ] **Étape 5 : Vérifier visuellement**

Demander à l'utilisateur de lancer `bun dev`, puis ouvrir `/tableau-de-bord` : les cartes KPI doivent apparaître **avant** les deux graphiques. Ne pas lancer le serveur soi-même.

- [ ] **Étape 6 : Commit**

```bash
git add "app/(dashboard)/tableau-de-bord"
git commit -m "perf(dashboard): streamer les historiques de scores derrière Suspense"
```

## Tâche 6.2 : Streamer les graphiques du tableau de bord admin

**Fichiers :**

- Modifier : `app/(admin)/admin/page.tsx`
- Modifier : `app/(admin)/admin/_components/admin-dashboard-client.tsx`
- Modifier : `components/admin/dashboard/{revenue-chart,domain-chart}.tsx`

- [ ] **Étape 1 : Appliquer la recette de la tâche 6.1**

Même transformation, avec ces correspondances :

| Requête sortie du `Promise.all` | Prop promesse          | Graphique consommateur                         |
| ------------------------------- | ---------------------- | ---------------------------------------------- |
| `getRevenueByDay()`             | `revenueByDayPromise`  | `components/admin/dashboard/revenue-chart.tsx` |
| `getQuestionStats()`            | `questionStatsPromise` | `components/admin/dashboard/domain-chart.tsx`  |

Les six autres requêtes de `app/(admin)/admin/page.tsx` restent dans le `Promise.all` : elles alimentent les cartes KPI, qui doivent s'afficher en premier.

> `getRevenueByDay` bucketise par **jour UTC** (`.claude/rules/data-layer.md`) : c'est une incohérence pré-existante avec l'heure de Toronto affichée ailleurs. **Ne pas la « corriger » ici** — hors périmètre.

- [ ] **Étape 2 : Lancer la barrière et les tests**

```bash
bun run check && bun run test
```

Attendu : exit 0.

- [ ] **Étape 3 : Commit**

```bash
git add "app/(admin)/admin" components/admin/dashboard
git commit -m "perf(admin): streamer les graphiques du tableau de bord derrière Suspense"
```

---

## Vérification finale

- [ ] **Étape 1 : Barrière complète**

```bash
bun run check && bun run test && bun run test:coverage
```

Attendu : exit 0, couverture ≥ 80 % sur les quatre métriques.

- [ ] **Étape 2 : Suite e2e complète**

```bash
bun run test:e2e --reporter=list
```

Attendu : PASS. En cas d'échec sur un spec non touché, vérifier d'abord `e2e/.auth/` (supprimer et relancer).

- [ ] **Étape 3 : Inventaire final**

```bash
grep -rn "animate-spin" app/ components/ | grep -v "components/ui/spinner.tsx"
grep -rn "fixed inset-0 z-50" components/shared/
find app -name "page.tsx" | sed 's|/page.tsx||' | while read -r d; do
  [ -f "$d/loading.tsx" ] || echo "sans loading.tsx: $d"
done
```

Attendu : aucune sortie pour les deux premiers. Le troisième ne doit lister que des routes **statiques** (`(marketing)` hors `evaluation`, `(auth)`, `compte-supprime`), jamais une route authentifiée.

- [ ] **Étape 4 : Revue adversariale sur le diff + parcours navigateur**

Générer le prompt de revue avec `/adversarial-review-prompt` (cible : implémentation, portée `main...HEAD`) et le rejouer en session fraîche, puis valider visuellement le parcours avec `/e2e-scenario`.
