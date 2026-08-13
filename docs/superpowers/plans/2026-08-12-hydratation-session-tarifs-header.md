# Hydratation : supprimer le branchement de rendu sur la session cliente — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer les deux endroits où le rendu dépend de `authClient.useSession()` alors que le composant est rendu côté serveur en premier — cause de `NOMAQBANQ-5` / `NOMAQBANQ-1E` sur `/tarifs`.

**Architecture:** Sur `/tarifs` (page dynamique), l'authentification descend du Server Component en prop explicite. Sur le header marketing (présent sur des pages ISR, où lire les cookies casserait la génération statique), la session reste cliente mais ne peut plus décider pendant le rendu d'hydratation : une garde `mounted` bâtie sur `useSyncExternalStore` avec un `getServerSnapshot` constant.

**Tech Stack:** Next.js 16 (App Router), React 19, Better Auth, Vitest + happy-dom + Testing Library.

**Spec :** `docs/superpowers/specs/2026-08-12-hydratation-session-tarifs-header-design.md`

**Branche :** `fix/hydratation-session-tarifs-header` (déjà créée, contient le commit de la spec).

---

## Pourquoi c'est un vrai bug (à garder en tête pendant l'exécution)

La session Better Auth n'est **jamais** pré-remplie au premier rendu client :
`session-atom.mjs:29-35` naît à `{ data: null, isPending: true }` et seul
`onMount` → `setTimeout(…, 0)` → aller-retour réseau la peuple. Elle n'arrive
donc pas AVANT l'hydratation — elle arrive **PENDANT**, quand l'hydratation dure
assez longtemps. Sur l'appareil de l'incident (Android 10 d'entrée de gamme,
~25 scripts dont un de 560 Ko), le replay montre le DOM servi en branche
déconnectée à −826 ms, l'erreur à 0, et la régénération à +246 ms avec les
initiales d'avatar et le bandeau d'accès. Le store a changé entre deux frames
d'hydratation.

C'est pour ça que le défaut ne se reproduit sur aucune machine de développement :
le levier n'est pas l'état de la session, c'est la **durée de l'hydratation**.

**Deux corollaires pour les tests.**

1. Un `render()` de Testing Library est un rendu client déjà monté : il ne
   traverse jamais la fenêtre d'hydratation. Il ne peut rien prouver ici.
2. Un test qui rend avec un mock figé ne prouve rien non plus — c'est le défaut
   de la première version de ce plan, relevé en revue. Le seul test qui exerce
   l'invariant fait **changer la session entre la génération du HTML serveur et
   l'hydratation**, puis vérifie que React n'a rien à récupérer. C'est ce que
   fait la tâche 4.

## Structure des fichiers

| Fichier | Rôle | Action |
| --- | --- | --- |
| `app/(marketing)/tarifs/page.tsx` | Server Component : résout la session et la descend | Modifier |
| `app/(marketing)/tarifs/_components/tarifs-page-client.tsx` | Relais de props | Modifier |
| `app/(marketing)/tarifs/_components/pricing-grid.tsx` | Consommateur fautif n°1 | Modifier |
| `hooks/use-mounted.ts` | Garde d'hydratation partagée | Créer |
| `components/shared/theme-toggle.tsx` | Adopte le hook partagé (dédup) | Modifier |
| `components/marketing-header/index.tsx` | Consommateur fautif n°2 | Modifier |
| `tests/helpers/motion-mock.tsx` | Ajouter `motion.header` | Modifier |
| `tests/components/payments/PricingGrid.test.tsx` | Tests tâche 1 | Créer |
| `tests/hooks/useMounted.test.tsx` | Tests tâche 2 | Créer |
| `tests/components/MarketingHeader.test.tsx` | Tests tâche 4 | Créer |
| `.claude/rules/loading-ui.md` | Généraliser la règle | Modifier |

`components/marketing-header/mobile-menu.tsx` **ne change pas** : il reçoit déjà `currentUser` et `isAuthenticated` en props depuis le header, la garde posée dans le header le couvre.

---

## Task 1 : `PricingGrid` — descendre `isAuthenticated` depuis le serveur

