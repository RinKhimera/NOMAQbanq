import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SelectionColumn } from "@/app/(admin)/admin/examens/[id]/questions/_components/selection-column"
import type { BankQuestion } from "@/features/questions/dal"
import { COMPOSER_NOW, DAY, bankQuestion } from "../../helpers/bank-question"

const ITEMS: BankQuestion[] = [
  bankQuestion("q1", {
    question: "Douleur rétrosternale",
    lastUse: {
      examId: "e9",
      title: "EB-25",
      startDate: COMPOSER_NOW - 14 * DAY,
      recent: true,
    },
  }),
  bankQuestion("q2", { question: "Souffle systolique", keyToVerify: true }),
  bankQuestion("q3", {
    question: "Fièvre du nourrisson",
    domain: "Pédiatrie",
    deleted: true,
  }),
]

const renderColumn = (
  over: Partial<Parameters<typeof SelectionColumn>[0]> = {},
) => {
  const handlers = { onPreview: vi.fn(), onRemove: vi.fn() }
  render(
    <SelectionColumn
      items={ITEMS}
      now={COMPOSER_NOW}
      frozen={false}
      writing={false}
      busyKey={null}
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

const group = (domain: string) =>
  screen
    .getAllByTestId("composer-selection-group")
    .find((g) => within(g).queryByRole("button", { name: new RegExp(domain) }))!

describe("SelectionColumn", () => {
  it("sélection vide : invite à ajouter depuis la banque", () => {
    renderColumn({ items: [] })
    expect(screen.getByTestId("composer-selection-empty")).toBeInTheDocument()
    expect(
      screen.queryByTestId("composer-selection-alerts"),
    ).not.toBeInTheDocument()
  })

  it("alertes : supprimées, récentes, clés à vérifier ; pastilles sur les lignes", () => {
    renderColumn()
    expect(screen.getByTestId("composer-selection-deleted")).toHaveTextContent(
      "1 question supprimée depuis son ajout, à retirer avant de finaliser.",
    )
    const alerts = screen.getByTestId("composer-selection-alerts")
    expect(alerts).toHaveTextContent("1 question récente")
    expect(alerts).toHaveTextContent("1 clé à vérifier")

    const rows = screen.getAllByTestId("composer-selection-row")
    const row = (id: string) => rows.find((r) => r.dataset.questionId === id)!
    expect(row("q1")).toHaveTextContent("Récente · EB-25 · il y a 2 sem.")
    expect(row("q2")).toHaveTextContent("Clé à vérifier")
    expect(row("q3")).toHaveTextContent("Supprimée")
  })

  it("groupée par domaine ; un groupe se replie et se déplie", () => {
    renderColumn()
    const cardio = group("Cardiologie")
    expect(
      within(cardio).getAllByTestId("composer-selection-row"),
    ).toHaveLength(2)
    const header = within(cardio).getByRole("button", { name: /Cardiologie/ })
    fireEvent.click(header)
    expect(header).toHaveAttribute("aria-expanded", "false")
    expect(
      within(cardio).queryByTestId("composer-selection-row"),
    ).not.toBeInTheDocument()
    expect(
      within(group("Pédiatrie")).getByTestId("composer-selection-row"),
    ).toBeInTheDocument()
    fireEvent.click(header)
    expect(
      within(cardio).getAllByTestId("composer-selection-row"),
    ).toHaveLength(2)
  })

  it("recherche locale : filtre, rouvre les groupes repliés, message sans résultat", () => {
    renderColumn()
    fireEvent.click(
      within(group("Cardiologie")).getByRole("button", { name: /Cardiologie/ }),
    )
    const search = screen.getByPlaceholderText("Rechercher dans la sélection")
    fireEvent.change(search, { target: { value: "souffle" } })
    const rows = screen.getAllByTestId("composer-selection-row")
    expect(rows.map((r) => r.dataset.questionId)).toEqual(["q2"])

    fireEvent.change(search, { target: { value: "introuvable" } })
    expect(
      screen.getByText("Aucune question de la sélection ne correspond."),
    ).toBeInTheDocument()
  })

  it("« Retirer » envoie la question avec sa clé ; spinner sur la ligne en cours", () => {
    const { onRemove, onPreview } = renderColumn()
    fireEvent.click(
      screen.getByRole("button", { name: /^Retirer\s:\sSouffle systolique$/ }),
    )
    expect(onRemove).toHaveBeenCalledWith("remove:q2", ["q2"])
    fireEvent.click(screen.getAllByTestId("composer-question-preview")[0])
    expect(onPreview).toHaveBeenCalledWith(ITEMS[0])
  })

  it("écriture en cours : boutons désactivés, spinner sur la seule ligne visée", () => {
    renderColumn({ writing: true, busyKey: "remove:q2" })
    for (const b of screen.getAllByTestId("btn-composer-remove")) {
      expect(b).toBeDisabled()
    }
    const busy = screen.getByRole("button", {
      name: /^Retirer\s:\sSouffle systolique$/,
    })
    expect(within(busy).getByRole("status")).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("jeu figé : aucune action de retrait", () => {
    renderColumn({ frozen: true })
    expect(screen.queryByTestId("btn-composer-remove")).not.toBeInTheDocument()
  })
})
