import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuestionCard } from "@/components/quiz/question-card"
import type { QuizQuestion } from "@/components/quiz/runner/types"

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Forme-pont avec sa correction : couvre le variant "review".
const mockQuestion: QuizQuestion = {
  _id: "q1",
  images: [],
  question: "Quelle est la capitale de la France ?",
  options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
  correctAnswer: "Paris",
  explanation: "Paris est la capitale de la France.",
  objectifCMC: "Objectif 1",
  domain: "Général",
}

const option = (text: string) =>
  screen.getByText(text).closest("[data-testid^='answer-option-']")

describe("QuestionCard", () => {
  describe("Variant: default", () => {
    it("affiche la question, les options et le domaine", () => {
      render(<QuestionCard variant="default" question={mockQuestion} />)

      expect(screen.getByText(mockQuestion.question)).toBeInTheDocument()
      mockQuestion.options.forEach((o) => {
        expect(screen.getByText(o)).toBeInTheDocument()
      })
      expect(screen.getByText(mockQuestion.domain)).toBeInTheDocument()
    })
  })

  describe("Variant: exam", () => {
    it("numérote la question sur le total de la série", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          questionNumber={3}
          totalQuestions={10}
        />,
      )

      expect(
        screen.getByRole("heading", { name: "Question 3 / 10" }),
      ).toBeInTheDocument()
    })

    it("appelle onAnswerSelect lors du clic sur une option", () => {
      const onAnswerSelect = vi.fn()
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          showCorrectAnswer={false}
          onAnswerSelect={onAnswerSelect}
        />,
      )

      fireEvent.click(screen.getByText("Lyon"))
      expect(onAnswerSelect).toHaveBeenCalledWith(1)
    })

    it("affiche l'état sélectionné", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Lyon"
          // Passation en cours (pas de révélation) → le choix reste "selected".
          showCorrectAnswer={false}
        />,
      )

      expect(option("Lyon")).toHaveAttribute("data-state", "selected")
      expect(option("Paris")).toHaveAttribute("data-state", "default")
    })

    it("marque et démarque la question", () => {
      const onFlagToggle = vi.fn()
      const { rerender } = render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          onFlagToggle={onFlagToggle}
        />,
      )

      const flag = screen.getByTestId("btn-flag")
      expect(flag).toHaveAccessibleName("Marquer")
      expect(flag).toHaveAttribute("aria-pressed", "false")
      fireEvent.click(flag)
      expect(onFlagToggle).toHaveBeenCalled()

      rerender(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          onFlagToggle={onFlagToggle}
          isFlagged
        />,
      )
      expect(screen.getByTestId("btn-flag")).toHaveAttribute(
        "data-flagged",
        "true",
      )
      expect(screen.getByTestId("btn-flag")).toHaveAccessibleName("Marquée")
    })

    it("rend le pied de carte fourni", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          footer={<button type="button">Suivante</button>}
        />,
      )

      expect(
        screen.getByRole("button", { name: "Suivante" }),
      ).toBeInTheDocument()
    })

    it("ne révèle JAMAIS les images d'explication en passation (anti-triche)", () => {
      render(
        <QuestionCard
          variant="exam"
          question={{
            ...mockQuestion,
            explanationImages: [
              { url: "https://cdn/expl-1.jpg", storagePath: "p1", order: 0 },
            ],
          }}
          selectedAnswer="Lyon"
        />,
      )

      expect(screen.getByTestId("explanation-content")).toBeInTheDocument()
      expect(screen.queryByTestId("explanation-images")).not.toBeInTheDocument()
      expect(
        screen.queryByAltText("Image d'explication"),
      ).not.toBeInTheDocument()
    })

    it("mode tuteur révélé : explication ouverte, références repliées", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Lyon"
          showCorrectAnswer={true}
          lazyExplanation="Paris est la capitale de la France."
          lazyReferences={["Atlas géographique, p.12"]}
        />,
      )

      expect(
        screen.getByText("Paris est la capitale de la France."),
      ).toBeInTheDocument()
      expect(
        screen.queryByText("Atlas géographique, p.12"),
      ).not.toBeInTheDocument()

      const references = screen.getByRole("button", { name: /Références/ })
      expect(references).toHaveAttribute("aria-expanded", "false")
      fireEvent.click(references)
      expect(screen.getByText("Atlas géographique, p.12")).toBeInTheDocument()

      const explanation = screen.getByRole("button", { name: /Explication/ })
      expect(explanation).toHaveAttribute("aria-expanded", "true")
      fireEvent.click(explanation)
      expect(
        screen.queryByText("Paris est la capitale de la France."),
      ).not.toBeInTheDocument()
    })

    it("mode tuteur révélé : un appel de citation ouvre la référence visée", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Lyon"
          showCorrectAnswer={true}
          lazyExplanation="Paris est la capitale [2]."
          lazyReferences={["Atlas géographique, p.12", "Guide Michelin"]}
        />,
      )

      fireEvent.click(
        screen.getByRole("button", { name: "Voir la référence 2" }),
      )
      expect(
        within(screen.getByRole("dialog")).getByText("Guide Michelin"),
      ).toBeInTheDocument()
    })

    it("mode tuteur révélé : bonne réponse juste, mauvais choix faux, les autres atténués, réponse verrouillée", () => {
      const onAnswerSelect = vi.fn()
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Lyon"
          showCorrectAnswer={true}
          lazyExplanation="Paris est la capitale de la France."
          onAnswerSelect={onAnswerSelect}
        />,
      )

      expect(option("Paris")).toHaveAttribute("data-state", "correct")
      expect(option("Lyon")).toHaveAttribute("data-state", "incorrect")
      expect(option("Marseille")).toHaveAttribute("data-state", "muted")
      expect(
        within(
          screen.getByRole("group", { name: "Choix de réponse" }),
        ).queryByRole("button"),
      ).not.toBeInTheDocument()
    })

    it("mode tuteur révélé : choix correct → la réponse choisie est juste", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Paris"
          showCorrectAnswer={true}
          lazyExplanation="Paris est la capitale de la France."
        />,
      )

      expect(option("Paris")).toHaveAttribute("data-state", "correct")
      expect(screen.queryByText("Votre réponse")).not.toBeInTheDocument()
    })

    it("variant exam SANS correctAnswer (vitrine) : aucune révélation malgré showCorrectAnswer par défaut", () => {
      render(
        <QuestionCard
          variant="exam"
          question={{ ...mockQuestion, correctAnswer: "" }}
          selectedAnswer="Lyon"
        />,
      )

      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
      expect(option("Lyon")).toHaveAttribute("data-state", "selected")
    })

    it("clé retenue, validée en tuteur : notice « correction différée », choix ni juste ni faux", () => {
      render(
        <QuestionCard
          variant="exam"
          question={{ ...mockQuestion, correctAnswer: "", keyWithheld: true }}
          selectedAnswer="Lyon"
          showCorrectAnswer={true}
        />,
      )
      expect(screen.getByTestId("key-withheld-notice")).toBeInTheDocument()
      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
      expect(option("Lyon")).toHaveAttribute("data-state", "selected")
    })

    it("clé retenue, pas encore validée : aucune notice", () => {
      render(
        <QuestionCard
          variant="exam"
          question={{ ...mockQuestion, correctAnswer: "", keyWithheld: true }}
          selectedAnswer="Lyon"
          showCorrectAnswer={false}
        />,
      )
      expect(
        screen.queryByTestId("key-withheld-notice"),
      ).not.toBeInTheDocument()
    })

    it("mode test : ne révèle PAS l'explication en passation (showCorrectAnswer=false)", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Lyon"
          showCorrectAnswer={false}
        />,
      )

      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
      expect(option("Paris")).toHaveAttribute("data-state", "default")
    })
  })

  describe("Variant: review", () => {
    it("clé retenue : statut « Correction différée », notice à la place de l'explication, réponse ni juste ni fausse", () => {
      render(
        <QuestionCard
          variant="review"
          question={{ ...mockQuestion, correctAnswer: "", keyWithheld: true }}
          userAnswer="Lyon"
          isExpanded={true}
        />,
      )
      expect(screen.getByText("Correction différée")).toBeInTheDocument()
      expect(screen.queryByText("Incorrect")).not.toBeInTheDocument()
      expect(screen.getByTestId("key-withheld-notice")).toBeInTheDocument()
      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
      expect(option("Lyon")).toHaveAttribute("data-state", "selected")
    })

    it("repliée : ni choix ni explication ; le bouton déplie", () => {
      const onToggleExpand = vi.fn()
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          userAnswer="Lyon"
          onToggleExpand={onToggleExpand}
        />,
      )

      expect(screen.queryByText("Paris")).not.toBeInTheDocument()
      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
      const toggle = screen.getByRole("button", {
        name: "Développer la question",
      })
      expect(toggle).toHaveAttribute("aria-expanded", "false")
      fireEvent.click(toggle)
      expect(onToggleExpand).toHaveBeenCalled()
    })

    it("affiche l'explication si étendue", () => {
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />,
      )

      expect(screen.getByTestId("explanation-content")).toBeInTheDocument()
      expect(screen.getByText(mockQuestion.explanation!)).toBeInTheDocument()
    })

    it("affiche le verdict et la correction des choix quand étendue", () => {
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          userAnswer="Lyon"
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />,
      )

      expect(screen.getByText("Incorrect")).toBeInTheDocument()
      expect(option("Paris")).toHaveAttribute("data-state", "correct")
      expect(option("Lyon")).toHaveAttribute("data-state", "incorrect")
      expect(screen.queryAllByRole("button", { name: /Paris|Lyon/ })).toEqual(
        [],
      )
    })

    it("sans réponse : « Non répondu »", () => {
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          userAnswer={null}
        />,
      )

      expect(screen.getByText("Non répondu")).toBeInTheDocument()
    })

    it("affiche les images d'explication sous l'explication (correction)", () => {
      render(
        <QuestionCard
          variant="review"
          question={{
            ...mockQuestion,
            explanationImages: [
              { url: "https://cdn/expl-2.jpg", storagePath: "p2", order: 1 },
              { url: "https://cdn/expl-1.jpg", storagePath: "p1", order: 0 },
            ],
          }}
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />,
      )

      expect(screen.getByTestId("explanation-images")).toBeInTheDocument()
      const imgs = screen.getAllByAltText("Image d'explication")
      expect(imgs).toHaveLength(2)
      expect(imgs[0]).toHaveAttribute("src", "https://cdn/expl-1.jpg")
    })

    it("n'affiche pas le bloc d'images si aucune image d'explication", () => {
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />,
      )

      expect(screen.queryByTestId("explanation-images")).not.toBeInTheDocument()
    })
  })
})
