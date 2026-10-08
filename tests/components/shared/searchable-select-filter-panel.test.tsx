import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  FilterGroup,
  FilterPanelButton,
} from "@/components/shared/filter-panel"
import { SearchableSelect } from "@/components/shared/searchable-select"

const { isMobile } = vi.hoisted(() => ({ isMobile: { current: false } }))
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => isMobile.current,
}))

afterEach(() => {
  isMobile.current = false
})

const OPTIONS = [
  { value: "aigue", label: "Douleur abdominale aiguë", hint: "12" },
  { value: "toux", label: "Toux" },
]

describe("SearchableSelect", () => {
  it("cherche sans accents ni casse, et choisit", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={OPTIONS}
        placeholder="Choisir"
        searchPlaceholder="Rechercher"
        clearLabel="Tous"
      />,
    )
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByPlaceholderText("Rechercher"), "AIGUE")
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Douleur abdominale aiguë12",
    ])
    await user.click(screen.getByText("Douleur abdominale aiguë"))
    expect(onChange).toHaveBeenCalledWith("aigue")
  })

  it("affiche la valeur courante et remet à vide par l'entrée « Tous »", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableSelect
        value="toux"
        onChange={onChange}
        options={OPTIONS}
        placeholder="Choisir"
        searchPlaceholder="Rechercher"
        clearLabel="Tous"
      />,
    )
    expect(screen.getByRole("combobox")).toHaveTextContent("Toux")
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByText("Tous"))
    expect(onChange).toHaveBeenCalledWith("")
  })

  it("confie la création à `onCreate` sans changer la valeur", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onCreate = vi.fn()
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        onCreate={onCreate}
        options={OPTIONS}
        placeholder="Choisir"
        searchPlaceholder="Rechercher"
      />,
    )
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByPlaceholderText("Rechercher"), "Fièvre ")
    await user.click(screen.getByText("Créer « Fièvre »"))
    expect(onCreate).toHaveBeenCalledWith("Fièvre")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("regroupe les options sous leur intitulé", async () => {
    const user = userEvent.setup()
    render(
      <SearchableSelect
        value=""
        onChange={vi.fn()}
        options={[
          { value: "toux", label: "Toux", group: "Objectifs du domaine" },
          { value: "fievre", label: "Fièvre", group: "Autres objectifs" },
        ]}
        placeholder="Choisir"
        searchPlaceholder="Rechercher"
      />,
    )
    await user.click(screen.getByRole("combobox"))
    expect(screen.getByText("Objectifs du domaine")).toBeInTheDocument()
    expect(screen.getByText("Autres objectifs")).toBeInTheDocument()
  })

  it("propose la création d'une valeur absente, pas d'un doublon", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={OPTIONS}
        placeholder="Choisir"
        searchPlaceholder="Rechercher"
        creatable
      />,
    )
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByPlaceholderText("Rechercher"), "toux ")
    expect(screen.queryByText(/Créer/)).not.toBeInTheDocument()
    await user.clear(screen.getByPlaceholderText("Rechercher"))
    await user.type(screen.getByPlaceholderText("Rechercher"), "Dyspnée")
    await user.click(screen.getByText("Créer « Dyspnée »"))
    expect(onChange).toHaveBeenCalledWith("Dyspnée")
  })

  it("aucun résultat : le texte d'état vide", async () => {
    const user = userEvent.setup()
    render(
      <SearchableSelect
        value=""
        onChange={vi.fn()}
        options={OPTIONS}
        placeholder="Choisir"
        searchPlaceholder="Rechercher"
        emptyText="Rien ici"
        invalid
      />,
    )
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("combobox")).toHaveTextContent("Choisir")
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByPlaceholderText("Rechercher"), "zzz")
    expect(screen.getByText("Rien ici")).toBeInTheDocument()
  })
})

describe("FilterPanelButton", () => {
  const panel = (activeCount: number, onReset = vi.fn()) => (
    <FilterPanelButton
      activeCount={activeCount}
      onReset={onReset}
      resultLabel="Afficher 39 questions"
    >
      <FilterGroup label="Images" help="Aide">
        <span>contenu</span>
      </FilterGroup>
      <FilterGroup label="Examen" htmlFor="f-exam">
        <input id="f-exam" />
      </FilterGroup>
    </FilterPanelButton>
  )

  it("bureau : popover, compteur et réinitialisation", async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    render(panel(2, onReset))
    expect(screen.getByTestId("btn-filter-panel")).toHaveTextContent("2")
    await user.click(screen.getByTestId("btn-filter-panel"))
    expect(screen.getByRole("group", { name: "Images" })).toHaveTextContent(
      "Aide",
    )
    expect(screen.getByLabelText("Examen")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }))
    expect(onReset).toHaveBeenCalled()
  })

  it("bureau sans filtre actif : ni compteur ni réinitialisation", async () => {
    const user = userEvent.setup()
    render(panel(0))
    await user.click(screen.getByTestId("btn-filter-panel"))
    expect(
      screen.queryByRole("button", { name: "Réinitialiser" }),
    ).not.toBeInTheDocument()
  })

  it("téléphone : plein écran, « Afficher N » referme", () => {
    isMobile.current = true
    render(panel(0))
    fireEvent.click(screen.getByTestId("btn-filter-panel"))
    expect(screen.getByRole("dialog")).toHaveTextContent("Filtres")
    expect(screen.getByRole("button", { name: "Réinitialiser" })).toBeDisabled()
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher 39 questions" }),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
