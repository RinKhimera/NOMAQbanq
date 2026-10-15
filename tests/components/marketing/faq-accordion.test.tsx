import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FaqAccordion } from "@/components/marketing/faq-section"

const ITEMS = [
  { question: "Première ?", answer: "Réponse un." },
  { question: "Seconde ?", answer: "Réponse deux.", href: "/guide#deux" },
]

describe("FaqAccordion", () => {
  it("garde les réponses fermées dans le DOM, masquées", () => {
    render(<FaqAccordion items={ITEMS} defaultOpen={false} />)

    // happy-dom n'applique pas Tailwind : on asserte l'état et la classe
    // qui masque, pas la visibilité calculée.
    const region = screen.getByText("Réponse deux.").closest("[data-state]")
    expect(region).toHaveAttribute("data-state", "closed")
    expect(region).toHaveClass("data-[state=closed]:hidden")
  })

  it("lien « Lire la suite » nommé par sa question, seulement avec un href", () => {
    render(<FaqAccordion items={ITEMS} />)

    const links = screen.getAllByRole("link", { hidden: true })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute("href", "/guide#deux")
    expect(links[0]).toHaveTextContent("Lire la suite : Seconde ?")
  })
})
