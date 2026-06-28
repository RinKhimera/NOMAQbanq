import { fireEvent, render, screen } from "@testing-library/react"
import { type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { SessionResults } from "@/components/quiz/results/session-results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/hooks/use-is-visible", () => ({
  useIsVisible: () => ({ ref: { current: null }, isVisible: true }),
}))

vi.mock("@/components/quiz/question-card", () => ({
  QuestionCard: ({
    questionNumber,
    userAnswer,
  }: {
    questionNumber: number
    userAnswer: string | null
  }) => (
    <div data-testid="question-card" data-user-answer={userAnswer ?? "none"}>
      Q{questionNumber}
    </div>
  ),
}))

vi.mock("@/components/quiz/results", () => ({
  ResultsQuestionNavigator: ({
    questionResults,
  }: {
    questionResults: { isCorrect: boolean; isAnswered: boolean }[]
  }) => (
    <div
      data-testid="results-navigator"
      data-unanswered={questionResults.filter((r) => !r.isAnswered).length}
    />
  ),
}))

vi.mock("@/components/quiz/session/session-toolbar", () => ({
  SessionToolbar: () => <div data-testid="session-toolbar" />,
}))

// ============================================
// Fixtures
// ============================================

const makeQuestion = (id: string): QuizQuestion => ({
  _id: id,
  question: `Question ${id}`,
  options: ["A", "B", "C", "D"],
  images: [],
  correctAnswer: "A",
})

const questions: QuizQuestion[] = [
  makeQuestion("q1"),
  makeQuestion("q2"),
  makeQuestion("q3"),
]

// Dense answers map: q1 correct, q2 incorrect, q3 absent (unanswered)
const denseAnswers: AnswersMap = {
  q1: { selected: "A", isCorrect: true },
  q2: { selected: "B", isCorrect: false },
}

const baseSummary = {
  score: 33,
  correct: 1,
  incorrect: 1,
  unanswered: 1,
}

// ============================================
// Tests
// ============================================

describe("SessionResults", () => {
  describe("score card", () => {
    it("affiche le score et les compteurs", () => {
      render(
        <SessionResults
          accent="blue"
          summary={baseSummary}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("score-percentage").textContent).toContain(
        "33%",
      )
      expect(screen.getByText("Sans réponse")).toBeInTheDocument()
      expect(screen.getAllByTestId("question-card")).toHaveLength(3)
    })

    it("affiche 'Réussi' pour un score >= 60", () => {
      render(
        <SessionResults
          accent="blue"
          summary={{ score: 80, correct: 4, incorrect: 1, unanswered: 0 }}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("score-badge").textContent).toBe("Réussi")
    })

    it("affiche 'À améliorer' pour un score < 60", () => {
      render(
        <SessionResults
          accent="blue"
          summary={baseSummary}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("score-badge").textContent).toBe("À améliorer")
    })

    it("n'affiche pas le bloc 'Sans réponse' si unanswered === 0", () => {
      render(
        <SessionResults
          accent="emerald"
          summary={{ score: 100, correct: 3, incorrect: 0, unanswered: 0 }}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.queryByText("Sans réponse")).not.toBeInTheDocument()
    })
  })

  describe("filtres", () => {
    it("le filtre 'Erreurs' masque les correctes et conserve incorrectes + non répondues", () => {
      render(
        <SessionResults
          accent="blue"
          summary={baseSummary}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      fireEvent.click(screen.getByTestId("btn-filter-errors"))
      // q1 (correcte) masquée → 2 cartes restantes (q2 incorrecte + q3 non répondue)
      expect(screen.getAllByTestId("question-card")).toHaveLength(2)
    })

    it("tout déplier / tout replier", () => {
      render(
        <SessionResults
          accent="blue"
          summary={baseSummary}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      fireEvent.click(screen.getByText("Tout déplier"))
      fireEvent.click(screen.getByText("Tout replier"))
      // pas d'erreur — juste vérifier que ça ne plante pas
      expect(screen.getAllByTestId("question-card")).toHaveLength(3)
    })
  })

  describe("carte participant (vue admin)", () => {
    it("affiche le nom et l'email du participant", () => {
      render(
        <SessionResults
          accent="blue"
          summary={baseSummary}
          questions={questions}
          answers={denseAnswers}
          participant={{
            name: "Alice Martin",
            email: "alice@example.com",
            image: null,
          }}
        />,
      )
      expect(screen.getByText("Résultats de Alice Martin")).toBeInTheDocument()
      expect(screen.getByText("alice@example.com")).toBeInTheDocument()
      expect(screen.getByText("Participant")).toBeInTheDocument()
    })

    it("n'affiche pas la carte participant quand absent", () => {
      render(
        <SessionResults
          accent="blue"
          summary={baseSummary}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.queryByText("Participant")).not.toBeInTheDocument()
    })
  })

  describe("C1 Step 1b — compat données historiques (answers clairsemées)", () => {
    /**
     * Older exam participations only had examAnswers rows for ANSWERED questions.
     * The "answers" map is sparse: some question IDs are absent.
     * This test verifies the component treats absent entries as "unanswered".
     */
    it("traite les questions absentes de answers comme 'non répondues'", () => {
      const sparseAnswers: AnswersMap = {
        // Only q1 is answered; q2 and q3 are absent (no key at all)
        q1: { selected: "A", isCorrect: true },
      }

      render(
        <SessionResults
          accent="blue"
          summary={{ score: 33, correct: 1, incorrect: 0, unanswered: 2 }}
          questions={questions}
          answers={sparseAnswers}
        />,
      )

      // All 3 questions should render
      expect(screen.getAllByTestId("question-card")).toHaveLength(3)

      // "Sans réponse" block shown because unanswered > 0
      expect(screen.getByText("Sans réponse")).toBeInTheDocument()
    })

    it("le navigateur reçoit le bon compte de non-répondues (sparse)", () => {
      const sparseAnswers: AnswersMap = {
        q1: { selected: "A", isCorrect: true },
        // q2 and q3 absent
      }

      render(
        <SessionResults
          accent="blue"
          summary={{ score: 33, correct: 1, incorrect: 0, unanswered: 2 }}
          questions={questions}
          answers={sparseAnswers}
        />,
      )

      // The navigator stub renders data-unanswered from the questionResults passed to it
      const navigators = screen.getAllByTestId("results-navigator")
      // At least one navigator should report 2 unanswered
      const unansweredCounts = navigators.map((n) =>
        Number(n.getAttribute("data-unanswered")),
      )
      expect(unansweredCounts.some((c) => c === 2)).toBe(true)
    })

    it("traite les entrées avec selected vide comme 'non répondues'", () => {
      const answersWithEmptySelected: AnswersMap = {
        q1: { selected: "A", isCorrect: true },
        q2: { selected: "", isCorrect: false }, // empty selected = unanswered
        // q3 absent
      }

      render(
        <SessionResults
          accent="blue"
          summary={{ score: 33, correct: 1, incorrect: 0, unanswered: 2 }}
          questions={questions}
          answers={answersWithEmptySelected}
        />,
      )

      const navigators = screen.getAllByTestId("results-navigator")
      const unansweredCounts = navigators.map((n) =>
        Number(n.getAttribute("data-unanswered")),
      )
      // q2 (empty selected) + q3 (absent) = 2 unanswered
      expect(unansweredCounts.some((c) => c === 2)).toBe(true)
    })
  })
})
