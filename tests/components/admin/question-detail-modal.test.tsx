import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionManageModal } from "@/app/(admin)/admin/questions/_components/question-manage-modal"
import {
  QuestionBrowser,
  QuestionSelectModal,
} from "@/components/admin/question-browser"

const loadQuestionsPage = vi.fn()
const loadQuestionById = vi.fn()
const deleteQuestion = vi.fn()
vi.mock("@/features/questions/actions", () => ({
  loadQuestionsPage: (...a: unknown[]) => loadQuestionsPage(...a),
  loadQuestionById: (...a: unknown[]) => loadQuestionById(...a),
  deleteQuestion: (...a: unknown[]) => deleteQuestion(...a),
  loadAllQuestionIds: vi.fn().mockResolvedValue([]),
  loadQuestionAnswerBreakdown: vi.fn().mockResolvedValue(null),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

const makePage = () => ({
  total: 3,
  items: Array.from({ length: 3 }, (_, i) => ({
    id: `q${i}`,
    question: `Question ${i}`,
    domain: "Cardiologie",
    objectifCMC: "OBJ",
    options: ["A", "B", "C", "D"],
    createdAt: 0,
    imageCount: 0,
    usageCount: 0,
    answerCount: 0,
    successRate: null,
  })),
})

const makeDetail = (id: string) => ({
  id,
  question: `Énoncé complet ${id}`,
  options: ["A", "B", "C", "D"],
  correctAnswer: "B",
  objectifCMC: "OBJ",
  domain: "Cardiologie",
  createdAt: 0,
  explanation: `Explication de ${id}`,
  references: [`Référence de ${id}`],
  images: [],
  explanationImages: [],
})

const openPreview = (index: number) =>
  fireEvent.click(
    screen.getAllByRole("button", { name: "Prévisualiser la question" })[index],
  )

const closeModal = () =>
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }))

beforeEach(() => {
  loadQuestionsPage.mockReset()
  loadQuestionsPage.mockResolvedValue(makePage())
  loadQuestionById.mockReset()
  loadQuestionById.mockImplementation((id: string) =>
    Promise.resolve(makeDetail(id)),
  )
  deleteQuestion.mockReset()
  toast.success.mockReset()
  toast.error.mockReset()
})

describe("Modale de question — constitution d'examen", () => {
  const renderSelect = () =>
    render(
      <QuestionBrowser
        mode="select"
        maxSelection={2}
        renderPanel={({ questionId, onClose }) => (
          <QuestionSelectModal
            questionId={questionId}
            open={!!questionId}
            onOpenChange={(open) => !open && onClose()}
          />
        )}
      />,
    )

  const counter = () => screen.getByText(/\d+ \/ 2 questions/)

  it("ajouter puis retirer depuis la modale met à jour la sélection et son compteur", async () => {
    renderSelect()
    await screen.findByText("Question 0")
    openPreview(0)
    await screen.findByText("Énoncé complet q0")

    expect(screen.getByText("0 sur 2 sélectionnées")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ajouter à l'examen" }))
    expect(counter()).toHaveTextContent("1 / 2 questions")
    expect(screen.getByText("1 sur 2 sélectionnées")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retirer de l'examen" }))
    expect(counter()).toHaveTextContent("0 / 2 questions")
    expect(screen.getByText("0 sur 2 sélectionnées")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Ajouter à l'examen" }),
    ).toBeEnabled()
  })

  it("tant que la question charge, ajouter est désactivé", async () => {
    loadQuestionById.mockReturnValue(new Promise(() => {}))
    renderSelect()
    await screen.findByText("Question 0")
    openPreview(0)

    const add = await screen.findByRole("button", {
      name: "Ajouter à l'examen",
    })
    expect(add).toBeDisabled()
  })

  it("au quota, ajouter est désactivé mais retirer reste possible", async () => {
    renderSelect()
    await screen.findByText("Question 0")
    const checkboxes = screen.getAllByRole("checkbox", {
      name: "Sélectionner la question",
    })
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    openPreview(2)
    await screen.findByText("Énoncé complet q2")
    fireEvent.click(screen.getByRole("button", { name: "Ajouter à l'examen" }))
    expect(
      screen.getByRole("button", { name: "Ajouter à l'examen" }),
    ).toBeDisabled()
    expect(counter()).toHaveTextContent("2 / 2 questions")

    closeModal()
    openPreview(0)
    await screen.findByText("Énoncé complet q0")
    fireEvent.click(screen.getByRole("button", { name: "Retirer de l'examen" }))
    expect(counter()).toHaveTextContent("1 / 2 questions")
  })

  it("un échec de chargement propose de réessayer, puis rend les actions", async () => {
    loadQuestionById.mockRejectedValueOnce(new Error("Failed to fetch"))
    renderSelect()
    await screen.findByText("Question 0")
    openPreview(0)

    await screen.findByText("Chargement impossible")
    expect(screen.queryByText("Question non trouvée")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Ajouter à l'examen" }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await screen.findByText("Énoncé complet q0")
    expect(loadQuestionById).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole("button", { name: "Ajouter à l'examen" }),
    ).toBeEnabled()
  })

  it("l'explication et les références sont repliées à l'ouverture de chaque question", async () => {
    renderSelect()
    await screen.findByText("Question 0")
    openPreview(0)
    await screen.findByText("Énoncé complet q0")

    expect(screen.queryByText("Explication de q0")).not.toBeInTheDocument()
    expect(screen.queryByText("Référence de q0")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Explication/ }))
    fireEvent.click(screen.getByRole("button", { name: /Références/ }))
    expect(screen.getByText("Explication de q0")).toBeInTheDocument()
    expect(screen.getByText("Référence de q0")).toBeInTheDocument()

    closeModal()
    openPreview(0)
    await screen.findByText("Énoncé complet q0")
    expect(screen.queryByText("Explication de q0")).not.toBeInTheDocument()

    closeModal()
    openPreview(1)
    await screen.findByText("Énoncé complet q1")
    expect(screen.queryByText("Explication de q1")).not.toBeInTheDocument()
    expect(screen.queryByText("Référence de q1")).not.toBeInTheDocument()
  })
})

