import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ParticipantExamResultsView } from "@/components/quiz/results/participant-exam-results-view"
import type {
  ExamParticipantUser,
  ExamQuestionView,
} from "@/features/exams/dal"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const { loadExplanationsMock } = vi.hoisted(() => ({
  loadExplanationsMock: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/features/exams/actions", () => ({
  loadExamQuestionExplanations: loadExplanationsMock,
}))

vi.mock("@/hooks/use-is-visible", () => ({
  useIsVisible: () => ({ ref: { current: null }, isVisible: true }),
}))

// Enfants lourds stubes : on teste la logique de la vue resultats, pas eux.
vi.mock("@/components/quiz/question-card", () => ({
  QuestionCard: ({ questionNumber }: { questionNumber: number }) => (
    <div data-testid="question-card">Q{questionNumber}</div>
  ),
}))
vi.mock("@/components/quiz/results", () => ({
  ResultsQuestionNavigator: () => <div data-testid="results-navigator" />,
}))
vi.mock("@/components/quiz/session/session-toolbar", () => ({
  SessionToolbar: () => <div data-testid="session-toolbar" />,
}))

const makeQuestion = (id: string): ExamQuestionView => ({
  _id: id,
  _creationTime: 1_700_000_000_000,
  question: `Question ${id}`,
  options: ["A", "B", "C", "D"],
  objectifCMC: "Objectif 1",
  domain: "Cardiologie",
  images: [],
  correctAnswer: "A",
})

const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")]

// q1 correcte, q2 incorrecte, q3 sans reponse.
const answers = [
  { questionId: "q1", selectedAnswer: "A", isCorrect: true },
  { questionId: "q2", selectedAnswer: "B", isCorrect: false },
]

const baseProps = {
  examTitle: "Examen blanc 1",
  questions,
  answers,
  backHref: "/dashboard",
  backLabel: "Retour",
  backIcon: <span data-testid="back-icon" />,
}

describe("ParticipantExamResultsView", () => {
  beforeEach(() => {
    loadExplanationsMock.mockClear()
  })

  it("affiche un score reussi (>= 60) avec les compteurs", async () => {
    render(<ParticipantExamResultsView {...baseProps} score={80} />)
    expect(screen.getByTestId("score-percentage").textContent).toContain("80%")
    expect(screen.getByTestId("score-badge").textContent).toContain("Réussi")
    expect(screen.getByText("Sans réponse")).toBeInTheDocument()
    expect(screen.getAllByTestId("question-card")).toHaveLength(3)
    // lazy-load des explications de la question depliee au montage
    await waitFor(() => expect(loadExplanationsMock).toHaveBeenCalled())
  })

  it("affiche un score a ameliorer (< 60)", () => {
    render(<ParticipantExamResultsView {...baseProps} score={40} />)
    expect(screen.getByTestId("score-badge").textContent).toContain(
      "À améliorer",
    )
  })

  it("rend la vue admin avec la carte participant", () => {
    const participantUser: ExamParticipantUser = {
      id: "u1",
      name: "Alice Martin",
      username: "alice",
      email: "alice@example.com",
      image: null,
    }
    const { container } = render(
      <ParticipantExamResultsView
        {...baseProps}
        score={70}
        participantUser={participantUser}
      />,
    )
    expect(container.textContent).toContain("Résultats de Alice Martin")
    expect(container.textContent).toContain("Participant")
  })

  it("exerce deplier/replier et le filtre 'erreurs uniquement'", async () => {
    render(<ParticipantExamResultsView {...baseProps} score={80} />)
    fireEvent.click(screen.getByText("Tout déplier"))
    await waitFor(() => expect(loadExplanationsMock).toHaveBeenCalled())
    fireEvent.click(screen.getByText("Tout replier"))
    fireEvent.click(screen.getByTestId("btn-filter-incorrect"))
    // q2 (incorrecte) + q3 (sans reponse) restent ; q1 (correcte) est masquee
    expect(screen.getAllByTestId("question-card")).toHaveLength(2)
  })
})
