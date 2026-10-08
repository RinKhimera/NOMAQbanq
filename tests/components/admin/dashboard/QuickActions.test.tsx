import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuickActions } from "@/components/admin/dashboard/quick-actions"

describe("QuickActions", () => {
  it("trois raccourcis sont des liens vers leur page", () => {
    render(<QuickActions />)

    expect(screen.getByText("Actions rapides")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Ajouter une question" }),
    ).toHaveAttribute("href", "/admin/questions")
    expect(
      screen.getByRole("link", { name: "Créer un examen" }),
    ).toHaveAttribute("href", "/admin/examens/creer")
    expect(
      screen.getByRole("link", { name: "Gérer les utilisateurs" }),
    ).toHaveAttribute("href", "/admin/utilisateurs")
  })

  it("« Enregistrer un paiement » est un bouton qui appelle onManualPaymentClick", () => {
    const onManualPaymentClick = vi.fn()
    render(<QuickActions onManualPaymentClick={onManualPaymentClick} />)

    expect(
      screen.queryByRole("link", { name: "Enregistrer un paiement" }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer un paiement" }),
    )

    expect(onManualPaymentClick).toHaveBeenCalledOnce()
  })
})
