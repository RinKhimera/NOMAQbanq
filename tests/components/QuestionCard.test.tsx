import { fireEvent, render, screen } from "@testing-library/react"
import { ComponentPropsWithoutRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { QuestionCard } from "@/components/quiz/question-card"
import type { QuestionDoc } from "@/components/quiz/question-card/types"

// Props Framer Motion à exclure du DOM (hoisted pour être disponible dans vi.mock)
const { filterMotionProps } = vi.hoisted(() => {
  const motionPropsToFilter = new Set([
    "initial",
    "animate",
    "exit",
    "variants",
    "transition",
    "layout",
    "layoutId",
    "layoutDependency",
    "layoutScroll",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileDrag",
    "whileInView",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "inherit",
    "custom",
  ])

  return {
    filterMotionProps: <T extends Record<string, unknown>>(props: T) =>
      Object.fromEntries(
        Object.entries(props).filter(([key]) => !motionPropsToFilter.has(key)),
      ),
  }
})

// Mock motion/react
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<"div">) => (
      <div {...filterMotionProps(props)}>{children}</div>
    ),
    button: ({ children, ...props }: ComponentPropsWithoutRef<"button">) => (
      <button {...filterMotionProps(props)}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// QuestionCard accepte `QuestionCardQuestion` (QuestionDoc avec
// explanation/references optionnels, lazy-loaded côté serveur via
// questionExplanations). `QuestionDoc` porte déjà `explanation` (requis) et
// `references` (optionnel), ce qui couvre le variant "review".
const mockQuestion: QuestionDoc = {
  _id: "q1",
  _creationTime: Date.now(),
  question: "Quelle est la capitale de la France ?",
  options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
  correctAnswer: "Paris",
  explanation: "Paris est la capitale de la France.",
  objectifCMC: "Objectif 1",
  domain: "Général",
}

describe("QuestionCard", () => {
  describe("Variant: default", () => {
    it("affiche la question et les options", () => {
      render(<QuestionCard variant="default" question={mockQuestion} />)

      expect(screen.getByText(mockQuestion.question)).toBeInTheDocument()
      mockQuestion.options.forEach((option) => {
        expect(screen.getByText(option)).toBeInTheDocument()
      })
    })

    it("affiche le badge de domaine si demandé", () => {
      render(
        <QuestionCard
          variant="default"
          question={mockQuestion}
          showDomainBadge
        />,
      )
      expect(screen.getByText(mockQuestion.domain)).toBeInTheDocument()
    })
  })

  describe("Variant: exam", () => {
    it("appelle onAnswerSelect lors du clic sur une option", () => {
      const onAnswerSelect = vi.fn()
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          onAnswerSelect={onAnswerSelect}
        />,
      )

      fireEvent.click(screen.getByText("Lyon"))
      expect(onAnswerSelect).toHaveBeenCalledWith(1) // Index of "Lyon"
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

      // L'option sélectionnée doit avoir le style "selected" (bg-blue-50, border-blue-400)
      const lyonContainer = screen.getByText("Lyon").closest("div")
      expect(lyonContainer).toHaveClass("bg-blue-50", "border-blue-400")
    })

    it("appelle onFlagToggle lors du clic sur le drapeau", () => {
      const onFlagToggle = vi.fn()
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          onFlagToggle={onFlagToggle}
        />,
      )

      const flagButton = screen.getByRole("button", { name: /Marquer/i })
      fireEvent.click(flagButton)
      expect(onFlagToggle).toHaveBeenCalled()
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
        />,
      )

      expect(screen.queryByTestId("explanation-images")).not.toBeInTheDocument()
      expect(
        screen.queryByAltText("Image d'explication"),
      ).not.toBeInTheDocument()
    })

    it("mode tuteur : révèle la bonne réponse ET l'explication après réponse (showCorrectAnswer + lazyExplanation)", () => {
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

      // La bonne réponse est mise en évidence (état "user-correct")
      const parisContainer = screen.getByText("Paris").closest("div")
      expect(parisContainer).toHaveClass("bg-green-100", "border-green-500")

      // L'explication + références doivent apparaître IMMÉDIATEMENT en passation
      // tuteur (pas seulement en variant review) — cœur du mode tuteur.
      expect(screen.getByTestId("explanation-content")).toBeInTheDocument()
      expect(
        screen.getByText("Paris est la capitale de la France."),
      ).toBeInTheDocument()
      expect(screen.getByText("Atlas géographique, p.12")).toBeInTheDocument()
    })

    it("mode tuteur révélé : bonne réponse en vert (✓), mauvais choix en rouge (✗)", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion} // correctAnswer = "Paris"
          selectedAnswer="Lyon" // l'utilisateur s'est trompé
          showCorrectAnswer={true}
          lazyExplanation="Paris est la capitale de la France."
        />,
      )

      // Bonne réponse (Paris) → état user-correct (vert)
      const paris = screen.getByText("Paris").closest("div")
      expect(paris).toHaveClass("bg-green-100", "border-green-500")

      // Choix de l'utilisateur, faux (Lyon) → état user-incorrect (rouge)
      const lyon = screen.getByText("Lyon").closest("div")
      expect(lyon).toHaveClass("bg-red-100", "border-red-500")
    })

    it("mode tuteur révélé : choix correct → la bonne réponse choisie est en vert", () => {
      render(
        <QuestionCard
          variant="exam"
          question={mockQuestion}
          selectedAnswer="Paris" // bonne réponse choisie
          showCorrectAnswer={true}
          lazyExplanation="Paris est la capitale de la France."
        />,
      )

      const paris = screen.getByText("Paris").closest("div")
      expect(paris).toHaveClass("bg-green-100", "border-green-500")
    })

    it("variant exam SANS correctAnswer (vitrine) : aucune révélation malgré showCorrectAnswer par défaut", () => {
      render(
        <QuestionCard
          variant="exam"
          question={{ ...mockQuestion, correctAnswer: "" }}
          selectedAnswer="Lyon"
          // showCorrectAnswer omis → défaut true ; sans correctAnswer, PAS de révélation
        />,
      )

      // Aucune explication, et le choix reste "selected" (bleu), pas "user-incorrect" (rouge)
      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
      const lyon = screen.getByText("Lyon").closest("div")
      expect(lyon).toHaveClass("bg-blue-50", "border-blue-400")
      expect(lyon).not.toHaveClass("bg-red-100")
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

      // Feedback différé (examen / entraînement test) → aucune correction visible
      // pendant la passation, même si la question porte une explication.
      expect(
        screen.queryByTestId("explanation-content"),
      ).not.toBeInTheDocument()
    })
  })

  describe("Variant: review", () => {
    it("affiche l'explication si étendu", () => {
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />,
      )

      expect(screen.getByText(/Explication :/i)).toBeInTheDocument()
      expect(screen.getByText(mockQuestion.explanation)).toBeInTheDocument()
    })

    it("affiche les indicateurs de correction quand étendu", () => {
      render(
        <QuestionCard
          variant="review"
          question={mockQuestion}
          userAnswer="Lyon"
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />,
      )

      // Lyon est incorrect, Paris est correct
      expect(screen.getByText("Paris")).toBeInTheDocument()
      expect(screen.getByText("Lyon")).toBeInTheDocument()
      expect(screen.getByText(/Incorrect/i)).toBeInTheDocument()
    })

    it("affiche les images d'explication sous l'explication (correction)", () => {
      render(
        <QuestionCard
          variant="review"
          question={{
            ...mockQuestion,
            explanationImages: [
              { url: "https://cdn/expl-1.jpg", storagePath: "p1", order: 0 },
              { url: "https://cdn/expl-2.jpg", storagePath: "p2", order: 1 },
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
