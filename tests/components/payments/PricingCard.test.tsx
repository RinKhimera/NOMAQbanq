import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { PricingCard } from "@/components/shared/payments/pricing-card"

// Mock motion/react
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock formatCurrency
vi.mock("@/lib/format", () => ({
  formatCurrency: (amount: number) => `${(amount / 100).toFixed(0)} $`,
  formatExpiration: (ts: number) => `exp-${ts}`,
}))

const baseProduct = {
  _id: "prod_1",
  code: "exam-30",
  name: "Accès Examens 30 jours",
  description: "Accès complet aux examens simulés pendant 30 jours",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam" as const,
}

const trainingProduct = {
  _id: "prod_2",
  code: "training-30",
  name: "Accès Entraînement 30 jours",
  description: "Accès complet à la banque d'entraînement",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "training" as const,
}

describe("PricingCard", () => {
  it("affiche le nom du produit et le prix", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(screen.getByText("Accès Examens 30 jours")).toBeInTheDocument()
    expect(screen.getByText("50 $")).toBeInTheDocument()
  })

  it("affiche la description du produit", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(
      screen.getByText("Accès complet aux examens simulés pendant 30 jours"),
    ).toBeInTheDocument()
  })

  it("affiche la durée en jours", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(screen.getByText("30 jours")).toBeInTheDocument()
  })

  it("affiche les fonctionnalités pour le type exam", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(
      screen.getByText("Accès aux examens blancs complets"),
    ).toBeInTheDocument()
    expect(screen.getByText("Mode chronométré réaliste")).toBeInTheDocument()
    expect(screen.getByText("Correction détaillée")).toBeInTheDocument()
    expect(screen.getByText("Statistiques de performance")).toBeInTheDocument()
  })

  it("affiche les fonctionnalités pour le type training", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={trainingProduct} onPurchase={onPurchase} />)

    expect(
      screen.getByText("5000+ questions d'entraînement"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Mode tuteur avec explications"),
    ).toBeInTheDocument()
    expect(screen.getByText("Filtrage par domaine médical")).toBeInTheDocument()
    expect(screen.getByText("Suivi de progression")).toBeInTheDocument()
  })

  it("affiche le label Examens Simulés pour le type exam", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(screen.getByText("Examens Simulés")).toBeInTheDocument()
  })

  it("affiche le label Banque d'Entraînement pour le type training", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={trainingProduct} onPurchase={onPurchase} />)

    expect(screen.getByText("Banque d'Entraînement")).toBeInTheDocument()
  })

  it("appelle onPurchase au clic sur le bouton d'achat", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    const button = screen.getByRole("button", { name: /acheter maintenant/i })
    fireEvent.click(button)

    expect(onPurchase).toHaveBeenCalledTimes(1)
  })

  it("affiche le texte 'Acheter maintenant' sans accès existant", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(screen.getByText("Acheter maintenant")).toBeInTheDocument()
  })

  it("affiche 'Chargement...' quand isLoading est true", () => {
    const onPurchase = vi.fn()
    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        isLoading={true}
      />,
    )

    expect(screen.getByText("Chargement...")).toBeInTheDocument()
  })

  it("désactive le bouton quand isLoading est true", () => {
    const onPurchase = vi.fn()
    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        isLoading={true}
      />,
    )

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("n'appelle pas onPurchase quand isLoading est true", () => {
    const onPurchase = vi.fn()
    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        isLoading={true}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(onPurchase).not.toHaveBeenCalled()
  })

  it("affiche le badge Populaire quand isPopular est true", () => {
    const onPurchase = vi.fn()
    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        isPopular={true}
      />,
    )

    expect(screen.getByText("Populaire")).toBeInTheDocument()
  })

  it("n'affiche pas le badge Populaire par défaut", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(screen.queryByText("Populaire")).not.toBeInTheDocument()
  })

  it("affiche l'accès actuel quand currentAccess est fourni", () => {
    const onPurchase = vi.fn()
    const currentAccess = {
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      daysRemaining: 30,
    }

    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        currentAccess={currentAccess}
      />,
    )

    expect(screen.getByText("Votre accès actuel")).toBeInTheDocument()
  })

  it("affiche 'Prolonger l'accès' quand l'utilisateur a un accès existant", () => {
    const onPurchase = vi.fn()
    const currentAccess = {
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      daysRemaining: 30,
    }

    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        currentAccess={currentAccess}
      />,
    )

    expect(screen.getByText("Prolonger l'accès")).toBeInTheDocument()
  })

  it("n'affiche pas la section d'accès actuel quand currentAccess est null", () => {
    const onPurchase = vi.fn()
    render(
      <PricingCard
        product={baseProduct}
        onPurchase={onPurchase}
        currentAccess={null}
      />,
    )

    expect(screen.queryByText("Votre accès actuel")).not.toBeInTheDocument()
  })

  it("affiche le badge de réduction pour un produit promo", () => {
    const promoProduct = {
      ...baseProduct,
      code: "exam-promo-180",
      priceCAD: 20000,
      durationDays: 180,
    }
    const onPurchase = vi.fn()
    render(<PricingCard product={promoProduct} onPurchase={onPurchase} />)

    // La réduction est calculée comme Math.round((1 - 20000 / (50 * 100 * 6)) * 100) = 33%
    expect(screen.getByText(/-33%/)).toBeInTheDocument()
  })

  it("affiche le texte de confiance en bas de la carte", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={baseProduct} onPurchase={onPurchase} />)

    expect(
      screen.getByText("Paiement sécurisé par Stripe · Accès instantané"),
    ).toBeInTheDocument()
  })
})
