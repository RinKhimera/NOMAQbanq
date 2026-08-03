import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ObjectifsCMCMultiSelect } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/objectifs-cmc-multi-select"

const objectifs = [
  { objectif: "Douleur thoracique", count: 12 },
  { objectif: "Dyspnée", count: 8 },
  { objectif: "Céphalée", count: 5 },
]

const onChange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const openList = async () => {
  await userEvent.click(screen.getByRole("combobox"))
}

describe("ObjectifsCMCMultiSelect", () => {
  it("affiche le libellé vide puis le décompte au pluriel", () => {
    const { rerender } = render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={[]}
        onChange={onChange}
      />,
    )
    expect(
      screen.getByText("Sélectionner des objectifs CMC..."),
    ).toBeInTheDocument()

    rerender(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={["Dyspnée"]}
        onChange={onChange}
      />,
    )
    expect(screen.getByText("1 objectif sélectionné")).toBeInTheDocument()

    rerender(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={["Dyspnée", "Céphalée"]}
        onChange={onChange}
      />,
    )
    expect(screen.getByText("2 objectifs sélectionnés")).toBeInTheDocument()
  })

  it("sélectionne un objectif depuis la liste", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={[]}
        onChange={onChange}
      />,
    )
    await openList()
    await userEvent.click(screen.getByText("Douleur thoracique"))

    expect(onChange).toHaveBeenCalledWith(["Douleur thoracique"])
  })

  it("re-cliquer sur un objectif déjà pris le retire", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={["Dyspnée"]}
        onChange={onChange}
      />,
    )
    await openList()
    // Le libellé existe aussi dans la puce du haut → scoper sur l'option cmdk.
    await userEvent.click(screen.getByRole("option", { name: /Dyspnée/ }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it("filtre la liste sur la recherche, sans casse", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={[]}
        onChange={onChange}
      />,
    )
    await openList()
    await userEvent.type(
      screen.getByPlaceholderText("Rechercher un objectif CMC..."),
      "dysp",
    )

    expect(screen.getByText("Dyspnée")).toBeInTheDocument()
    expect(screen.queryByText("Céphalée")).not.toBeInTheDocument()
  })

  it("annonce l'absence de résultat", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={[]}
        onChange={onChange}
      />,
    )
    await openList()
    await userEvent.type(
      screen.getByPlaceholderText("Rechercher un objectif CMC..."),
      "zzz",
    )

    expect(screen.getByText("Aucun objectif trouvé.")).toBeInTheDocument()
  })

  it("refuse d'ajouter au-delà du quota", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={["Dyspnée"]}
        onChange={onChange}
        maxSelections={1}
      />,
    )
    await openList()
    await userEvent.click(screen.getByText("Douleur thoracique"))

    expect(onChange).not.toHaveBeenCalled()
  })

  it("retire un objectif depuis sa puce et vide tout", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={["Dyspnée", "Céphalée"]}
        onChange={onChange}
      />,
    )

    const chipRemove = screen.getAllByRole("button", { name: /Dyspnée/i })
    await userEvent.click(chipRemove[chipRemove.length - 1])
    expect(onChange).toHaveBeenCalledWith(["Céphalée"])

    onChange.mockClear()
    await userEvent.click(screen.getByRole("button", { name: /Tout effacer/i }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("désactive le déclencheur pendant le chargement", () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={objectifs}
        selectedObjectifs={[]}
        onChange={onChange}
        isLoading
      />,
    )
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("tolère une liste absente", async () => {
    render(
      <ObjectifsCMCMultiSelect
        objectifs={undefined as never}
        selectedObjectifs={[]}
        onChange={onChange}
      />,
    )
    await openList()
    expect(screen.getByText("Aucun objectif trouvé.")).toBeInTheDocument()
  })
})
