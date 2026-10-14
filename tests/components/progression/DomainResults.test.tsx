import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DomainResults } from "@/app/(dashboard)/tableau-de-bord/progression/_components/domain-results"
import type { DomainProgress } from "@/features/analytics/dal"

vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => null,
}))

const domain = (over: Partial<DomainProgress>): DomainProgress => ({
  domain: "Cardiologie",
  total: 170,
  answered: 138,
  mastery: 72,
  trend: 4,
  periodAnswers: 142,
  objectives: [],
  revision: { failed: 9, unseen: 32, bookmarked: 0 },
  ...over,
})

const cardiologie = domain({
  objectives: [
    {
      id: "o1",
      label: "Douleur thoracique",
      total: 40,
      covered: 30,
      mastery: 80,
    },
    { id: "o2", label: "Syncope", total: 12, covered: 3, mastery: 100 },
  ],
})
const neurologie = domain({
  domain: "Neurologie",
  total: 160,
  answered: 0,
  mastery: null,
  trend: null,
  periodAnswers: 0,
  revision: { failed: 0, unseen: 160, bookmarked: 0 },
})
const pediatrie = domain({ domain: "Pédiatrie", mastery: 40, trend: -2 })

const rows = () => screen.getAllByTestId("domain-row")
const row = (name: string) => rows().find((r) => r.dataset.domain === name)!
const expand = (name: string) =>
  userEvent.click(within(row(name)).getByRole("button", { name }))

describe("DomainResults", () => {
  it("met un domaine jamais pratiqué en fin de liste, sans dépliage, avec « — » et « 0 / N »", () => {
    render(
      <DomainResults
        domains={[neurologie, cardiologie, pediatrie]}
        period="30"
        trainingAccess
      />,
    )
    expect(rows().map((r) => r.dataset.domain)).toEqual([
      "Pédiatrie",
      "Cardiologie",
      "Neurologie",
    ])
    const never = row("Neurologie")
    expect(within(never).queryByRole("button")).toBeNull()
    expect(never).toHaveTextContent("—")
    expect(never).toHaveTextContent("0 / 160")
    expect(
      within(never).getByRole("link", { name: /Commencer/ }),
    ).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement?domaine=Neurologie",
    )
  })

  it("déplie un domaine sur ses objectifs et ses actions de révision ; un compteur à 0 masque son bouton", async () => {
    render(<DomainResults domains={[cardiologie]} period="30" trainingAccess />)
    expect(screen.queryByTestId("domain-detail")).toBeNull()
    await expand("Cardiologie")

    const detail = screen.getByTestId("domain-detail")
    const objectives = within(detail).getAllByTestId("objective-row")
    expect(objectives[0]).toHaveTextContent("Douleur thoracique")
    expect(objectives[0]).toHaveTextContent("80 %")
    expect(objectives[0]).toHaveTextContent("30 / 40")
    expect(objectives[1]).toHaveTextContent("Peu de données")
    expect(objectives[1]).not.toHaveTextContent("100 %")

    expect(
      within(detail).getByRole("link", { name: /Revoir mes ratées \(9\)/ }),
    ).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement?domaine=Cardiologie&revision=failed",
    )
    expect(
      within(detail).getByRole("link", { name: /Questions non vues \(32\)/ }),
    ).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement?domaine=Cardiologie&revision=unseen",
    )
    expect(within(detail).queryByText(/Mes marquées/)).toBeNull()
    expect(within(detail).queryByText(/Prolonger/)).toBeNull()

    await expand("Cardiologie")
    expect(screen.queryByTestId("domain-detail")).toBeNull()
  })

  it("sans accès Entraînement, seul « Prolonger l'accès Entraînement » remplace les actions", async () => {
    render(
      <DomainResults
        domains={[{ ...cardiologie, revision: null }, neurologie]}
        period="30"
        trainingAccess={false}
      />,
    )
    expect(
      within(row("Neurologie")).queryByRole("link", { name: /Commencer/ }),
    ).toBeNull()
    await expand("Cardiologie")
    const detail = screen.getByTestId("domain-detail")
    expect(within(detail).getAllByRole("link")).toHaveLength(1)
    expect(
      within(detail).getByRole("link", {
        name: /Prolonger l'accès Entraînement/,
      }),
    ).toHaveAttribute("href", "/tarifs")
  })

  it("affiche la tendance sur une période, pas sur « Tout »", () => {
    const { rerender } = render(
      <DomainResults domains={[pediatrie]} period="7" trainingAccess />,
    )
    expect(row("Pédiatrie")).toHaveTextContent("Tendance −2")
    rerender(
      <DomainResults domains={[pediatrie]} period="tout" trainingAccess />,
    )
    expect(row("Pédiatrie")).not.toHaveTextContent("Tendance")
  })

  it("trie par tendance puis par nom", async () => {
    render(
      <DomainResults
        domains={[cardiologie, pediatrie]}
        period="30"
        trainingAccess
      />,
    )
    await userEvent.click(screen.getByTestId("domain-sort-trend"))
    expect(rows().map((r) => r.dataset.domain)).toEqual([
      "Pédiatrie",
      "Cardiologie",
    ])
    await userEvent.click(screen.getByTestId("domain-sort-az"))
    expect(rows().map((r) => r.dataset.domain)).toEqual([
      "Cardiologie",
      "Pédiatrie",
    ])
  })
})
