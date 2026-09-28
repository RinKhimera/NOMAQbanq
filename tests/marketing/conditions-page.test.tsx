import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ConditionsPage from "@/app/(marketing)/conditions/page"

describe("page /conditions", () => {
  it("n'annonce ni taxes incluses ni 5 000 questions", () => {
    const { container } = render(<ConditionsPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Conditions d'utilisation",
      }),
    ).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/taxes incluses/i)
    expect(container.textContent).not.toMatch(/5\s?000/)
    expect(
      screen.getByText(/plus de 3000 questions à choix multiples/),
    ).toBeInTheDocument()
  })

  it("numérote les articles et les relie au sommaire", () => {
    render(<ConditionsPage />)

    const toc = screen.getByRole("navigation", { name: "Sommaire" })
    expect(toc.querySelector('a[href="#paiement"]')).not.toBeNull()
    expect(
      screen.getByRole("region", { name: "Tarification et paiement" }),
    ).toHaveAttribute("id", "paiement")
  })
})
