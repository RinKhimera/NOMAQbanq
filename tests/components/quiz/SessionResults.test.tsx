import { fireEvent, render, screen } from "@testing-library/react"
import { type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  SessionResults,
  resultsByDomain,
} from "@/components/quiz/results/session-results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/quiz/question-card", () => ({
  QuestionCard: ({
    questionNumber,
    userAnswer,
    isFlagged,
  }: {
    questionNumber: number
    userAnswer: string | null
    isFlagged?: boolean
  }) => (
    <div
      data-testid="question-card"
      data-user-answer={userAnswer ?? "none"}
      data-flagged={isFlagged ? "true" : undefined}
    >
      Q{questionNumber}
    </div>
  ),
}))

// ============================================
// Fixtures
// ============================================

const makeQuestion = (id: string, domain = "Cardiologie"): QuizQuestion => ({
  _id: id,
  question: `Question ${id}`,
  options: ["A", "B", "C", "D"],
  domain,
  objectifCMC: "Obj",
  images: [],
  correctAnswer: "A",
})

const questions: QuizQuestion[] = [
  makeQuestion("q1"),
  makeQuestion("q2"),
  makeQuestion("q3"),
]

const unansweredItems = () =>
  screen
    .getAllByTestId(/^results-nav-item-/)
    .filter((item) => item.dataset.state === "unanswered")
    .map((item) => item.dataset.testid)

// Dense answers map: q1 correct, q2 incorrect, q3 absent (unanswered)
const denseAnswers: AnswersMap = {
  q1: { selected: "A", isCorrect: true },
  q2: { selected: "B", isCorrect: false },
}

const cardTexts = () =>
  screen.getAllByTestId("question-card").map((c) => c.textContent)

// ============================================
// Tests
// ============================================

