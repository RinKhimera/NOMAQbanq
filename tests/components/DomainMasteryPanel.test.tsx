import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DomainMasteryPanel } from "@/app/(dashboard)/tableau-de-bord/_components/domain-mastery-panel"

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

  it("classe les domaines pratiqués du plus faible au plus fort, les domaines peu pratiqués après", () => {
    render(<DomainMasteryPanel domains={domains} />)
    expect(rows().map(domainOf)).toEqual([
      "Psychiatrie",
      "Cardiologie",
      "Pédiatrie",
    ])
  })

  it("donne la maîtrise de chaque domaine pratiqué", () => {
    render(<DomainMasteryPanel domains={domains} />)
    const psychiatrie = rows()[0]!
    expect(psychiatrie).toHaveTextContent("45 %")
    expect(
      within(psychiatrie).getByRole("progressbar", {
        name: "Maîtrise en Psychiatrie",
      }),
    ).toBeInTheDocument()
  })

  it("marque un domaine sous 5 questions comme peu fiable", () => {
    render(<DomainMasteryPanel domains={domains} />)
    const pediatrie = rows()[2]!
    expect(pediatrie).toHaveTextContent("Sur 3 questions · peu de données")
    expect(pediatrie.dataset.significant).toBe("false")
  })

  it("ne garde que les 5 domaines les plus faibles", () => {
    const many = ["A", "B", "C", "D", "E", "F", "G"].map((domain, i) => ({
      domain,
      answered: 10,
      mastery: 90 - i * 10,
    }))
    render(<DomainMasteryPanel domains={many} />)
    expect(rows().map(domainOf)).toEqual(["G", "F", "E", "D", "C"])
  })

  it("compte les domaines jamais pratiqués sur une ligne, sans les lister", () => {
    render(<DomainMasteryPanel domains={domains} />)
    const unpracticed = screen.getByTestId("domain-mastery-unpracticed")
    expect(unpracticed).toHaveTextContent("1 domaine jamais pratiqué")
    expect(screen.queryByRole("link", { name: /Neurologie/ })).toBeNull()
  })

  it("n'affiche pas la ligne des domaines jamais pratiqués quand tous le sont", () => {
    render(
      <DomainMasteryPanel
        domains={domains.filter((d) => d.mastery !== null)}
      />,
    )
    expect(screen.queryByTestId("domain-mastery-unpracticed")).toBeNull()
  })

  it("mène au rapport complet de la page Progression", () => {
    render(<DomainMasteryPanel domains={domains} />)
    expect(
      screen.getByRole("link", { name: /Rapport complet/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/progression")
  })

  it("mène à la révision de chaque domaine", () => {
    render(<DomainMasteryPanel domains={domains} />)
    expect(
      within(rows()[0]!).getByRole("link", { name: "Réviser Psychiatrie" }),
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
      screen.getByRole("link", { name: /Commencer une série/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/entrainement")
    expect(
      screen.getByRole("link", { name: /Rapport complet/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/progression")
    expect(screen.queryByTestId("domain-mastery-unpracticed")).toBeNull()
  })
})
