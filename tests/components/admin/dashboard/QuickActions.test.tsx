import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuickActions } from "@/components/admin/dashboard/quick-actions"

// Mock motion/react
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../../helpers/motion-mock")
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

describe("QuickActions", () => {
  it("affiche le titre 'Actions rapides'", () => {
    render(<QuickActions />)

    expect(screen.getByText("Actions rapides")).toBeInTheDocument()
  })

  it("affiche les 4 boutons d'action", () => {
    render(<QuickActions />)

    expect(screen.getByText("Ajouter une question")).toBeInTheDocument()
    expect(screen.getByText("Créer un examen")).toBeInTheDocument()
    expect(screen.getByText("Gérer les utilisateurs")).toBeInTheDocument()
    expect(
      screen.getByText("Enregistrer un paiement"),
    ).toBeInTheDocument()
  })

  it("contient un lien vers la page des questions", () => {
    const { container } = render(<QuickActions />)

    const link = screen
      .getByText("Ajouter une question")
      .closest("a")
    expect(link?.getAttribute("href")).toBe("/admin/questions")
  })

  it("contient un lien vers la page de création d'examen", () => {
    render(<QuickActions />)

    const link = screen.getByText("Créer un examen").closest("a")
    expect(link?.getAttribute("href")).toBe("/admin/exams/create")
  })

  it("contient un lien vers la page des utilisateurs", () => {
    render(<QuickActions />)

    const link = screen
      .getByText("Gérer les utilisateurs")
      .closest("a")
    expect(link?.getAttribute("href")).toBe("/admin/users")
  })

  it("appelle onManualPaymentClick au clic sur 'Enregistrer un paiement'", () => {
    const onManualPaymentClick = vi.fn()
    render(<QuickActions onManualPaymentClick={onManualPaymentClick} />)

    const paymentButton = screen.getByText("Enregistrer un paiement")
    fireEvent.click(paymentButton)

    expect(onManualPaymentClick).toHaveBeenCalledOnce()
  })

  it("rend 'Enregistrer un paiement' comme un bouton et non un lien", () => {
    render(<QuickActions />)

    const paymentAction = screen
      .getByText("Enregistrer un paiement")
      .closest("button")
    expect(paymentAction).not.toBeNull()

    // Ne devrait pas être un lien
    const paymentLink = screen
      .getByText("Enregistrer un paiement")
      .closest("a")
    expect(paymentLink).toBeNull()
  })

  it("rend les 3 premières actions comme des liens", () => {
    render(<QuickActions />)

    expect(
      screen.getByText("Ajouter une question").closest("a"),
    ).not.toBeNull()
    expect(
      screen.getByText("Créer un examen").closest("a"),
    ).not.toBeNull()
    expect(
      screen.getByText("Gérer les utilisateurs").closest("a"),
    ).not.toBeNull()
  })
})
