import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  PricingCard,
  type PricingCardProduct,
} from "@/components/shared/payments/pricing-card"

const examMonthly: PricingCardProduct = {
  id: "prod_exam",
  code: "exam_access",
  name: "Accès Examens 30 jours",
  description: "Accès complet aux examens simulés pendant 30 jours",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam",
  isCombo: false,
}

const trainingMonthly: PricingCardProduct = {
  ...examMonthly,
  id: "prod_training",
  code: "training_access",
  name: "Accès Entraînement 30 jours",
  accessType: "training",
}

const premium: PricingCardProduct = {
  ...examMonthly,
  id: "prod_premium",
  code: "premium_access",
  name: "Pack Premium",
  description: "Les deux accès pendant 6 mois",
  priceCAD: 35000,
  durationDays: 180,
  isCombo: true,
}

const access = { expiresAt: 1_800_000_000_000, daysRemaining: 12 }

describe("PricingCard", () => {
  it("affiche le nom, le prix du catalogue et la durée", () => {
    render(<PricingCard product={examMonthly} onPurchase={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: "Accès Examens 30 jours" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^50\s\$$/)).toBeInTheDocument()
    expect(screen.getByText("CAD · 30j")).toBeInTheDocument()
    expect(screen.getByText("Sans engagement")).toBeInTheDocument()
  })

  it("annonce 3000+ questions pour l'accès Entraînement", () => {
    render(<PricingCard product={trainingMonthly} onPurchase={vi.fn()} />)

    expect(screen.getByText("Banque d'entraînement")).toBeInTheDocument()
    expect(
      screen.getByText("3000+ questions d'entraînement"),
    ).toBeInTheDocument()
  })

  it("lance l'achat au clic, une seule fois même sur un double-clic", () => {
    const onPurchase = vi.fn()
    render(<PricingCard product={examMonthly} onPurchase={onPurchase} />)

    const button = screen.getByRole("button", { name: "Choisir" })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onPurchase).toHaveBeenCalledOnce()
  })

  it("désactive le bouton pendant la création de la session Stripe", () => {
    const onPurchase = vi.fn()
    render(
      <PricingCard product={examMonthly} onPurchase={onPurchase} isLoading />,
    )

    const button = screen.getByRole("button", { name: /Chargement/ })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onPurchase).not.toHaveBeenCalled()
  })

  it("propose de prolonger l'accès en cours du même type", () => {
    render(
      <PricingCard
        product={examMonthly}
        currentAccess={{ exam: access, training: null }}
        onPurchase={vi.fn()}
      />,
    )

    expect(screen.getByText("Votre accès actuel")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Prolonger l'accès" }),
    ).toBeInTheDocument()
  })

  it("ignore l'accès en cours d'un autre type", () => {
    render(
      <PricingCard
        product={trainingMonthly}
        currentAccess={{ exam: access, training: null }}
        onPurchase={vi.fn()}
      />,
    )

    expect(screen.queryByText("Votre accès actuel")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Choisir" })).toBeInTheDocument()
  })

  it("marque la formule populaire", () => {
    render(<PricingCard product={examMonthly} popular onPurchase={vi.fn()} />)
    expect(screen.getByText("Populaire")).toBeInTheDocument()
  })

  describe("variante mise en avant (Pack Premium)", () => {
    it("barre le prix des mensuels équivalents et chiffre l'économie", () => {
      render(
        <PricingCard
          variant="featured"
          product={premium}
          savings={{ referenceCAD: 60000, savedCAD: 25000, percent: 42 }}
          onPurchase={vi.fn()}
        />,
      )

      expect(
        screen.getByRole("heading", { level: 2, name: "Pack Premium" }),
      ).toBeInTheDocument()
      expect(screen.getByText(/^600\s\$$/)).toBeInTheDocument()
      expect(screen.getByText(/vous économisez 250\s\$/)).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Choisir Premium" }),
      ).toBeInTheDocument()
    })

    it("ne promet pas de prolongation : le Pack Premium ouvre une période neuve", () => {
      render(
        <PricingCard
          variant="featured"
          product={premium}
          currentAccess={{ exam: access, training: null }}
          onPurchase={vi.fn()}
        />,
      )

      expect(screen.getByText("Vos accès actuels")).toBeInTheDocument()
      expect(screen.getByText("Entraînement : aucun")).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Choisir Premium" }),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Ne s'ajoute pas au temps restant de vos accès."),
      ).toBeInTheDocument()
    })
  })
})
