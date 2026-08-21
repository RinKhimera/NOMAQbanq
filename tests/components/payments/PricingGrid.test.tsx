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

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}))

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
  },
]

const trainingProduct = {
  ...products[0],
  id: "prod_2",
  code: "training_access" as const,
  name: "Accès Entraînement 30 jours",
  accessType: "training" as const,
}

const premiumProduct = {
  ...products[0],
  id: "prod_3",
  code: "premium_access" as const,
  name: "Accès Premium",
  isCombo: true,
}

const accessStatus = {
  examAccess: { expiresAt: 1_800_000_000_000, daysRemaining: 12 },
  trainingAccess: null,
}

describe("PricingGrid", () => {
  beforeEach(() => {
    createStripeCheckout.mockResolvedValue({
      checkoutUrl: "https://stripe.test/x",
    })
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

  it("affiche l'erreur métier renvoyée par l'action, sans rediriger", async () => {
    createStripeCheckout.mockResolvedValue({ error: "Produit mal configuré" })
    render(
      <PricingGrid products={products} accessStatus={null} isAuthenticated />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Acheter maintenant/ }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Produit mal configuré"),
    )
  })

  it("distingue une panne réseau d'une erreur générique", async () => {
    createStripeCheckout.mockRejectedValue(new Error("Failed to fetch"))
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    const { unmount } = render(
      <PricingGrid products={products} accessStatus={null} isAuthenticated />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Acheter maintenant/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Pas de connexion internet. Vérifiez votre réseau.",
      ),
    )
    unmount()

    onLine.mockReturnValue(true)
    render(
      <PricingGrid products={products} accessStatus={null} isAuthenticated />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Acheter maintenant/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Une erreur est survenue. Veuillez réessayer.",
      ),
    )
  })

  it("affiche un état vide quand aucun produit n'est disponible", () => {
    render(
      <PricingGrid products={[]} accessStatus={null} isAuthenticated={false} />,
    )

    expect(screen.getByText("Aucune offre disponible")).toBeInTheDocument()
  })

  it("sort le produit combo de la grille pour le mettre en avant", () => {
    render(
      <PricingGrid
        products={[...products, premiumProduct]}
        accessStatus={accessStatus}
        isAuthenticated
      />,
    )

    expect(screen.getByText("Accès Premium")).toBeInTheDocument()
    expect(screen.getByText("Accès Examens 30 jours")).toBeInTheDocument()
  })

  it("filtre la grille par type d'accès", () => {
    render(
      <PricingGrid
        products={[...products, trainingProduct]}
        accessStatus={accessStatus}
        isAuthenticated
      />,
    )

    expect(screen.getByText("Accès Entraînement 30 jours")).toBeInTheDocument()

    // Radix TabsTrigger commute sur mousedown, pas sur un click synthétique.
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: /Filtrer par examens/ }),
    )

    expect(
      screen.queryByText("Accès Entraînement 30 jours"),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Accès Examens 30 jours")).toBeInTheDocument()
  })
})
