import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MultiChecklist } from "@/components/shared/multi-checklist"

type Item = { objectif: string; count: number }

const items: Item[] = [
  { objectif: "Douleur thoracique", count: 12 },
  { objectif: "Dyspnée", count: 8 },
  { objectif: "Céphalée", count: 5 },
]

const onChange = vi.fn()
const onSearchChange = vi.fn()

const renderList = (
  props: Partial<Parameters<typeof MultiChecklist<Item>>[0]> = {},
) =>
  render(
    <MultiChecklist<Item>
      options={items}
      selected={[]}
      onChange={onChange}
      getKey={(o) => o.objectif}
      getLabel={(o) => o.objectif}
      renderMeta={(o) => o.count}
      search=""
      onSearchChange={onSearchChange}
      searchPlaceholder="Rechercher un objectif"
      emptyText={(q) => `Aucun objectif ne correspond à « ${q} ».`}
      label="Objectifs du CMC"
      maxSelections={2}
      maxSelectionsLabel={(max) => `Maximum de ${max} objectifs atteint`}
      footer={(n, total) => `${n} / 2 sélectionnés · ${total} objectifs`}
      {...props}
    />,
  )

describe("MultiChecklist", () => {
  it("liste chaque option cochable avec son complément", () => {
    renderList()
    const group = screen.getByRole("group", { name: "Objectifs du CMC" })
    expect(within(group).getAllByRole("checkbox")).toHaveLength(3)
    expect(within(group).getByText("12")).toBeInTheDocument()
    expect(screen.getByText("0 / 2 sélectionnés · 3 objectifs")).toBeVisible()
  })

  it("cocher ajoute, recocher retire", async () => {
    const { rerender } = renderList()
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    expect(onChange).toHaveBeenCalledWith([items[1]])

    onChange.mockClear()
    rerender(
      <MultiChecklist<Item>
        options={items}
        selected={[items[1]]}
        onChange={onChange}
        getKey={(o) => o.objectif}
        getLabel={(o) => o.objectif}
        search=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Rechercher un objectif"
        emptyText={() => "Rien"}
        label="Objectifs du CMC"
      />,
    )
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("au quota, les options non cochées sont désactivées et l'avertissement s'affiche", async () => {
    renderList({ selected: [items[0], items[1]] })
    expect(screen.getByText("Maximum de 2 objectifs atteint")).toBeVisible()
    const blocked = screen.getByRole("checkbox", { name: /Céphalée/ })
    expect(blocked).toBeDisabled()
    // Une option déjà cochée reste retirable.
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    expect(onChange).toHaveBeenCalledWith([items[0]])
  })

  it("pastilles retirables et « Tout effacer » au-dessus de la recherche", async () => {
    renderList({ selected: [items[0], items[2]] })
    await userEvent.click(
      screen.getByRole("button", { name: "Retirer Céphalée" }),
    )
    expect(onChange).toHaveBeenCalledWith([items[0]])

    onChange.mockClear()
    await userEvent.click(screen.getByRole("button", { name: "Tout effacer" }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("remonte la frappe de recherche et annonce l'absence de résultat", async () => {
    renderList({ options: [], search: "zzz" })
    expect(
      screen.getByText("Aucun objectif ne correspond à « zzz »."),
    ).toBeVisible()
    await userEvent.type(
      screen.getByPlaceholderText("Rechercher un objectif"),
      "d",
    )
    expect(onSearchChange).toHaveBeenCalledWith("zzzd")
  })

  it("désactivée : ni case ni retrait ne répondent", async () => {
    renderList({ selected: [items[0]], disabled: true })
    expect(screen.getByRole("checkbox", { name: /Dyspnée/ })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Retirer Douleur thoracique" }),
    ).toBeDisabled()
  })
})