**Files:**
- Modify: `app/(marketing)/tarifs/page.tsx`
- Modify: `app/(marketing)/tarifs/_components/tarifs-page-client.tsx`
- Modify: `app/(marketing)/tarifs/_components/pricing-grid.tsx:27-64,120`
- Test: `tests/components/payments/PricingGrid.test.tsx` (créer)

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/components/payments/PricingGrid.test.tsx`.

Point clé : ce fichier **ne mocke PAS `@/hooks/useCurrentUser`**. C'est délibéré — c'est ce qui rend le test discriminant. Tant que le composant lit la session cliente, aucune session n'est résolue dans happy-dom et le bandeau ne se rend pas.

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PricingGrid } from "@/app/(marketing)/tarifs/_components/pricing-grid"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

const createStripeCheckout = vi.fn()
vi.mock("@/features/payments/actions", () => ({
  createStripeCheckout: (...args: unknown[]) => createStripeCheckout(...args),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("@/lib/format", () => ({
  formatCurrency: (amount: number) => `${(amount / 100).toFixed(0)} $`,
  formatExpiration: (ts: number) => `exp-${ts}`,
}))

const products = [
  {
    id: "prod_1",
    code: "exam_access" as const,
    name: "Accès Examens 30 jours",
    description: "Accès complet aux examens simulés",
    priceCAD: 5000,
    durationDays: 30,
    accessType: "exam" as const,
    isCombo: false,
    stripeProductId: "prod_test",
    stripePriceId: "price_test",
  },
]

const accessStatus = {
  examAccess: { expiresAt: 1_800_000_000_000, daysRemaining: 12 },
  trainingAccess: null,
}

describe("PricingGrid", () => {
  beforeEach(() => {
    createStripeCheckout.mockResolvedValue({ checkoutUrl: "https://stripe.test/x" })
  })

  it("rend le bandeau d'accès à partir de la prop serveur, sans session cliente", () => {
    render(
      <PricingGrid
        products={products}
        accessStatus={accessStatus}
        isAuthenticated
      />,
    )

    expect(screen.getByText("Vos accès actuels")).toBeInTheDocument()
  })

  it("n'affiche pas le bandeau pour un visiteur non authentifié", () => {
    render(
      <PricingGrid
        products={products}
        accessStatus={null}
        isAuthenticated={false}
      />,
    )

    expect(screen.queryByText("Vos accès actuels")).not.toBeInTheDocument()
  })

  it("redirige vers l'inscription quand le visiteur n'est pas authentifié", async () => {
    render(
      <PricingGrid
        products={products}
        accessStatus={null}
        isAuthenticated={false}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Acheter maintenant/ }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/inscription"))
    expect(createStripeCheckout).not.toHaveBeenCalled()
  })

  it("ouvre le checkout Stripe dès le premier clic d'un visiteur authentifié", async () => {
    render(
      <PricingGrid
        products={products}
        accessStatus={{ examAccess: null, trainingAccess: null }}
        isAuthenticated
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Acheter maintenant/ }))

    await waitFor(() =>
      expect(createStripeCheckout).toHaveBeenCalledWith({
        productCode: "exam_access",
        successPath: "/tableau-de-bord/paiement/succes",
        cancelPath: "/tarifs",
      }),
    )
    expect(push).not.toHaveBeenCalled()
  })
})
```

> Le libellé « Acheter maintenant » vient de `components/shared/payments/pricing-card.tsx:285`. Il bascule en « Prolonger l'accès » quand la carte a un `currentAccess` — les deux tests de clic passent un accès nul pour ce type, le libellé reste donc « Acheter maintenant ».

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bunx vitest run --project frontend tests/components/payments/PricingGrid.test.tsx
```

Attendu : ÉCHEC. `PricingGrid` n'accepte pas encore la prop `isAuthenticated` (erreur TypeScript / prop ignorée), le bandeau ne se rend pas et le clic ne déclenche rien (le `if (isAuthLoading) return` sort tôt, `isPending` valant `true` sans session résolue).

- [ ] **Step 3 : Modifier `pricing-grid.tsx`**

Retirer l'import du hook :

```diff
-import { useCurrentUser } from "@/hooks/useCurrentUser"
```

Étendre les props :

```diff
 interface PricingGridProps {
   products: ProductView[]
   accessStatus: AccessStatus | null
+  isAuthenticated: boolean
 }

