import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  QuestionPreviewDialog,
  useQuestionPreview,
} from "@/app/(admin)/admin/examens/[id]/questions/_components/question-preview-dialog"
import type { QuestionFile } from "@/components/admin/question-detail/question-detail-content"
import { COMPOSER_NOW, bankQuestion } from "../../helpers/bank-question"
import { DAY } from "../../helpers/time"

const { loadQuestionFile } = vi.hoisted(() => ({
  loadQuestionFile: vi.fn(),
}))
vi.mock("@/features/questions/actions", () => ({ loadQuestionFile }))
// La fiche a ses propres tests : ici seul compte qu'elle reçoive le dossier chargé.
vi.mock("@/components/admin/question-detail/question-detail-content", () => ({
  QuestionDetailContent: ({ file }: { file: { question: { id: string } } }) => (
    <div data-testid="question-detail">{file.question.id}</div>
  ),
}))

const fileOf = (id: string) => ({ question: { id } }) as unknown as QuestionFile

const Q1 = bankQuestion("q1", {
  domain: "Pédiatrie",
  objectifCMC: "Fièvre",
  lastUse: {
    examId: "e9",
    title: "EB-25",
    startDate: COMPOSER_NOW - 14 * DAY,
    recent: true,
  },
})
const Q2 = bankQuestion("q2")

describe("useQuestionPreview", () => {
  it("ouvre en chargement puis affiche le dossier lu par l'action", async () => {
    loadQuestionFile.mockResolvedValue(fileOf("q1"))
    const { result } = renderHook(() => useQuestionPreview())
    act(() => void result.current.open(Q1))
    expect(result.current.preview).toEqual({ item: Q1, file: "loading" })
    expect(loadQuestionFile).toHaveBeenCalledWith("q1")
    await waitFor(() =>
      expect(result.current.preview?.file).toEqual(fileOf("q1")),
    )
    act(() => result.current.close())
    expect(result.current.preview).toBeNull()
  })

  it.each([
    ["question introuvable", () => loadQuestionFile.mockResolvedValue(null)],
    [
      "connexion perdue",
      () => loadQuestionFile.mockRejectedValue(new Error("Failed to fetch")),
    ],
  ])("échec de lecture (%s) : état d'erreur", async (_, arrange) => {
    arrange()
    const { result } = renderHook(() => useQuestionPreview())
    await act(() => result.current.open(Q1))
    expect(result.current.preview).toEqual({ item: Q1, file: "error" })
  })

  it("une réponse arrivée après l'ouverture d'une autre question est ignorée", async () => {
    let resolveFirst: (f: QuestionFile) => void = () => {}
    loadQuestionFile.mockImplementation((id: string) =>
      id === "q1"
        ? new Promise((r) => (resolveFirst = r))
        : Promise.resolve(fileOf(id)),
    )
    const { result } = renderHook(() => useQuestionPreview())
    act(() => void result.current.open(Q1))
    await act(() => result.current.open(Q2))
    await act(async () => resolveFirst(fileOf("q1")))
    expect(result.current.preview).toEqual({ item: Q2, file: fileOf("q2") })
  })
})

const renderDialog = (
  over: Partial<Parameters<typeof QuestionPreviewDialog>[0]> = {},
) => {
  const handlers = { onClose: vi.fn(), onRetry: vi.fn(), onToggle: vi.fn() }
  render(
    <QuestionPreviewDialog
      preview={{ item: Q1, file: fileOf("q1") }}
      now={COMPOSER_NOW}
      inSelection={false}
      frozen={false}
      full={false}
      writing={false}
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

describe("QuestionPreviewDialog", () => {
  it("fermé sans aperçu", () => {
    renderDialog({ preview: null })
    expect(
      screen.queryByTestId("composer-preview-dialog"),
    ).not.toBeInTheDocument()
  })

  it("en-tête : domaine, objectif et dernière utilisation ; la fiche chargée s'affiche", () => {
    renderDialog()
    expect(
      screen.getByText(
        "Pédiatrie · Fièvre · dernière utilisation EB-25 · il y a 2 sem.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId("question-detail")).toHaveTextContent("q1")
  })

  it("chargement : squelette, sans fiche", () => {
    renderDialog({ preview: { item: Q2, file: "loading" } })
    expect(screen.getByLabelText("Chargement de la question")).toHaveAttribute(
      "aria-busy",
      "true",
    )
    expect(screen.getByText(/dernière utilisation —/)).toBeInTheDocument()
    expect(screen.queryByTestId("question-detail")).not.toBeInTheDocument()
  })

  it("erreur : « Réessayer » relance la lecture de la même question", () => {
    const { onRetry } = renderDialog({ preview: { item: Q1, file: "error" } })
    expect(
      screen.getByText("Impossible d'afficher cette question."),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(onRetry).toHaveBeenCalledWith(Q1)
  })

  it("hors sélection : « Ajouter à l'examen » bascule la question ; « Fermer » ferme", () => {
    const { onToggle, onClose } = renderDialog()
    expect(
      screen.queryByTestId("btn-composer-preview-remove"),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("btn-composer-preview-add"))
    expect(onToggle).toHaveBeenCalledWith(Q1)
    // Bouton du pied et croix du dialogue.
    const closers = screen.getAllByRole("button", { name: "Fermer" })
    expect(closers).toHaveLength(2)
    for (const b of closers) fireEvent.click(b)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it.each([
    ["jeu au visé", { full: true }],
    ["écriture en cours", { writing: true }],
  ])("ajout désactivé : %s", (_, over) => {
    renderDialog(over)
    expect(screen.getByTestId("btn-composer-preview-add")).toBeDisabled()
  })

  it("dans la sélection : « Retirer de l'examen », même au visé", () => {
    const { onToggle } = renderDialog({ inSelection: true, full: true })
    expect(
      screen.queryByTestId("btn-composer-preview-add"),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("btn-composer-preview-remove"))
    expect(onToggle).toHaveBeenCalledWith(Q1)
  })

  it("jeu figé : ni ajout ni retrait", () => {
    renderDialog({ frozen: true, inSelection: true })
    expect(
      screen.queryByTestId("btn-composer-preview-remove"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("btn-composer-preview-add"),
    ).not.toBeInTheDocument()
  })
})