describe("Modale de question — navigateur de questions", () => {
  const renderManage = (onDeleted = vi.fn()) => {
    render(
      <QuestionBrowser
        mode="browse"
        renderPanel={({ questionId, onClose }) => (
          <QuestionManageModal
            questionId={questionId}
            open={!!questionId}
            onOpenChange={(open) => !open && onClose()}
            onDeleted={onDeleted}
          />
        )}
      />,
    )
    return { onDeleted }
  }

  it("Modifier mène à l'édition de la question ouverte", async () => {
    renderManage()
    await screen.findByText("Question 0")
    openPreview(1)
    await screen.findByText("Énoncé complet q1")

    expect(screen.getByRole("link", { name: /Modifier/ })).toHaveAttribute(
      "href",
      "/admin/questions/q1/modifier",
    )
  })

  it("Supprimer demande confirmation avant de supprimer", async () => {
    deleteQuestion.mockResolvedValue({ success: true, mode: "hard" })
    const { onDeleted } = renderManage()
    await screen.findByText("Question 0")
    openPreview(0)
    await screen.findByText("Énoncé complet q0")

    fireEvent.click(screen.getByRole("button", { name: /Supprimer/ }))
    expect(deleteQuestion).not.toHaveBeenCalled()
    await screen.findByText("Supprimer cette question ?")

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(deleteQuestion).toHaveBeenCalledWith("q0")
  })

  it("tant que la question charge, Supprimer est désactivé", async () => {
    loadQuestionById.mockReturnValue(new Promise(() => {}))
    renderManage()
    await screen.findByText("Question 0")
    openPreview(0)

    expect(
      await screen.findByRole("button", { name: /Supprimer/ }),
    ).toBeDisabled()
  })

  it("la confirmation affiche un spinner pendant la suppression", async () => {
    deleteQuestion.mockReturnValue(new Promise(() => {}))
    renderManage()
    await screen.findByText("Question 0")
    openPreview(0)
    await screen.findByText("Énoncé complet q0")

    fireEvent.click(screen.getByRole("button", { name: /Supprimer/ }))
    await screen.findByText("Supprimer cette question ?")
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))

    const confirm = await screen.findByRole("button", {
      name: /Suppression/,
    })
    expect(confirm).toBeDisabled()
    expect(within(confirm).getByRole("status")).toBeInTheDocument()
  })

  it("une question introuvable n'offre aucune action", async () => {
    loadQuestionById.mockResolvedValue(null)
    renderManage()
    await screen.findByText("Question 0")
    openPreview(0)

    await screen.findByText("Question non trouvée")
    expect(
      screen.queryByRole("button", { name: /Supprimer/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /Modifier/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Réessayer" }),
    ).not.toBeInTheDocument()
  })

  it("Échap ne ferme pas la confirmation pendant la suppression", async () => {
    deleteQuestion.mockReturnValue(new Promise(() => {}))
    renderManage()
    await screen.findByText("Question 0")
    openPreview(0)
    await screen.findByText("Énoncé complet q0")

    fireEvent.click(screen.getByRole("button", { name: /Supprimer/ }))
    await screen.findByText("Supprimer cette question ?")
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    await screen.findByRole("button", { name: /Suppression/ })

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" })
    expect(screen.getByText("Supprimer cette question ?")).toBeInTheDocument()
  })

  it("Copier l'ID n'annonce un succès que si la copie réussit", async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    renderManage()
    await screen.findByText("Question 0")
    openPreview(0)
    await screen.findByText("Énoncé complet q0")

    writeText.mockRejectedValueOnce(new Error("NotAllowedError"))
    fireEvent.click(screen.getByRole("button", { name: "Copier l'ID" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()

    writeText.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole("button", { name: "Copier l'ID" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("ID copié"))
  })
})
