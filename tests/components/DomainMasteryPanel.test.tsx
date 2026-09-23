import { render, screen, within } from "@testing-library/react"
import { type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { DomainMasteryPanel } from "@/app/(dashboard)/tableau-de-bord/_components/domain-mastery-panel"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => null,
}))

const rows = () => screen.getAllByTestId("domain-mastery-row")
const domainOf = (row: HTMLElement) => row.dataset.domain

describe("DomainMasteryPanel", () => {
  const domains = [
    { domain: "Cardiologie", answered: 12, mastery: 80 },
    { domain: "Neurologie", answered: 0, mastery: null },
    { domain: "Pédiatrie", answered: 3, mastery: 0 },
    { domain: "Psychiatrie", answered: 20, mastery: 45 },
  ]

  it("classe les domaines du plus faible au plus fort, les domaines peu pratiqués puis jamais pratiqués après", () => {
    render(<DomainMasteryPanel domains={domains} />)
    expect(rows().map(domainOf)).toEqual([
      "Psychiatrie",
      "Cardiologie",
      "Pédiatrie",
      "Neurologie",
    ])
  })

  it("donne la maîtrise sur le nombre de questions comptées", () => {
    render(<DomainMasteryPanel domains={domains} />)
    const psychiatrie = rows()[0]!
    expect(psychiatrie).toHaveTextContent("45 %")
    expect(psychiatrie).toHaveTextContent("sur 20 questions")
  })

  it("marque un domaine sous 5 questions comme peu fiable", () => {
    render(<DomainMasteryPanel domains={domains} />)
    const pediatrie = rows()[2]!
    expect(pediatrie).toHaveTextContent("Peu de données")
    expect(pediatrie.dataset.significant).toBe("false")
  })

  it("affiche un domaine jamais pratiqué comme tel, jamais à 0 %", () => {
    render(<DomainMasteryPanel domains={domains} />)
    const neurologie = rows()[3]!
    expect(neurologie).toHaveTextContent("Pas encore pratiqué")
    expect(neurologie).not.toHaveTextContent("0 %")
  })

  it("mène à la révision de chaque domaine", () => {
    render(<DomainMasteryPanel domains={domains} />)
    expect(
      within(rows()[0]!).getByRole("link", { name: /Réviser/ }),
    ).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement?domaine=Psychiatrie",
    )
  })

  it("invite à s'entraîner quand aucune réponse n'est comptée", () => {
    render(
      <DomainMasteryPanel
        domains={[{ domain: "Cardiologie", answered: 0, mastery: null }]}
      />,
    )
    expect(screen.queryAllByTestId("domain-mastery-row")).toHaveLength(0)
    expect(
      screen.getByRole("link", { name: /Commencer un entraînement/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/entrainement")
  })
})
