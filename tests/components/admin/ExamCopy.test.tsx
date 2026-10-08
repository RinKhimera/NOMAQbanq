import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  type CopyAnswer,
  copyRows,
  matchesFilter,
} from "@/app/(admin)/admin/examens/[id]/resultats/[userId]/_components/copy-model"
import { ExamCopyClient } from "@/app/(admin)/admin/examens/[id]/resultats/[userId]/_components/exam-copy-client"
import type { QuizQuestion } from "@/components/quiz/runner/types"

const { deleteParticipation, loadExamQuestionExplanations, push } = vi.hoisted(
  () => ({
    deleteParticipation: vi.fn(),
    loadExamQuestionExplanations: vi.fn(),
    push: vi.fn(),
  }),
)

vi.mock("@/features/exams/actions", () => ({
  deleteParticipation,
  loadExamQuestionExplanations,
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

const question = (id: string, domain: string): QuizQuestion =>
  ({
    _id: id,
    question: `Énoncé ${id}`,
    options: ["Un", "Deux", "Trois", "Quatre"],
    correctAnswer: "Trois",
    domain,
    objectifCMC: "Objectif",
    images: [],
  }) as unknown as QuizQuestion

const questions = [
  question("q1", "Cardiologie"),
  question("q2", "Pédiatrie"),
  question("q3", "Psychiatrie"),
  question("q4", "Chirurgie"),
]

const answers: CopyAnswer[] = [
  {
    questionId: "q1",
    selectedAnswer: "Trois",
    isCorrect: true,
    isFlagged: false,
  },
  {
    questionId: "q2",
    selectedAnswer: "Deux",
    isCorrect: false,
    isFlagged: true,
  },
  { questionId: "q3", selectedAnswer: null, isCorrect: null, isFlagged: true },
  {
    questionId: "q4",
    selectedAnswer: "Texte d'avant",
    isCorrect: false,
    isFlagged: false,
  },
]

describe("copyRows", () => {
  const rows = copyRows(questions, answers)

  it("résume chaque réponse par lettres", () => {
    expect(rows.map((r) => r.summary)).toEqual([
      "Bonne réponse · C",
      "A répondu B · bonne réponse C",
      "Sans réponse · bonne réponse C",
      "A répondu un choix modifié depuis · bonne réponse C",
    ])
  })

  it("« Incorrectes » compte les questions sans réponse ; « Marquées » suit la marque", () => {
    expect(
      rows.filter((r) => matchesFilter(r, "wrong")).map((r) => r.number),
    ).toEqual([2, 3, 4])
    expect(
      rows.filter((r) => matchesFilter(r, "flagged")).map((r) => r.number),
    ).toEqual([2, 3])
  })
})

const renderCopy = (status: "completed" | "auto_submitted" = "completed") => {
  render(
    <ExamCopyClient
      exam={{ id: "exam-1", title: "Examen blanc 25" }}
      participant={{
        participationId: "part-1",
        name: "Karim Haddad",
        image: null,
        score: 25,
        completedAt: Date.parse("2026-09-21T20:42:00Z"),
        status,
        answers,
      }}
      questions={questions}
      rank={{ rank: 2, total: 71 }}
    />,
  )
  return userEvent.setup()
}

describe("ExamCopyClient", () => {
  it("en-tête : rang, heure de soumission et compteurs", () => {
    renderCopy()

    expect(screen.getByTestId("copy-rank")).toHaveTextContent("Rang 2 sur 71")
    expect(screen.getByTestId("copy-submitted-at")).toHaveTextContent(
      "soumise le 21 sept. à 16 h 42",
    )
    expect(screen.getByTestId("copy-correct")).toHaveTextContent("1")
    expect(screen.getByTestId("copy-incorrect")).toHaveTextContent("2")
    expect(screen.getByTestId("copy-unanswered")).toHaveTextContent("1")
  })

  it("signale une soumission automatique", () => {
    renderCopy("auto_submitted")

    expect(screen.getByTestId("copy-auto-submitted")).toBeInTheDocument()
    expect(screen.queryByTestId("copy-submitted-at")).toBeNull()
  })

  it("filtre les réponses marquées", async () => {
    const user = renderCopy()

    await user.click(screen.getByTestId("copy-filter-flagged"))

    expect(screen.queryByTestId("copy-row-1")).toBeNull()
    expect(screen.getByTestId("copy-row-2")).toBeInTheDocument()
    expect(screen.getByTestId("copy-row-3")).toBeInTheDocument()
  })

  it("déplie la question et charge son explication", async () => {
    loadExamQuestionExplanations.mockResolvedValue([
      { questionId: "q2", explanation: "Parce que.", explanationImages: [] },
    ])
    const user = renderCopy()

    await user.click(screen.getByRole("button", { name: /Pédiatrie/ }))

    expect(loadExamQuestionExplanations).toHaveBeenCalledWith(["q2"])
    expect(await screen.findByText("Parce que.")).toBeInTheDocument()
  })

  it("supprime la participation puis revient à la fiche", async () => {
    deleteParticipation.mockResolvedValue({ success: true })
    const user = renderCopy()

    await user.click(screen.getByTestId("btn-delete-participation"))
    expect(
      screen.getByText(
        "Karim Haddad pourra repasser Examen blanc 25 tant qu'il est ouvert. Ses réponses et son score sont effacés, et le classement est recalculé.",
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByTestId("btn-delete-participation-confirm"))

    expect(deleteParticipation).toHaveBeenCalledWith({
      participationId: "part-1",
    })
    expect(push).toHaveBeenCalledWith("/admin/examens/exam-1")
  })
})
