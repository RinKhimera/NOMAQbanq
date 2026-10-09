import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MultiChecklist } from "@/components/shared/multi-checklist"

type Item = { objectif: string; count: number }

const items: Item[] = [
  { objectif: "Douleur thoracique", count: 12 },
  { objectif: "Dyspnée", count: 8 },
  { objectif: "Céphalée", count: 5 },
]

const PHONE_QUERY = "(width < 48rem)"

/** Largeur d'écran simulée ; `set` la change et prévient les abonnés. */
const mockViewport = (phone: boolean) => {
  let isPhone = phone
  const listeners = new Set<() => void>()
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        get matches() {
          return query === PHONE_QUERY && isPhone
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) =>
          listeners.delete(cb),
      }) as unknown as MediaQueryList,
  )
  return {
    set: (next: boolean) => {
      isPhone = next
      act(() => listeners.forEach((cb) => cb()))
    },
  }
}

const SHEET = {
  triggerLabel: "Parcourir les objectifs",
  title: "Objectifs du CMC",
  description: "Optionnel, 2 au plus.",
}

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
      columns={{ label: "Objectif", meta: "Questions" }}
      scope="3 objectifs dans Cardiologie"
      maxSelections={2}
      selectionSummary={(n) => `${n} sur 2 choisis`}
      maxSelectionsText="Maximum atteint. Retirez un objectif pour en choisir un autre."
      {...props}
    />,
  )

describe("MultiChecklist", () => {
  it("liste chaque option cochable avec son complément, sous l'en-tête et la portée", () => {
    renderList()
    const group = screen.getByRole("group", { name: "Objectifs du CMC" })
    expect(within(group).getAllByRole("checkbox")).toHaveLength(3)
    expect(within(group).getByText("12")).toBeInTheDocument()
    expect(within(group).getByText("Objectif")).toBeInTheDocument()
    expect(within(group).getByText("Questions")).toBeInTheDocument()
    expect(screen.getAllByText("3 objectifs dans Cardiologie")[0]).toBeVisible()
  })

  it("sans sélection, ni résumé ni « Tout retirer »", () => {
    renderList()
    expect(screen.queryByText(/sur 2 choisis/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Tout retirer" }),
    ).not.toBeInTheDocument()
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

  it("au quota, les options non cochées sont désactivées et le message s'affiche", async () => {
    renderList({ selected: [items[0], items[1]] })
    expect(screen.getByText("2 sur 2 choisis")).toBeVisible()
    expect(
      screen.getByText(
        "Maximum atteint. Retirez un objectif pour en choisir un autre.",
      ),
    ).toBeVisible()
    const blocked = screen.getByRole("checkbox", { name: /Céphalée/ })
    expect(blocked).toBeDisabled()
    // Une option déjà cochée reste retirable.
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    expect(onChange).toHaveBeenCalledWith([items[0]])
  })

  it("pastilles retirables, résumé et « Tout retirer » au-dessus de la recherche", async () => {
    renderList({ selected: [items[0], items[2]] })
    expect(screen.getByText("2 sur 2 choisis")).toBeVisible()
    await userEvent.click(
      screen.getByRole("button", { name: "Retirer Céphalée" }),
    )
    expect(onChange).toHaveBeenCalledWith([items[0]])

    onChange.mockClear()
    await userEvent.click(screen.getByRole("button", { name: "Tout retirer" }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("la note de l'appelant s'affiche entre la sélection et la liste", () => {
    renderList({ notice: <p>2 objectifs retirés</p> })
    expect(screen.getByText("2 objectifs retirés")).toBeVisible()
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

  it("sur téléphone, la liste n'est que dans le panneau, qui se ferme sur « Terminé »", async () => {
    mockViewport(true)
    renderList({
      selected: [items[0]],
      sheet: {
        triggerLabel: "Parcourir les objectifs",
        title: "Objectifs du CMC",
        description: "Optionnel, 2 au plus.",
      },
    })
    expect(screen.queryByRole("group")).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Parcourir les objectifs" }),
    )
    const panel = screen.getByRole("dialog", { name: "Objectifs du CMC" })
    expect(within(panel).getByText("1 sur 2 choisis")).toBeInTheDocument()
    await userEvent.click(
      within(panel).getByRole("checkbox", { name: /Dyspnée/ }),
    )
    expect(onChange).toHaveBeenCalledWith([items[0], items[1]])

    await userEvent.click(
      within(panel).getByRole("button", { name: "Terminé" }),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("le panneau se ferme quand l'écran s'élargit, et ne se rouvre pas seul au retour", async () => {
    const viewport = mockViewport(true)
    renderList({ sheet: SHEET })
    await userEvent.click(
      screen.getByRole("button", { name: "Parcourir les objectifs" }),
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    viewport.set(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    viewport.set(true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
