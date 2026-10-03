import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QuestionDetailClient } from "@/app/(admin)/admin/questions/[questionId]/_components/question-detail-client"
import { DEFAULT_QUESTION_LIST } from "@/app/(admin)/admin/questions/_components/question-params"
import type { QuestionFile } from "@/components/admin/question-detail/question-detail-content"

const { push, refresh, deleteQuestion, confirmQuestionKey, toast } = vi.hoisted(
  () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    deleteQuestion: vi.fn(),
    confirmQuestionKey: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
  }),
)
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh }),
}))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/features/questions/actions", () => ({
  deleteQuestion,
  confirmQuestionKey,
}))

const NOW = Date.UTC(2026, 8, 30, 14)

const file: QuestionFile = {
  question: {
    id: "q1",
    question: "Énoncé",
    options: ["A", "B", "C", "D"],
    correctAnswer: "B",
    objectifCMC: "Toux",
    objectiveId: "obj-toux",
    objectiveNeedsFix: false,
    domain: "Pneumologie",
    createdAt: NOW,
    updatedAt: NOW,
    explanation: "Parce que.",
    references: [],
    images: [],
    explanationImages: [],
    keyConfirmation: null,
  },
  breakdown: {
    answerCount: 10,
    successRate: 30,
    options: [
      { option: "A", count: 6, share: 60, isKey: false },
      { option: "B", count: 3, share: 30, isKey: true },
      { option: "C", count: 1, share: 10, isKey: false },
      { option: "D", count: 0, share: 0, isKey: false },
    ],
    formerWording: { count: 0, share: 0 },
    keySuspect: true,
  },
  review: { toVerify: true, confirmation: null, lapsedConfirmation: null },
  exams: [],
  formatIssues: [],
}

const renderDetail = (
  over: Partial<Parameters<typeof QuestionDetailClient>[0]> = {},
) =>
  render(
    <QuestionDetailClient
      file={file}
      list={{ ...DEFAULT_QUESTION_LIST, tab: "toVerify" }}
      neighbors={{ position: 21, total: 39, previousId: "q0", nextId: null }}
      lockingExam={null}
      initialNow={NOW}
      {...over}
    />,
  )

afterEach(() => vi.clearAllMocks())

describe("QuestionDetailClient", () => {
  it("précédente / suivante à travers les pages de la liste filtrée", () => {
    renderDetail()
    expect(screen.getByTestId("question-position")).toHaveTextContent(
      "21 sur 39",
    )
    expect(
      screen.getByRole("link", { name: "Question précédente" }),
    ).toHaveAttribute("href", "/admin/questions/q0?onglet=cle-a-verifier")
    expect(
      screen.getByRole("button", { name: "Question suivante" }),
    ).toBeDisabled()
  })

  it("hors de la liste filtrée : boutons désactivés", () => {
    renderDetail({ neighbors: null })
    expect(screen.getByText("Hors de la liste filtrée")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Question précédente" }),
    ).toBeDisabled()
  })

  it("choix figés : rappel de l'examen ouvert", () => {
    renderDetail({
      lockingExam: {
        id: "e1",
        title: "Examen blanc 26",
        startDate: NOW,
        endDate: Date.UTC(2026, 9, 3, 12),
        finalizedAt: NOW,
        isActive: true,
      },
    })
    expect(
      screen.getByText(/Dans l'examen ouvert « Examen blanc 26 »/),
    ).toHaveTextContent("verrouillés jusqu'au 3 octobre 2026")
  })

  it("supprimer : archivée, toast, retour à la liste quittée", async () => {
    deleteQuestion.mockResolvedValue({ success: true, mode: "soft" })
    renderDetail()
    fireEvent.click(screen.getByTestId("btn-delete-question"))
    expect(screen.getByText(/Elle sera archivée/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("btn-delete-question-confirm"))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/admin/questions?onglet=cle-a-verifier",
      ),
    )
    expect(toast.success).toHaveBeenCalledWith(
      "Question archivée : elle ne sera plus tirée",
    )
  })

  it("confirmer la clé : note, action, rafraîchissement", async () => {
    confirmQuestionKey.mockResolvedValue({ success: true })
    renderDetail()
    fireEvent.click(screen.getByTestId("btn-confirm-key"))
    fireEvent.change(screen.getByLabelText(/Pourquoi la clé est juste/), {
      target: { value: "Piège classique" },
    })
    expect(screen.getByText("15 / 500")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("btn-confirm-key-submit"))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(confirmQuestionKey).toHaveBeenCalledWith({
      id: "q1",
      note: "Piège classique",
    })
    expect(toast.success).toHaveBeenCalledWith("Clé confirmée", undefined)
  })

  it("confirmée, la question propose d'enchaîner sur la suivante", async () => {
    confirmQuestionKey.mockResolvedValue({ success: true })
    renderDetail({
      neighbors: { position: 21, total: 39, previousId: "q0", nextId: "q2" },
    })
    fireEvent.click(screen.getByTestId("btn-confirm-key"))
    fireEvent.click(screen.getByTestId("btn-confirm-key-submit"))

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const options = toast.success.mock.calls[0][1] as {
      action: { label: string; onClick: () => void }
    }
    expect(options.action.label).toBe("Question suivante")
    options.action.onClick()
    expect(push).toHaveBeenCalledWith(
      "/admin/questions/q2?onglet=cle-a-verifier&page=2",
    )
  })

  it("une note trop longue bloque la confirmation", () => {
    renderDetail()
    fireEvent.click(screen.getByTestId("btn-confirm-key"))
    fireEvent.change(screen.getByLabelText(/Pourquoi la clé est juste/), {
      target: { value: "x".repeat(501) },
    })
    expect(screen.getByText("500 caractères au plus.")).toBeInTheDocument()
    expect(screen.getByTestId("btn-confirm-key-submit")).toBeDisabled()
  })
})
