import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { ClientList } from "@/app/(admin)/admin/transactions/_components/client-list"
import { makeClientRow, makeClientsPage } from "./fixtures"

const renderList = (
  overrides: Partial<ComponentProps<typeof ClientList>> = {},
) => {
  const props: ComponentProps<typeof ClientList> = {
    clients: makeClientsPage(),
    search: "",
    onSearchChange: vi.fn(),
    isSearching: false,
    filter: "all",
    onFilterChange: vi.fn(),
    selectedId: null,
    onSelect: vi.fn(),
    onClear: vi.fn(),
    isPending: false,
    ...overrides,
  }
  render(<ClientList {...props} />)
  return props
}

const twoClients = makeClientsPage({
  items: [
    makeClientRow(),
    makeClientRow({
      userId: "u2",
      name: "  ",
      email: "sans-nom@example.com",
      openDispute: true,
    }),
  ],
  total: 45,
  firstIndex: 20,
})

describe("ClientList", () => {
  it("une ligne par client ; le clic remonte son identifiant", () => {
    const { onSelect } = renderList({ clients: twoClients })

    fireEvent.click(screen.getByTestId("client-u2"))
    expect(onSelect).toHaveBeenCalledWith("u2")
  })

  it("le client ouvert porte aria-current, pas les autres", () => {
    renderList({ clients: twoClients, selectedId: "u2" })

    expect(screen.getByTestId("client-u2")).toHaveAttribute(
      "aria-current",
      "true",
    )
    expect(screen.getByTestId("client-u1")).not.toHaveAttribute("aria-current")
  })

  it("sans nom, le courriel sert de libellé", () => {
    renderList({ clients: twoClients })

    expect(screen.getByTestId("client-u1")).toHaveTextContent("Chloé Tremblay")
    expect(
      screen
        .getByTestId("client-u2")
        .textContent?.match(/sans-nom@example\.com/g),
    ).toHaveLength(2)
  })

  it("litige ouvert : pastille « Litige en cours » à la place du statut", () => {
    renderList({ clients: twoClients })

    expect(screen.getByTestId("client-u2")).toHaveTextContent("Litige en cours")
    expect(screen.getByTestId("client-u1")).not.toHaveTextContent(
      "Litige en cours",
    )
    expect(screen.getByTestId("client-u1")).toHaveTextContent("2 tx")
  })

  it("la saisie dans la recherche remonte la valeur", () => {
    const { onSearchChange } = renderList()

    fireEvent.change(screen.getByPlaceholderText("Nom ou courriel du client"), {
      target: { value: "awa" },
    })
    expect(onSearchChange).toHaveBeenCalledWith("awa")
  })

  it("un filtre cliqué remonte sa valeur", () => {
    const { onFilterChange } = renderList()

    fireEvent.click(screen.getByTestId("client-filter-dispute"))
    expect(onFilterChange).toHaveBeenCalledWith("dispute")
  })

  it("le filtre actif est marqué, chaque filtre porte son effectif", () => {
    renderList({
      filter: "manual",
      clients: makeClientsPage({
        counts: { failed: 3, dispute: 1, manual: 2 },
      }),
    })

    expect(screen.getByTestId("client-filter-manual")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByTestId("client-filter-all")).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByTestId("client-filter-failed")).toHaveTextContent(
      "Échec3",
    )
    expect(screen.getByTestId("client-filter-dispute")).toHaveTextContent(
      "Litige1",
    )
    expect(screen.getByTestId("client-filter-manual")).toHaveTextContent(
      "Manuel2",
    )
  })

  it("liste vide après une recherche : le terme est rappelé et « Effacer les filtres » remonte", () => {
    const { onClear } = renderList({
      clients: makeClientsPage({ items: [], total: 0 }),
      search: "  awa ",
    })

    expect(
      screen.getByText("Aucune transaction ne correspond à « awa »"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/sur \d+ client/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it("liste vide sans recherche : renvoi aux filtres", () => {
    renderList({ clients: makeClientsPage({ items: [], total: 0 }) })

    expect(
      screen.getByText("Aucune transaction ne correspond à ces filtres"),
    ).toBeInTheDocument()
  })

  it("pagination : compteur de la tranche, page suivante remontée", () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    renderList({ clients: twoClients, onNext, onPrevious })

    expect(screen.getByText("21–22 sur 45 clients")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }))
    expect(onNext).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole("button", { name: "Page précédente" }))
    expect(onPrevious).toHaveBeenCalledOnce()
  })

  it("pagination : bord de liste, le bouton absent est désactivé", () => {
    renderList({ clients: twoClients, onNext: vi.fn() })

    expect(
      screen.getByRole("button", { name: "Page précédente" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Page suivante" }),
    ).not.toBeDisabled()
  })
})
