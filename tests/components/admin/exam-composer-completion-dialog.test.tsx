import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  CompletionDialog,
  type CompletionDraw,
} from "@/app/(admin)/admin/examens/[id]/questions/_components/completion-dialog"

const DRAW: CompletionDraw = {
  questionIds: ["q1", "q2", "q3"],
  lines: [
    { domain: "Cardiologie", count: 2, fallback: 0 },
    { domain: "Pédiatrie", count: 1, fallback: 1 },
  ],
}

const renderDialog = (
  over: Partial<Parameters<typeof CompletionDialog>[0]> = {},
) => {
  const handlers = { onRedraw: vi.fn(), onApply: vi.fn(), onClose: vi.fn() }
  render(
    <CompletionDialog
      draw={DRAW}
      need={3}
      redrawing={false}
      applying={false}
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

describe("CompletionDialog", () => {
  it("fermée sans tirage", () => {
    renderDialog({ draw: null })
    expect(
      screen.queryByTestId("composer-completion-dialog"),
    ).not.toBeInTheDocument()
  })

  it("tirage : répartition par domaine, repli signalé, « Ajouter » envoie les identifiants tirés", () => {
    const { onApply, onRedraw } = renderDialog()
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Compléter les 3 restantes",
    )
    expect(
      screen.getByText(/3 questions tirées au hasard/),
    ).not.toHaveTextContent("il en manquera")
    const lines = screen.getAllByTestId("composer-completion-line")
    expect(lines.map((l) => l.textContent)).toEqual([
      "+2Cardiologie",
      "+1Pédiatrie",
    ])
    expect(
      screen.getByTestId("composer-completion-fallback"),
    ).toHaveTextContent("Pédiatrie : 1 question récente ajoutée faute d'autres")

    fireEvent.click(screen.getByTestId("btn-composer-apply-completion"))
    expect(onApply).toHaveBeenCalledWith(["q1", "q2", "q3"])
    fireEvent.click(screen.getByTestId("btn-composer-redraw"))
    expect(onRedraw).toHaveBeenCalledOnce()
  })

  it("banque insuffisante : annonce ce qui manquera", () => {
    renderDialog({ need: 5 })
    expect(
      screen.getByText(/La banque n'en a pas davantage : il en manquera 2\./),
    ).toBeInTheDocument()
  })

  it("aucune question à tirer : pas de bouton d'ajout, relancer reste possible", () => {
    renderDialog({ draw: { questionIds: [], lines: [] } })
    expect(screen.getByText(/Aucune question à tirer/)).toBeInTheDocument()
    expect(
      screen.queryByTestId("btn-composer-apply-completion"),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("btn-composer-redraw")).toBeEnabled()
  })

  it("nouveau tirage en cours : relancer et ajouter désactivés", () => {
    renderDialog({ redrawing: true })
    expect(screen.getByTestId("btn-composer-redraw")).toBeDisabled()
    expect(screen.getByTestId("btn-composer-apply-completion")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Annuler" })).toBeEnabled()
  })

  it("ajout en cours : impossible de fermer, ni par « Annuler » ni par Échap", () => {
    const { onClose } = renderDialog({ applying: true })
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled()
    fireEvent.keyDown(screen.getByTestId("composer-completion-dialog"), {
      key: "Escape",
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("« Annuler » et Échap ferment hors ajout", () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    fireEvent.keyDown(screen.getByTestId("composer-completion-dialog"), {
      key: "Escape",
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
