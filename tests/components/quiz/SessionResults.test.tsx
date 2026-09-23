import { fireEvent, render, screen } from "@testing-library/react"
import { type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  SessionResults,
  SessionResultsHeader,
} from "@/components/quiz/results/session-results"
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
    onNavigateToQuestion,
  }: {
    questionResults: {
      isCorrect: boolean
      isAnswered: boolean
      isWithheld?: boolean
    }[]
    onNavigateToQuestion: (index: number) => void
  }) => (
    <div
      data-testid="results-navigator"
      data-unanswered={questionResults.filter((r) => !r.isAnswered).length}
      data-withheld={questionResults.filter((r) => r.isWithheld).length}
    >
      {questionResults.map((_, i) => (
        <button
          key={i}
          data-testid={`nav-${i}`}
          onClick={() => onNavigateToQuestion(i)}
        />
      ))}
    </div>
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
  domain: "Cardiologie",
  objectifCMC: "Obj",
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

// ============================================
// Tests
// ============================================

describe("SessionResults", () => {
  describe("compteurs dérivés des réponses", () => {
    it("compte justes, fausses et sans réponse à partir de questions + answers", () => {
      render(
        <SessionResults
          accent="blue"
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("stat-correct").textContent).toBe("1")
      expect(screen.getByTestId("stat-incorrect").textContent).toBe("1")
      expect(screen.getByTestId("stat-unanswered").textContent).toBe("1")
      expect(screen.queryByTestId("stat-withheld")).not.toBeInTheDocument()
    })
  })

  describe("correction différée (clé retenue par un examen ouvert)", () => {
    const withheldQuestions: QuizQuestion[] = [
      makeQuestion("q1"),
      { ...makeQuestion("q2"), correctAnswer: undefined, keyWithheld: true },
      makeQuestion("q3"),
    ]
    // q1 juste · q2 répondue mais clé retenue (pas d'isCorrect) · q3 absente
    const withheldAnswers: AnswersMap = {
      q1: { selected: "A", isCorrect: true },
      q2: { selected: "B" },
    }

    it("une réponse à clé retenue n'est ni juste ni fausse : tuile « Différées »", () => {
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      expect(screen.getByTestId("stat-correct").textContent).toBe("1")
      expect(screen.getByTestId("stat-incorrect").textContent).toBe("0")
      expect(screen.getByTestId("stat-withheld").textContent).toBe("1")
      expect(screen.getByTestId("stat-unanswered").textContent).toBe("1")
      expect(screen.getByText("Différées")).toBeInTheDocument()
    })

    it("le filtre « Erreurs » ne retient pas une réponse à clé retenue", () => {
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      fireEvent.click(screen.getByTestId("btn-filter-errors"))
      const cards = screen.getAllByTestId("question-card")
      expect(cards).toHaveLength(1)
      expect(cards[0].textContent).toBe("Q3")
    })

    it("« X sur N réussies » compte les questions corrigeables, pas les différées", () => {
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      expect(screen.getByText("1 sur 2 questions réussies")).toBeInTheDocument()
    })

    it("ne demande pas l'explication d'une question à clé retenue", async () => {
      const loadExplanations = vi.fn<(ids: string[]) => Promise<never[]>>(
        async () => [],
      )
      render(
        <SessionResults
          accent="blue"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
          loadExplanations={loadExplanations}
        />,
      )
      fireEvent.click(screen.getByTestId("btn-expand-all"))
      await vi.waitFor(() => expect(loadExplanations).toHaveBeenCalled())
      for (const ids of loadExplanations.mock.calls.map((c) => c[0])) {
        expect(ids).not.toContain("q2")
      }
    })

    it("le navigateur reçoit le marqueur « différée »", () => {
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      const counts = screen
        .getAllByTestId("results-navigator")
        .map((n) => Number(n.getAttribute("data-withheld")))
      expect(counts.some((c) => c === 1)).toBe(true)
    })

    // Le score en base agrège TOUTES les réponses : « score × N / 100 −
    // justes affichées » donnerait le nombre de différées justes. Tant qu'une
    // réponse est différée, le pourcentage et le badge sont retenus.
    it("retient le score : ni pourcentage ni badge tant qu'une réponse est différée", () => {
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      expect(screen.queryByTestId("score-percentage")).not.toBeInTheDocument()
      expect(screen.queryByTestId("score-badge")).not.toBeInTheDocument()
      expect(screen.queryByTestId("score-progress")).not.toBeInTheDocument()
      expect(screen.getByTestId("score-withheld").textContent).toBe(
        "Score disponible après la clôture de l'examen",
      )
      expect(screen.getByText("1 sur 2 questions réussies")).toBeInTheDocument()
    })

    it("jumeau admin : mêmes réponses sans clé retenue → pourcentage et badge affichés", () => {
      const revealedQuestions = withheldQuestions.map((q) => ({
        ...q,
        keyWithheld: undefined,
        correctAnswer: "A",
      }))
      const revealedAnswers: AnswersMap = {
        ...withheldAnswers,
        q2: { selected: "B", isCorrect: false },
      }
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={revealedQuestions}
          answers={revealedAnswers}
        />,
      )
      expect(screen.getByTestId("score-percentage").textContent).toContain(
        "33%",
      )
      expect(screen.getByTestId("score-badge")).toBeInTheDocument()
      expect(screen.getByTestId("score-progress")).toBeInTheDocument()
      expect(screen.queryByTestId("score-withheld")).not.toBeInTheDocument()
    })

    it("une question à clé retenue SANS réponse ne retient pas le score", () => {
      render(
        <SessionResults
          accent="emerald"
          score={33}
          questions={withheldQuestions}
          answers={{ q1: { selected: "A", isCorrect: true } }}
        />,
      )
      expect(screen.getByTestId("score-percentage").textContent).toContain(
        "33%",
      )
      expect(screen.queryByTestId("score-withheld")).not.toBeInTheDocument()
    })

    it("un score `null` (retenu par la page) est retenu même sans marqueur sur les questions", () => {
      render(
        <SessionResults
          accent="blue"
          score={null}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.queryByTestId("score-percentage")).not.toBeInTheDocument()
      expect(screen.getByTestId("score-withheld")).toBeInTheDocument()
    })
  })

  describe("SessionResultsHeader", () => {
    const headerProps = {
      title: "Résultats",
      backHref: "/",
      backLabel: "Retour",
      backIcon: null,
    }

    it("score retenu : statut neutre, ni trophée ni cible", () => {
      render(<SessionResultsHeader {...headerProps} score={null} />)
      expect(screen.getByTestId("score-status").dataset.status).toBe("withheld")
    })

    it("jumeau : sans retenue, le statut suit le seuil de réussite", () => {
      const { unmount } = render(
        <SessionResultsHeader {...headerProps} score={80} />,
      )
      expect(screen.getByTestId("score-status").dataset.status).toBe("passing")
      unmount()
      render(<SessionResultsHeader {...headerProps} score={33} />)
      expect(screen.getByTestId("score-status").dataset.status).toBe("failing")
    })

    it("situe le participant parmi les autres quand le percentile existe", () => {
      render(
        <SessionResultsHeader {...headerProps} score={70} percentile={75} />,
      )
      expect(screen.getByTestId("exam-percentile")).toHaveTextContent(
        "Vous avez fait mieux que 75 % des autres participants",
      )
    })

    it("parle du participant, pas du lecteur, quand un admin consulte ses résultats", () => {
      render(
        <SessionResultsHeader
          {...headerProps}
          score={70}
          percentile={75}
          percentileSubject="participant"
        />,
      )
      expect(screen.getByTestId("exam-percentile")).toHaveTextContent(
        "A fait mieux que 75 % des autres participants",
      )
    })

    it("jumeau : sans percentile, aucune position ni « 0 % »", () => {
      render(
        <SessionResultsHeader {...headerProps} score={70} percentile={null} />,
      )
      expect(screen.queryByTestId("exam-percentile")).toBeNull()
    })
  })

  describe("score card", () => {
    it("affiche le score et les compteurs", () => {
      render(
        <SessionResults
          accent="blue"
          score={33}
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
          score={80}
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
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("score-badge").textContent).toBe("À améliorer")
    })

    it("n'affiche pas le bloc 'Sans réponse' si tout est répondu", () => {
      render(
        <SessionResults
          accent="emerald"
          score={100}
          questions={questions}
          answers={{ ...denseAnswers, q3: { selected: "A", isCorrect: true } }}
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
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      fireEvent.click(screen.getByTestId("btn-filter-errors"))
      // q1 (correcte) masquée → 2 cartes restantes (q2 incorrecte + q3 non répondue)
      expect(screen.getAllByTestId("question-card")).toHaveLength(2)
    })

    describe("navigation vers une question", () => {
      const scrollIntoView = vi.fn<Element["scrollIntoView"]>()
      const original = Element.prototype.scrollIntoView

      beforeEach(() => {
        Element.prototype.scrollIntoView = scrollIntoView
        vi.stubGlobal(
          "ResizeObserver",
          class {
            observe() {}
            disconnect() {}
          },
        )
      })

      afterEach(() => {
        Element.prototype.scrollIntoView = original
        scrollIntoView.mockClear()
        vi.unstubAllGlobals()
      })

      const renderFiltered = () => {
        render(
          <SessionResults
            accent="blue"
            score={33}
            questions={questions}
            answers={denseAnswers}
          />,
        )
        fireEvent.click(screen.getByTestId("btn-filter-errors"))
        expect(screen.getAllByTestId("question-card")).toHaveLength(2)
      }

      const scrolledIds = () =>
        scrollIntoView.mock.contexts.map((el) => (el as Element).id)

      it("une question masquée par le filtre « Erreurs » lève le filtre, puis y défile", () => {
        renderFiltered()
        fireEvent.click(screen.getByTestId("nav-0"))
        expect(screen.getAllByTestId("question-card")).toHaveLength(3)
        expect(screen.getByTestId("btn-filter-errors").textContent).toContain(
          "Erreurs (2)",
        )
        expect(scrolledIds()).toEqual(["sr-question-0"])
      })

      it("jumeau : une question visible sous le filtre le conserve", () => {
        renderFiltered()
        fireEvent.click(screen.getByTestId("nav-1"))
        expect(screen.getAllByTestId("question-card")).toHaveLength(2)
        expect(screen.getByTestId("btn-filter-errors").textContent).toContain(
          "Voir toutes",
        )
        expect(scrolledIds()).toEqual(["sr-question-1"])
      })
    })

    it("tout déplier / tout replier", () => {
      render(
        <SessionResults
          accent="blue"
          score={33}
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
          score={33}
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
          score={33}
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
          score={33}
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
          score={33}
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
          score={33}
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
