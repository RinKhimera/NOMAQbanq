import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BankColumn } from "@/app/(admin)/admin/examens/[id]/questions/_components/bank-column"
import { DEFAULT_COMPOSER } from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-params"
import type { BankQuestion } from "@/features/questions/dal"
import { COMPOSER_NOW, bankQuestion } from "../../helpers/bank-question"
import { DAY } from "../../helpers/time"

// Radix Select ne se monte pas fidèlement sous happy-dom : chaque option
// devient un bouton qui remonte sa valeur, la valeur courante reste lisible.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  const h = React.createElement
  const Pick = React.createContext<(v: string) => void>(() => {})
  type P = {
    value?: string
    onValueChange?: (v: string) => void
    children?: React.ReactNode
    "data-testid"?: string
  }
  return {
    Select: ({ value, onValueChange, children }: P) =>
      h(
        Pick.Provider,
        { value: onValueChange ?? (() => {}) },
        h("div", { "data-value": value }, children),
      ),
    SelectTrigger: ({ children, "data-testid": testId }: P) =>
      h("div", { "data-testid": testId }, children),
    SelectValue: () => null,
    SelectContent: ({ children }: P) => h("div", null, children),
    SelectItem: ({ value, children }: P) => {
      const pick = React.useContext(Pick)
      return h(
        "button",
        { type: "button", role: "option", onClick: () => pick(value ?? "") },
        children,
      )
    },
  }
})

const ITEMS: BankQuestion[] = [
  bankQuestion("q1", {
    question: "Douleur rétrosternale",
    answerCount: 40,
    successRate: 62,
    lastUse: {
      examId: "e9",
      title: "EB-25",
      startDate: COMPOSER_NOW - 14 * DAY,
      recent: true,
    },
  }),
  bankQuestion("q2", { question: "Souffle systolique", answerCount: 3 }),
]

const renderBank = (over: Partial<Parameters<typeof BankColumn>[0]> = {}) => {
  const handlers = {
    onSearch: vi.fn(),
    onChange: vi.fn(),
    onPage: vi.fn(),
    onClear: vi.fn(),
    onPreview: vi.fn(),
    onAdd: vi.fn(),
  }
  render(
    <BankColumn
      state={DEFAULT_COMPOSER}
      bank={{ items: ITEMS, total: 2 }}
      pageSize={20}
      now={COMPOSER_NOW}
      search=""
      isSearching={false}
      isPending={false}
      room={10}
      writing={false}
      busyKey={null}
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

const row = (id: string) =>
  screen
    .getAllByTestId("composer-bank-row")
    .find((r) => r.dataset.questionId === id)!

describe("BankColumn", () => {
  it("lignes : domaine, dernière utilisation, réussite ou « Non significatif »", () => {
    renderBank()
    expect(screen.getByText("2 questions")).toBeInTheDocument()
    expect(row("q1")).toHaveTextContent("EB-25 · il y a 2 sem.")
    expect(row("q1")).toHaveTextContent("62 %")
    expect(row("q2")).toHaveTextContent("—")
    expect(row("q2")).toHaveTextContent("Non significatif")
  })

  it("« Ajouter » envoie la question avec sa clé ; l'énoncé ouvre l'aperçu", () => {
    const { onAdd, onPreview } = renderBank()
    fireEvent.click(within(row("q2")).getByRole("button", { name: /^Ajouter/ }))
    expect(onAdd).toHaveBeenCalledWith("add:q2", ["q2"])
    fireEvent.click(within(row("q1")).getByTestId("composer-question-preview"))
    expect(onPreview).toHaveBeenCalledWith(ITEMS[0])
  })

  it("ajout de la page : toute la page quand il reste la place", () => {
    const { onAdd } = renderBank()
    const addPage = screen.getByTestId("btn-composer-add-page")
    expect(addPage).toHaveTextContent("Ajouter les 2 affichées")
    fireEvent.click(addPage)
    expect(onAdd).toHaveBeenCalledWith("add-page", ["q1", "q2"])
  })

  it("ajout de la page : seulement les premières qui tiennent sous le visé", () => {
    const { onAdd } = renderBank({ room: 1 })
    const addPage = screen.getByTestId("btn-composer-add-page")
    expect(addPage).toHaveTextContent("Ajouter les 1 premières")
    fireEvent.click(addPage)
    expect(onAdd).toHaveBeenCalledWith("add-page", ["q1"])
  })

  it.each([
    ["jeu au visé", { room: 0 }],
    ["écriture en cours", { writing: true }],
  ])("ajouts désactivés : %s", (_, over) => {
    renderBank(over)
    expect(screen.getByTestId("btn-composer-add-page")).toBeDisabled()
    for (const b of screen.getAllByTestId("btn-composer-add")) {
      expect(b).toBeDisabled()
    }
  })

  it("spinner sur le seul bouton dont l'écriture est en cours", () => {
    renderBank({ writing: true, busyKey: "add:q1" })
    expect(
      within(within(row("q1")).getByTestId("btn-composer-add")).getByRole(
        "status",
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("ajout de la page en cours : spinner sur ce seul bouton", () => {
    renderBank({ writing: true, busyKey: "add-page" })
    expect(
      within(screen.getByTestId("btn-composer-add-page")).getByRole("status"),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("filtres : domaine, tri, dernière utilisation et recherche remontent leur changement", () => {
    const { onChange, onSearch } = renderBank({
      state: { ...DEFAULT_COMPOSER, notUsedSince: 3 },
    })
    fireEvent.click(screen.getByRole("option", { name: "Cardiologie" }))
    fireEvent.click(screen.getByRole("option", { name: "Tous les domaines" }))
    fireEvent.click(screen.getByRole("option", { name: /^Tri\s:\sréussite$/ }))
    fireEvent.click(screen.getByRole("radio", { name: "Toutes" }))
    expect(onChange.mock.calls).toEqual([
      [{ domain: "Cardiologie" }],
      [{ domain: "" }],
      [{ sort: "successRate" }],
      [{ notUsedSince: null }],
    ])
    fireEvent.change(
      screen.getByPlaceholderText(
        "Énoncé, choix de réponse, objectif ou identifiant",
      ),
      { target: { value: "souffle" } },
    )
    expect(onSearch).toHaveBeenCalledWith("souffle")
  })

  it("aucun résultat : « Effacer les filtres »", () => {
    const { onClear } = renderBank({ bank: { items: [], total: 0 } })
    expect(screen.getByTestId("composer-bank-empty")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it("page disparue : retour à la première page", () => {
    const { onPage } = renderBank({
      state: { ...DEFAULT_COMPOSER, page: 4 },
      bank: { items: [], total: 30 },
    })
    expect(screen.getByText("Cette page n'existe plus.")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Revenir à la première page" }),
    )
    expect(onPage).toHaveBeenCalledWith(1)
  })

  it("pagination seulement au-delà d'une page", () => {
    const { onPage } = renderBank({ bank: { items: ITEMS, total: 45 } })
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))
    expect(onPage).toHaveBeenCalledWith(2)
  })

  it("une seule page : pas de pagination", () => {
    renderBank()
    expect(
      screen.queryByRole("button", { name: "Suivant" }),
    ).not.toBeInTheDocument()
  })
})
