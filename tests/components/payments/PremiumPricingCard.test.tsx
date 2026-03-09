import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { PremiumPricingCard } from "@/components/shared/payments/premium-pricing-card"

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

const bundleProduct = {
  _id: "prod_bundle",
  code: "combo-180",
  name: "Pack Premium 6 mois",
  description: "Accès complet examens + entraînement pendant 6 mois",
  priceCAD: 45000,
  durationDays: 180,
  accessType: "exam" as const,
  isCombo: true,
}

describe("PremiumPricingCard", () => {
  it("affiche le nom du produit", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.getByText("Pack Premium 6 mois")).toBeInTheDocument()
  })

  it("affiche le prix du produit", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.getByText("450 $")).toBeInTheDocument()
  })

  it("affiche le prix barré (régulier)", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    // regularPrice = 60000 cents = 600$
    expect(screen.getByText("600 $")).toBeInTheDocument()
  })

  it("affiche le pourcentage d'économie", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    // savings = Math.round((1 - 45000 / 60000) * 100) = 25%
    expect(screen.getByText(/Économisez 25%/)).toBeInTheDocument()
  })

  it("affiche le montant économisé", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    // savedAmount = 60000 - 45000 = 15000 cents = 150$
    expect(screen.getByText(/150 \$/)).toBeInTheDocument()
  })

  it("affiche la durée en jours", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.getByText(/180 jours/)).toBeInTheDocument()
  })

  it("affiche la description du produit", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(
      screen.getByText("Accès complet examens + entraînement pendant 6 mois"),
    ).toBeInTheDocument()
  })

  it("affiche le badge MEILLEURE OFFRE", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.getByText("MEILLEURE OFFRE")).toBeInTheDocument()
  })

  it("affiche les fonctionnalités examens", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(
      screen.getByText("Accès complet aux examens blancs"),
    ).toBeInTheDocument()
    expect(screen.getByText("Mode chronométré réaliste")).toBeInTheDocument()
    expect(
      screen.getByText("Correction détaillée après chaque examen"),
    ).toBeInTheDocument()
  })

  it("affiche les fonctionnalités entraînement", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(
      screen.getByText("5000+ questions d'entraînement"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Mode tuteur avec explications"),
    ).toBeInTheDocument()
    expect(screen.getByText("Filtrage par domaine médical")).toBeInTheDocument()
  })

  it("affiche les fonctionnalités partagées premium", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(
      screen.getByText("Statistiques de performance avancées"),
    ).toBeInTheDocument()
    expect(screen.getByText("Support prioritaire")).toBeInTheDocument()
  })

  it("affiche 'Tout ce qui est inclus'", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.getByText("Tout ce qui est inclus")).toBeInTheDocument()
  })

  it("appelle onPurchase au clic sur le bouton", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    const button = screen.getByRole("button", {
      name: /obtenir le pack premium/i,
    })
    fireEvent.click(button)

    expect(onPurchase).toHaveBeenCalledTimes(1)
  })

  it("affiche 'Chargement...' quand isLoading est true", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard
        product={bundleProduct}
        onPurchase={onPurchase}
        isLoading={true}
      />,
    )

    expect(screen.getByText("Chargement...")).toBeInTheDocument()
  })

  it("désactive le bouton quand isLoading est true", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard
        product={bundleProduct}
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
      <PremiumPricingCard
        product={bundleProduct}
        onPurchase={onPurchase}
        isLoading={true}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(onPurchase).not.toHaveBeenCalled()
  })

  it("affiche 'Obtenir le Pack Premium' sans accès existant", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.getByText("Obtenir le Pack Premium")).toBeInTheDocument()
  })

  it("affiche 'Prolonger mes accès' quand l'utilisateur a un accès exam", () => {
    const onPurchase = vi.fn()
    const examAccess = {
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      daysRemaining: 30,
    }

    render(
      <PremiumPricingCard
        product={bundleProduct}
        onPurchase={onPurchase}
        examAccess={examAccess}
      />,
    )

    expect(screen.getByText("Prolonger mes accès")).toBeInTheDocument()
  })

  it("affiche 'Prolonger mes accès' quand l'utilisateur a un accès training", () => {
    const onPurchase = vi.fn()
    const trainingAccess = {
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      daysRemaining: 30,
    }

    render(
      <PremiumPricingCard
        product={bundleProduct}
        onPurchase={onPurchase}
        trainingAccess={trainingAccess}
      />,
    )

    expect(screen.getByText("Prolonger mes accès")).toBeInTheDocument()
  })

  it("affiche la section Vos accès actuels quand examAccess est fourni", () => {
    const onPurchase = vi.fn()
    const examAccess = {
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      daysRemaining: 30,
    }

    render(
      <PremiumPricingCard
        product={bundleProduct}
        onPurchase={onPurchase}
        examAccess={examAccess}
      />,
    )

    expect(screen.getByText("Vos accès actuels")).toBeInTheDocument()
  })

  it("affiche 'Aucun' pour l'accès entraînement quand non fourni", () => {
    const onPurchase = vi.fn()
    const examAccess = {
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      daysRemaining: 30,
    }

    render(
      <PremiumPricingCard
        product={bundleProduct}
        onPurchase={onPurchase}
        examAccess={examAccess}
      />,
    )

    // The "Aucun" text for training access when not provided
    expect(screen.getByText("Aucun")).toBeInTheDocument()
  })

  it("n'affiche pas la section d'accès actuels sans accès", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(screen.queryByText("Vos accès actuels")).not.toBeInTheDocument()
  })

  it("affiche le texte de paiement sécurisé", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    expect(
      screen.getByText("Paiement sécurisé par Stripe · Accès instantané"),
    ).toBeInTheDocument()
  })

  it("affiche la légende des catégories de fonctionnalités", () => {
    const onPurchase = vi.fn()
    render(
      <PremiumPricingCard product={bundleProduct} onPurchase={onPurchase} />,
    )

    // "Examens" et "Entraînement" apparaissent plusieurs fois (header + légende)
    expect(screen.getAllByText("Examens").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("Entraînement").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Premium")).toBeInTheDocument()
  })
})