-export const PricingGrid = ({ products, accessStatus }: PricingGridProps) => {
+export const PricingGrid = ({
+  products,
+  accessStatus,
+  isAuthenticated,
+}: PricingGridProps) => {
   const [filter, setFilter] = useState<AccessFilter>("all")
   const [loadingProduct, setLoadingProduct] = useState<string | null>(null)
   const router = useRouter()
-
-  const { isAuthenticated, isLoading: isAuthLoading } = useCurrentUser()
```

Simplifier `handlePurchase` :

```diff
   const handlePurchase = async (productCode: string) => {
-    // Attendre que l'état d'authentification soit déterminé.
-    if (isAuthLoading) return
-
     if (!isAuthenticated) {
       router.push("/inscription")
       return
     }
```

Le reste du composant (bandeau ligne 120, grille, onglets) est inchangé : `isAuthenticated` est désormais une prop.

> **Conséquence assumée, relevée en revue.** La prop est figée au rendu serveur, alors que le header continue de suivre la session en direct (Better Auth rafraîchit au focus de l'onglet et entre onglets). Un utilisateur dont la session expire pendant qu'il lit la page verra donc un header repassé en « Connexion » tandis que la grille le croit toujours authentifié. Un clic « Acheter » dans cet état atteint `createStripeCheckout`, dont le garde `requireSession()` (`lib/auth-guards.ts:6-10`) redirige vers `/connexion` — comportement correct, et strictement meilleur que l'actuel, où le même clic ne produit **rien**. On ne rajoute pas de synchronisation client pour ça : ce serait réintroduire la dépendance qu'on est en train de retirer.

- [ ] **Step 4 : Câbler la prop depuis le Server Component**

`app/(marketing)/tarifs/page.tsx` :

```diff
 import { Metadata } from "next"
 import { getMarketingStats } from "@/features/marketing/dal"
 import { getAccessStatus, getAvailableProducts } from "@/features/payments/dal"
+import { getCurrentSession } from "@/lib/dal"
 import TarifsPageClient from "./_components/tarifs-page-client"
```

```diff
 export default async function TarifsPage() {
-  // Produits publics + accès courant (null si visiteur non connecté) + stats.
-  // Page dynamique (session via getAccessStatus) : pas d'ISR ici.
-  const [products, accessStatus, stats] = await Promise.all([
+  // Produits publics + accès courant (null si visiteur non connecté) + stats.
+  // Page dynamique (session via getAccessStatus) : pas d'ISR ici.
+  // `isAuthenticated` descend en prop plutôt que d'être lu côté client : la
+  // session n'est pas résolue au SSR, un rendu qui en dépend produit deux
+  // arbres DOM différents à l'hydratation.
+  const [products, accessStatus, stats, session] = await Promise.all([
     getAvailableProducts(),
     getAccessStatus(),
     getMarketingStats(),
+    getCurrentSession(),
   ])
   return (
     <TarifsPageClient
       products={products}
       accessStatus={accessStatus}
       stats={stats}
+      isAuthenticated={!!session?.user}
     />
   )
 }
```

`getCurrentSession` (`lib/dal.ts:7`) est enveloppé dans React `cache()` et `getAccessStatus` l'appelle déjà en interne : aucune requête supplémentaire n'est émise.

`app/(marketing)/tarifs/_components/tarifs-page-client.tsx` :

```diff
 export default function TarifsPageClient({
   products,
   accessStatus,
   stats,
+  isAuthenticated,
 }: {
   products: ProductView[]
   accessStatus: AccessStatus | null
   stats: MarketingStats
+  isAuthenticated: boolean
 }) {
   return (
     <>
       <PricingHeader stats={stats} />

-      <PricingGrid products={products} accessStatus={accessStatus} />
+      <PricingGrid
+        products={products}
+        accessStatus={accessStatus}
+        isAuthenticated={isAuthenticated}
+      />
```

- [ ] **Step 5 : Relancer le test — il doit passer**

```bash
bunx vitest run --project frontend tests/components/payments/PricingGrid.test.tsx
```

Attendu : 4 tests PASS.

- [ ] **Step 6 : Vérifier la discriminance**

Remettre temporairement le défaut dans `pricing-grid.tsx` : réintroduire `const { isAuthenticated } = useCurrentUser()` (en ignorant la prop) et relancer.

Attendu : les tests « rend le bandeau » et « ouvre le checkout » ÉCHOUENT. Si tout passe encore, le test ne teste rien — corriger le test avant de continuer. Puis annuler cette modification temporaire.

- [ ] **Step 7 : Gate + commit**

```bash
bun run check
git add app/\(marketing\)/tarifs tests/components/payments/PricingGrid.test.tsx
git commit -m "fix(tarifs): descendre l'authentification du serveur au lieu de la lire côté client"
```

---

## Task 2 : Hook partagé `useMounted`

**Files:**
- Create: `hooks/use-mounted.ts`
- Test: `tests/hooks/useMounted.test.tsx` (créer)

`hooks/**/*.ts` est inclus dans la couverture (`vitest.config.ts`) : ce hook doit être testé.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/hooks/useMounted.test.tsx` :

```tsx
import { renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { useMounted } from "@/hooks/use-mounted"

const Probe = () => <span>{useMounted() ? "monté" : "non monté"}</span>

describe("useMounted", () => {
  it("vaut false au snapshot serveur (donc au rendu d'hydratation)", () => {
    expect(renderToString(<Probe />)).toContain("non monté")
  })

  it("vaut true côté client", () => {
    const { result } = renderHook(() => useMounted())
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bunx vitest run --project frontend tests/hooks/useMounted.test.tsx
```

Attendu : ÉCHEC — `Cannot find module '@/hooks/use-mounted'`.

- [ ] **Step 3 : Écrire le hook**

Créer `hooks/use-mounted.ts` :

```ts
"use client"

import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * `false` pendant le rendu serveur ET pendant le rendu d'hydratation, `true`
 * ensuite. `getServerSnapshot` renvoie une constante : React l'emprunte à
 * l'hydratation, le rendu client reproduit donc exactement le HTML serveur.
 *
 * Sert à empêcher un état exclusivement client (session Better Auth, thème)
 * de décider du balisage pendant l'hydratation. `authClient.useSession()` en a
 * besoin parce que Better Auth passe son snapshot CLIENT comme
 * `getServerSnapshot` (`better-auth/dist/client/react/react-store.mjs`) : sans
 * cette garde, une session déjà en cache rend un arbre différent du HTML servi.
 */
export const useMounted = () =>
  useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)
```

- [ ] **Step 4 : Relancer le test — il doit passer**

```bash
bunx vitest run --project frontend tests/hooks/useMounted.test.tsx
```

Attendu : 2 tests PASS.

- [ ] **Step 5 : Faire adopter le hook par `ThemeToggle`**

`components/shared/theme-toggle.tsx` — remplacer la duplication locale :

```diff
 import { useTheme } from "next-themes"
-import { useEffect, useState, useSyncExternalStore } from "react"
+import { useEffect, useState } from "react"
 import { Button } from "@/components/ui/button"
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu"
-
-// useSyncExternalStore pour détecter le montage côté client sans setState dans useEffect
-const emptySubscribe = () => () => {}
+import { useMounted } from "@/hooks/use-mounted"

 export default function ThemeToggle() {
   const { setTheme } = useTheme()
   const [open, setOpen] = useState(false)
-  const mounted = useSyncExternalStore(
-    emptySubscribe,
-    () => true, // Côté client : toujours monté
-    () => false, // Côté serveur : jamais monté
-  )
+  const mounted = useMounted()
```

Le reste du fichier (placeholder `if (!mounted)`, dropdown) est inchangé.

- [ ] **Step 6 : Gate + commit**

```bash
bun run check
bunx vitest run --project frontend tests/hooks/useMounted.test.tsx
git add hooks/use-mounted.ts tests/hooks/useMounted.test.tsx components/shared/theme-toggle.tsx
git commit -m "refactor: extraire la garde d'hydratation useMounted"
```

---

## Task 3 : Ajouter `motion.header` au mock de tests

**Files:**
- Modify: `tests/helpers/motion-mock.tsx:96` (après l'entrée `circle`)

`MarketingHeader` rend un `<motion.header>`, absent du mock actuel — sans cette entrée le test de la tâche 4 lève `motion.header is not a function`.

- [ ] **Step 1 : Ajouter l'entrée**

```diff
     // SVG : utilisé par ProgressRing (dashboard étudiant).
     circle: ({
       children,
       ...props
     }: ComponentPropsWithoutRef<"circle"> & Record<string, unknown>) => {
       const filtered = filterMotionProps(props)
       return <circle {...filtered}>{children}</circle>
     },
+    header: ({
+      children,
+      ...props
+    }: ComponentPropsWithoutRef<"header"> & Record<string, unknown>) => {
+      const filtered = filterMotionProps(props)
+      return <header {...filtered}>{children}</header>
+    },
   },
```

- [ ] **Step 2 : Vérifier que la suite existante ne régresse pas**

```bash
bun run test
```

Attendu : tous les tests existants PASS (ajout purement additif).

- [ ] **Step 3 : Commit**

```bash
git add tests/helpers/motion-mock.tsx
git commit -m "test: ajouter motion.header au mock motion"
```

---

## Task 4 : `MarketingHeader` — garde d'hydratation

**Files:**
- Modify: `components/marketing-header/index.tsx:20,37,147,247-248`
- Test: `tests/components/MarketingHeader.test.tsx` (créer)

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/components/MarketingHeader.test.tsx`.

**Ce test rejoue le scénario de l'incident**, il ne se contente pas d'un mock figé : le HTML serveur est produit **déconnecté**, puis la session bascule sur **connectée**, et seulement ensuite React hydrate. C'est exactement la fenêtre où le store se résout dans le replay. Sans la garde, `hydrateRoot` signale une récupération via `onRecoverableError` ; avec elle, l'hydratation est propre.

```tsx
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { MarketingHeader } from "@/components/marketing-header"
import { useCurrentUser } from "@/hooks/useCurrentUser"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/tarifs",
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}))

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}))

type Session = ReturnType<typeof useCurrentUser>

const deconnecte = {
  currentUser: null,
  isLoading: true,
  isAuthenticated: false,
  refetch: vi.fn(),
} as unknown as Session

const connecte = {
  currentUser: {
    name: "Awa Diallo",
    email: "awa@example.test",
    image: null,
  },
  isLoading: false,
  isAuthenticated: true,
  refetch: vi.fn(),
} as unknown as Session

describe("MarketingHeader", () => {
  it("hydrate proprement quand la session se résout entre le HTML serveur et l'hydratation", async () => {
    // 1. HTML serveur : aucune session résolue côté serveur.
    vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
    const html = renderToString(<MarketingHeader />)
    expect(html).toContain("Connexion")

    // 2. La session arrive AVANT qu'on hydrate — la fenêtre de l'incident.
    vi.mocked(useCurrentUser).mockReturnValue(connecte)

    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    const recoverable: unknown[] = []
    await act(async () => {
      hydrateRoot(container, <MarketingHeader />, {
        onRecoverableError: (err) => recoverable.push(err),
      })
    })

    // 3. Sans la garde, React signale ici un mismatch d'hydratation.
    expect(recoverable).toEqual([])
  })

  it("affiche l'utilisateur une fois l'hydratation terminée", async () => {
    vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
    const html = renderToString(<MarketingHeader />)

    vi.mocked(useCurrentUser).mockReturnValue(connecte)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    await act(async () => {
      hydrateRoot(container, <MarketingHeader />)
    })

    expect(container.textContent).toContain("Awa Diallo")
    expect(container.textContent).not.toContain("Connexion")
  })
})
```

> **Pourquoi ce test et pas un `renderToString` avec un mock figé.** La revue adversariale a montré que la première version passait au vert que la garde existe ou non : elle mockait la session à une valeur constante, donc serveur et client rendaient forcément la même chose. Ici la valeur **change** entre les deux rendus — c'est le seul montage qui distingue un composant gardé d'un composant nu.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
bunx vitest run --project frontend tests/components/MarketingHeader.test.tsx
```

Attendu : ÉCHEC du premier test — sans la garde, l'hydratation trouve « Connexion » dans le DOM alors que le composant rend l'avatar, React récupère et `onRecoverableError` reçoit une erreur d'hydratation. `recoverable` n'est donc pas vide.

- [ ] **Step 3 : Poser la garde**

`components/marketing-header/index.tsx` :

```diff
+import { useMounted } from "@/hooks/use-mounted"
 import { useCurrentUser } from "@/hooks/useCurrentUser"
 import { authClient } from "@/lib/auth-client"
```

L'ordre compte : `prettier` trie le groupe `@/` et `use-mounted` précède `useCurrentUser` (`-` avant `C`). L'inverse fait échouer `bun run check`.

```diff
   const { isVisible, isScrolled } = useHeaderScroll()
   const { currentUser, isAuthenticated } = useCurrentUser()
+  // La session n'est pas résolue au SSR : la laisser choisir le balisage
+  // pendant l'hydratation produit deux arbres DOM différents.
+  const showUser = useMounted() && isAuthenticated
   const pathname = usePathname()
```

Branche desktop (ligne 147) :

```diff
-              {isAuthenticated && currentUser ? (
+              {showUser && currentUser ? (
```

Passage au menu mobile (lignes 247-248) :

```diff
         currentUser={currentUser}
-        isAuthenticated={isAuthenticated}
+        isAuthenticated={showUser}
```

`mobile-menu.tsx` n'est pas modifié : il consomme la prop.

- [ ] **Step 4 : Relancer le test — il doit passer**

```bash
bunx vitest run --project frontend tests/components/MarketingHeader.test.tsx
```

Attendu : 2 tests PASS.

- [ ] **Step 5 : Vérifier la discriminance**

Remplacer temporairement `showUser` par `isAuthenticated` à la ligne 147 et relancer.

Attendu : le premier test ÉCHOUE — `recoverable` contient une erreur d'hydratation. Si les deux passent encore, le test ne teste pas la garde ; ne pas continuer avant de l'avoir corrigé. Puis annuler cette modification temporaire.

- [ ] **Step 6 : Gate + commit**

```bash
bun run check
git add components/marketing-header/index.tsx tests/components/MarketingHeader.test.tsx
git commit -m "fix(marketing): empêcher la session cliente de décider du rendu d'hydratation du header"
```

> **Message de commit — à ne pas embellir.** Ce correctif est un durcissement structurel : aucun événement Sentry ne désigne le header (les 3 événements résiduels sont tous sur `/tarifs`). Le corps du commit doit le dire, sinon le prochain lecteur croira que le header était prouvé fautif.

---

## Task 5 : Généraliser la règle dans `.claude/rules/loading-ui.md`

**Files:**
- Modify: `.claude/rules/loading-ui.md` (section « Pas d'état de chargement pour la session »)

La règle actuelle interdit `authClient.useSession()` **dans le shell dashboard**. Le défaut est en réalité général, et sa cause est maintenant prouvée dans la source de la bibliothèque.

- [ ] **Step 1 : Remplacer le corollaire final de la section**

Remplacer le paragraphe qui commence par « Corollaire général : » par :

```markdown
  **Cause racine, prouvée dans la bibliothèque** :
  `better-auth/dist/client/react/react-store.mjs` appelle
  `useSyncExternalStore(subscribe, get, get)` — le 3ᵉ argument est
  `getServerSnapshot`, celui que React emprunte pour le **rendu d'hydratation**,
  et Better Auth y passe le snapshot CLIENT. Une session déjà en cache est donc
  visible pendant l'hydratation alors que le HTML serveur a été produit sans
  elle. **Aucun composant rendu côté serveur ne doit brancher son balisage sur
  `authClient.useSession()`** — pas seulement le shell dashboard.
  Deux remèdes, selon que la page peut lire les cookies :
  - page déjà dynamique → descendre l'information en **prop depuis le Server
    Component** (`app/(marketing)/tarifs/page.tsx` passe `isAuthenticated`) ;
  - page ISR, où lire les cookies casserait la génération statique
    (`/`, `/domaines`, `/a-propos`, `/evaluation` sont en `revalidate = 3600`)
    → garder la session cliente mais la neutraliser pendant l'hydratation avec
    `useMounted()` (`hooks/use-mounted.ts`), comme `components/marketing-header`
    et `components/shared/theme-toggle.tsx`.

  Corollaire général : **tout état dérivé du client seul (session, `window`,
  `Date.now()`) rendu conditionnellement pendant le SSR produit un mismatch.**
  L'autre cause de la même issue était le salut du hero calculé sur l'heure du
  runtime (corrigé par #130, `getAppZoneHour`).
```

- [ ] **Step 2 : Vérifier le formatage**

```bash
bun run format:check
```

Attendu : PASS. Sinon `bun run format`.

- [ ] **Step 3 : Commit**

```bash
git add .claude/rules/loading-ui.md
git commit -m "docs(rules): généraliser l'interdiction de brancher le rendu sur la session cliente"
```

---

## Task 6 : Validation complète

- [ ] **Step 1 : Suite complète + gates**

```bash
bun run check
bun run test
```

Attendu : `check` PASS (prettier + tsc + eslint `--max-warnings 0`) ; suite frontend entièrement verte.

- [ ] **Step 2 : Couverture**

```bash
bun run test:coverage
```

Attendu : les 4 seuils restent ≥ 80 %.

**La couverture ne mesure rien de ce correctif, et il faut le savoir.** `coverage.include` (`vitest.config.ts`) ne liste que `lib/**`, `hooks/**`, `components/**`, `schemas/**`, `email/**` — et `components/marketing-header/**` comme `components/shared/theme-toggle.tsx` sont explicitement exclus. Sur les trois fichiers corrigés :

| Fichier | Mesuré ? |
| --- | --- |
| `app/(marketing)/tarifs/_components/pricing-grid.tsx` | non — `app/**` n'est pas dans `include` |
| `components/marketing-header/index.tsx` | non — exclu |
| `hooks/use-mounted.ts` | oui |

Un seuil qui reste vert ne dit donc **rien** sur ce travail. Ce sont les tests des tâches 1, 2 et 4 et leurs contrôles de discriminance qui valent, pas le pourcentage. Ne pas élargir `coverage.include` dans cette itération : ça ferait bouger la barre pour des raisons sans rapport avec le correctif.

- [ ] **Step 3 : Tests d'intégration**

```bash
bun run test:integration
```

Attendu : PASS. Aucun DAL n'est modifié, c'est un contrôle de non-régression sur `getAccessStatus` / `getCurrentSession`.

- [ ] **Step 4 : Vérification navigateur (à faire par l'utilisateur)**

Le serveur de dev n'est **jamais** lancé par l'agent. Demander à l'utilisateur de lancer `bun dev` et de donner le port, puis vérifier, **connecté** :

1. `/tarifs` — le bandeau « Vos accès actuels » s'affiche si un accès est actif ; aucune erreur d'hydratation en console.
2. `/tarifs` — un clic sur « Acheter » ouvre le checkout **dès le premier clic**, sans clic mort.
3. `/` puis `/domaines` (pages ISR) — l'avatar apparaît dans le header, aucune erreur d'hydratation en console.
4. Déconnecté sur `/tarifs` — le clic « Acheter » redirige vers `/inscription`.

- [ ] **Step 5 : Marquer les issues Sentry**

Après déploiement seulement :

```bash
sentry issue resolve NOMAQBANQ-5
sentry issue resolve NOMAQBANQ-1E
```

Sentry rouvre automatiquement une issue résolue si l'erreur réapparaît sur une release postérieure. **C'est le seul verdict qui compte** — les trois tentatives précédentes (#127, #130, #133) passaient leurs tests aussi. Surveiller deux semaines.

Si `-5` se rouvre sur une page marketing **autre** que `/tarifs`, c'est le header qui était en cause et la garde a été contournée : le noter dans l'issue plutôt que de deviner.

`NOMAQBANQ-1D` reste ouverte — hors périmètre, voir la section _Hors périmètre_ de la spec.

---

## Ce que ce plan ne fait pas

- **`NOMAQBANQ-1D`** (`Unknown unit of work tag (9227)`) : une occurrence, `handled: yes`, pas de duplication React côté build. Lead conservé dans la spec.
- **Les cinq autres consommateurs de `useCurrentUser`** (`nav-secondary`, `onboarding-guard`, `onboarding-form`, `profile-personal-info`, `avatar-uploader`) : tous en zone `(dashboard)`, dont le layout garde déjà la session côté serveur. Écarté explicitement de cette itération.
- **Un test d'architecture interdisant `useCurrentUser` dans un composant rendu côté serveur** : écarté avec le balayage complet. À reconsidérer si `-5` se rouvre.
- **`Sentry.setUser`** : absent du dépôt, `user.id` toujours nul. Angle mort d'observabilité noté, non traité.
