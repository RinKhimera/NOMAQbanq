import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UpgradePrompt } from "@/components/shared/payments/upgrade-prompt"

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
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("UpgradePrompt", () => {
  describe("variante exam", () => {
    it("affiche le titre pour les examens", () => {
      render(<UpgradePrompt accessType="exam" />)

      expect(
        screen.getByText("Accès aux examens requis"),
      ).toBeInTheDocument()
    })

    it("affiche la description par défaut pour les examens", () => {
      render(<UpgradePrompt accessType="exam" />)

      expect(
        screen.getByText(
          "Débloquez l'accès aux examens simulés pour tester vos connaissances dans des conditions réelles.",
        ),
      ).toBeInTheDocument()
    })

    it("affiche les fonctionnalités des examens", () => {
      render(<UpgradePrompt accessType="exam" />)

      expect(
        screen.getByText("Examens blancs chronométrés"),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Conditions d'examen réalistes"),
      ).toBeInTheDocument()
      expect(screen.getByText("Correction détaillée")).toBeInTheDocument()
      expect(
        screen.getByText("Statistiques de performance"),
      ).toBeInTheDocument()
    })
  })

  describe("variante training", () => {
    it("affiche le titre pour l'entraînement", () => {
      render(<UpgradePrompt accessType="training" />)

      expect(
        screen.getByText("Accès à l'entraînement requis"),
      ).toBeInTheDocument()
    })

    it("affiche la description par défaut pour l'entraînement", () => {
      render(<UpgradePrompt accessType="training" />)

      expect(
        screen.getByText(
          "Débloquez l'accès à la banque d'entraînement pour vous exercer à votre rythme.",
        ),
      ).toBeInTheDocument()
    })

    it("affiche les fonctionnalités de l'entraînement", () => {
      render(<UpgradePrompt accessType="training" />)

      expect(
        screen.getByText("5000+ questions d'entraînement"),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Mode tuteur avec explications"),
      ).toBeInTheDocument()
      expect(screen.getByText("Filtrage par domaine")).toBeInTheDocument()
      expect(
        screen.getByText("Progression personnalisée"),
      ).toBeInTheDocument()
    })
  })

  describe("prop feature", () => {
    it("affiche un message personnalisé quand feature est fourni", () => {
      render(<UpgradePrompt accessType="exam" feature="les examens blancs" />)

      expect(
        screen.getByText(
          'Pour accéder à "les examens blancs", vous avez besoin d\'un abonnement actif.',
        ),
      ).toBeInTheDocument()
    })

    it("n'affiche pas la description par défaut quand feature est fourni", () => {
      render(<UpgradePrompt accessType="exam" feature="les examens blancs" />)

      expect(
        screen.queryByText(
          "Débloquez l'accès aux examens simulés pour tester vos connaissances dans des conditions réelles.",
        ),
      ).not.toBeInTheDocument()
    })

    it("affiche la description par défaut sans feature", () => {
      render(<UpgradePrompt accessType="training" />)

      expect(
        screen.getByText(
          "Débloquez l'accès à la banque d'entraînement pour vous exercer à votre rythme.",
        ),
      ).toBeInTheDocument()
    })
  })

  describe("lien vers /tarifs", () => {
    it("contient un lien vers la page des tarifs", () => {
      render(<UpgradePrompt accessType="exam" />)

      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/tarifs")
    })

    it("affiche le texte du bouton 'Voir les tarifs'", () => {
      render(<UpgradePrompt accessType="exam" />)

      expect(screen.getByText("Voir les tarifs")).toBeInTheDocument()
    })
  })

  it("affiche le texte de paiement sécurisé", () => {
    render(<UpgradePrompt accessType="exam" />)

    expect(
      screen.getByText("Paiement sécurisé · Accès instantané"),
    ).toBeInTheDocument()
  })

  it("applique la className personnalisée", () => {
    const { container } = render(
      <UpgradePrompt accessType="exam" className="ma-classe-custom" />,
    )

    const root = container.firstChild as HTMLElement
    expect(root.className).toContain("ma-classe-custom")
  })
})