describe("SessionResults", () => {
  it("sans résumé, ne garde que la correction (la page porte son propre bilan)", () => {
    render(
      <SessionResults
        kind="exam"
        score={33}
        questions={questions}
        answers={denseAnswers}
        summary={false}
      />,
    )
    expect(screen.queryByTestId("score-percentage")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stat-correct")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.getAllByTestId("question-card")).toHaveLength(3)
    expect(screen.getByTestId("btn-filter-errors")).toBeInTheDocument()
  })

  describe("compteurs dérivés des réponses", () => {
    it("compte justes, fausses et sans réponse à partir de questions + answers", () => {
      render(
        <SessionResults
          kind="exam"
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

    it("« Non répondues » reste affiché à 0 : la ligne ne disparaît pas", () => {
      render(
        <SessionResults
          kind="training"
          score={100}
          questions={questions}
          answers={{ ...denseAnswers, q3: { selected: "A", isCorrect: true } }}
        />,
      )
      expect(screen.getByText("Non répondues")).toBeInTheDocument()
      expect(screen.getByTestId("stat-unanswered").textContent).toBe("0")
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

    it("une réponse à clé retenue n'est ni juste ni fausse : ligne « Différées »", () => {
      render(
        <SessionResults
          kind="training"
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

    it("le filtre « Incorrectes » ne retient pas une réponse à clé retenue", () => {
      render(
        <SessionResults
          kind="training"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      fireEvent.click(screen.getByTestId("btn-filter-errors"))
      expect(cardTexts()).toEqual(["Q3"])
    })

    it("ne demande pas l'explication d'une question à clé retenue", async () => {
      const loadExplanations = vi.fn<(ids: string[]) => Promise<never[]>>(
        async () => [],
      )
      render(
        <SessionResults
          kind="exam"
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
          kind="training"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      expect(screen.getByTestId("results-nav-item-1")).toHaveAttribute(
        "data-state",
        "withheld",
      )
    })

    // Le score en base agrège TOUTES les réponses : « score × N / 100 −
    // justes affichées » donnerait le nombre de différées justes. Tant qu'une
    // réponse est différée, le pourcentage, le badge et le verdict sont retenus.
    it("retient le score : ni pourcentage, ni badge, ni verdict tant qu'une réponse est différée", () => {
      render(
        <SessionResults
          kind="training"
          score={33}
          questions={withheldQuestions}
          answers={withheldAnswers}
        />,
      )
      expect(screen.queryByTestId("score-percentage")).not.toBeInTheDocument()
      expect(screen.queryByTestId("score-badge")).not.toBeInTheDocument()
      expect(screen.getByTestId("score-status").dataset.status).toBe("withheld")
      expect(screen.getByTestId("score-withheld").textContent).toBe(
        "Score disponible après la clôture de l'examen",
      )
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Score retenu jusqu'à la clôture de l'examen blanc.",
      )
    })

    it("jumeau admin : mêmes réponses sans clé retenue → pourcentage, badge et verdict affichés", () => {
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
          kind="training"
          score={33}
          questions={revealedQuestions}
          answers={revealedAnswers}
        />,
      )
      expect(screen.getByTestId("score-percentage").textContent).toMatch(
        /33\s%/,
      )
      expect(screen.getByTestId("score-badge")).toBeInTheDocument()
      expect(screen.getByTestId("score-status").dataset.status).toBe("failing")
      expect(screen.queryByTestId("score-withheld")).not.toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Continuez à pratiquer. 1 bonne réponse sur 3.",
      )
    })

    it("une question à clé retenue SANS réponse ne retient pas le score", () => {
      render(
        <SessionResults
          kind="training"
          score={33}
          questions={withheldQuestions}
          answers={{ q1: { selected: "A", isCorrect: true } }}
        />,
      )
      expect(screen.getByTestId("score-percentage").textContent).toMatch(
        /33\s%/,
      )
      expect(screen.queryByTestId("score-withheld")).not.toBeInTheDocument()
    })

    it("un score `null` (retenu par la page) est retenu même sans marqueur sur les questions", () => {
      render(
        <SessionResults
          kind="exam"
          score={null}
          questions={questions}
          answers={denseAnswers}
          percentile={75}
        />,
      )
      expect(screen.queryByTestId("score-percentage")).not.toBeInTheDocument()
      expect(screen.getByTestId("score-withheld")).toBeInTheDocument()
      // Le percentile compare des scores : retenu avec eux.
      expect(screen.queryByTestId("exam-percentile")).toBeNull()
    })
  })

  describe("bilan", () => {
    it("affiche le score dans l'anneau, le verdict et les compteurs", () => {
      render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={denseAnswers}
          eyebrow="Examen blanc 25 · fermé le 21 sept. 2026"
        />,
      )
      expect(screen.getByTestId("score-percentage").textContent).toMatch(
        /33\s%/,
      )
      expect(screen.getByText("Non répondues")).toBeInTheDocument()
      expect(
        screen.getByText("Examen blanc 25 · fermé le 21 sept. 2026"),
      ).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Non réussi.",
      )
      expect(screen.getAllByTestId("question-card")).toHaveLength(3)
    })

    it("jumeau : le statut suit le seuil de réussite", () => {
      render(
        <SessionResults
          kind="exam"
          score={80}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("score-badge").textContent).toBe("Réussi")
      expect(screen.getByTestId("score-status").dataset.status).toBe("passing")
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Réussi.",
      )
    })

    it("affiche 'À améliorer' pour un score < 60", () => {
      render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.getByTestId("score-badge").textContent).toBe("À améliorer")
    })

    it("série : le verdict compte les bonnes réponses au pluriel", () => {
      render(
        <SessionResults
          kind="training"
          score={67}
          questions={questions}
          answers={{ ...denseAnswers, q3: { selected: "A", isCorrect: true } }}
        />,
      )
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Bien joué ! 2 bonnes réponses sur 3.",
      )
    })

    it("situe le participant parmi les autres quand le percentile existe", () => {
      render(
        <SessionResults
          kind="exam"
          score={70}
          questions={questions}
          answers={denseAnswers}
          percentile={75}
        />,
      )
      expect(screen.getByTestId("exam-percentile")).toHaveTextContent(
        "Vous avez fait mieux que 75 % des autres participants",
      )
    })

    it("parle du participant, pas du lecteur, quand un admin consulte ses résultats", () => {
      render(
        <SessionResults
          kind="exam"
          score={70}
          questions={questions}
          answers={denseAnswers}
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
        <SessionResults
          kind="exam"
          score={70}
          questions={questions}
          answers={denseAnswers}
          percentile={null}
        />,
      )
      expect(screen.queryByTestId("exam-percentile")).toBeNull()
    })

    it("rend les actions et le lien de retour de la page", () => {
      render(
        <SessionResults
          kind="training"
          score={70}
          questions={questions}
          answers={denseAnswers}
          actions={<button type="button">Nouvelle série</button>}
          backHref="/tableau-de-bord/entrainement"
          backLabel="Entraînement"
        />,
      )
      expect(
        screen.getByRole("button", { name: "Nouvelle série" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("link", { name: "Entraînement" }),
      ).toHaveAttribute("href", "/tableau-de-bord/entrainement")
    })
  })

  describe("résultats par domaine (examen)", () => {
    const mixed: QuizQuestion[] = [
      makeQuestion("q1", "Cardiologie"),
      makeQuestion("q2", "Cardiologie"),
      makeQuestion("q3", "Pédiatrie"),
      {
        ...makeQuestion("q4", "Neurologie"),
        correctAnswer: undefined,
        keyWithheld: true,
      },
    ]
    const answers: AnswersMap = {
      q1: { selected: "A", isCorrect: true },
      q2: { selected: "B", isCorrect: false },
      q4: { selected: "A" },
    }

    it("resultsByDomain : plancher, sans réponse comptée fausse, clé retenue exclue, tri décroissant", () => {
      expect(resultsByDomain(mixed, answers)).toEqual([
        { domain: "Cardiologie", correct: 1, total: 2, percent: 50 },
        { domain: "Pédiatrie", correct: 0, total: 1, percent: 0 },
      ])
    })

    it("un examen affiche la carte par domaine ; une série, non", () => {
      const { unmount } = render(
        <SessionResults
          kind="exam"
          score={33}
          questions={mixed}
          answers={answers}
        />,
      )
      expect(screen.getAllByTestId("domain-result")).toHaveLength(2)
      expect(screen.getByText("Résultats de cet examen")).toBeInTheDocument()
      unmount()
      render(
        <SessionResults
          kind="training"
          score={33}
          questions={mixed}
          answers={answers}
        />,
      )
      expect(screen.queryByTestId("domain-result")).not.toBeInTheDocument()
    })
  })

  describe("filtres", () => {
    it("« Incorrectes » masque les correctes et conserve incorrectes + non répondues, avec l'effectif", () => {
      render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      const errors = screen.getByTestId("btn-filter-errors")
      expect(errors).toHaveTextContent("Incorrectes2")
      fireEvent.click(errors)
      expect(errors).toHaveAttribute("aria-pressed", "true")
      expect(cardTexts()).toEqual(["Q2", "Q3"])
      fireEvent.click(screen.getByTestId("results-filter-all"))
      expect(cardTexts()).toEqual(["Q1", "Q2", "Q3"])
    })

    it("« Marquées » ne garde que les questions marquées, et le dit quand il n'y en a pas", () => {
      const { unmount } = render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={denseAnswers}
          flaggedIds={["q3"]}
        />,
      )
      const flagged = screen.getByTestId("results-filter-flagged")
      expect(flagged).toHaveTextContent("Marquées1")
      fireEvent.click(flagged)
      expect(cardTexts()).toEqual(["Q3"])
      expect(screen.getByTestId("question-card").dataset.flagged).toBe("true")
      unmount()

      render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      fireEvent.click(screen.getByTestId("results-filter-flagged"))
      expect(screen.queryAllByTestId("question-card")).toHaveLength(0)
      expect(
        screen.getByText("Aucune question dans ce filtre."),
      ).toBeInTheDocument()
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
            kind="exam"
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

      it("une question masquée par le filtre « Incorrectes » lève le filtre, puis y défile", () => {
        renderFiltered()
        fireEvent.click(screen.getByTestId("results-nav-item-0"))
        expect(screen.getAllByTestId("question-card")).toHaveLength(3)
        expect(screen.getByTestId("results-filter-all")).toHaveAttribute(
          "aria-pressed",
          "true",
        )
        expect(scrolledIds()).toEqual(["sr-question-0"])
      })

      it("jumeau : une question visible sous le filtre le conserve", () => {
        renderFiltered()
        fireEvent.click(screen.getByTestId("results-nav-item-1"))
        expect(screen.getAllByTestId("question-card")).toHaveLength(2)
        expect(screen.getByTestId("btn-filter-errors")).toHaveAttribute(
          "aria-pressed",
          "true",
        )
        expect(scrolledIds()).toEqual(["sr-question-1"])
      })
    })

    it("tout déplier / tout replier", () => {
      render(
        <SessionResults
          kind="exam"
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
          kind="exam"
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
          kind="exam"
          score={33}
          questions={questions}
          answers={denseAnswers}
        />,
      )
      expect(screen.queryByText("Participant")).not.toBeInTheDocument()
    })
  })

  describe("compat données historiques (answers clairsemées)", () => {
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
          kind="exam"
          score={33}
          questions={questions}
          answers={sparseAnswers}
        />,
      )

      expect(screen.getAllByTestId("question-card")).toHaveLength(3)
      expect(screen.getByTestId("stat-unanswered").textContent).toBe("2")
    })

    it("le navigateur reçoit le bon compte de non-répondues (sparse)", () => {
      const sparseAnswers: AnswersMap = {
        q1: { selected: "A", isCorrect: true },
        // q2 and q3 absent
      }

      render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={sparseAnswers}
        />,
      )

      expect(unansweredItems()).toEqual([
        "results-nav-item-1",
        "results-nav-item-2",
      ])
    })

    it("traite les entrées avec selected vide comme 'non répondues'", () => {
      const answersWithEmptySelected: AnswersMap = {
        q1: { selected: "A", isCorrect: true },
        q2: { selected: "", isCorrect: false }, // empty selected = unanswered
        // q3 absent
      }

      render(
        <SessionResults
          kind="exam"
          score={33}
          questions={questions}
          answers={answersWithEmptySelected}
        />,
      )

      // q2 (empty selected) + q3 (absent) = 2 unanswered
      expect(unansweredItems()).toEqual([
        "results-nav-item-1",
        "results-nav-item-2",
      ])
    })
  })
})
