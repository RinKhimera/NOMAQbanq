import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AnswerOption } from "@/components/quiz/question-card/answer-option"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

describe("AnswerOption", () => {
  it("affiche la lettre et le texte de l'option", () => {
    render(
      <AnswerOption option="Paris" index={0} state="default" />,
    )

    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("Paris")).toBeInTheDocument()
  })

  it("affiche la lettre correcte pour chaque index", () => {
    const { rerender } = render(
      <AnswerOption option="Option" index={1} state="default" />,
    )
    expect(screen.getByText("B")).toBeInTheDocument()

    rerender(<AnswerOption option="Option" index={2} state="default" />)
    expect(screen.getByText("C")).toBeInTheDocument()

    rerender(<AnswerOption option="Option" index={3} state="default" />)
    expect(screen.getByText("D")).toBeInTheDocument()
  })

  it("applique le style par défaut correctement", () => {
    render(
      <AnswerOption option="Paris" index={0} state="default" />,
    )

    const container = screen.getByText("Paris").closest("div")
    expect(container?.className).toContain("border-gray-200")
  })

  it("applique le style sélectionné correctement", () => {
    render(
      <AnswerOption option="Paris" index={0} state="selected" />,
    )

    const container = screen.getByText("Paris").closest("div")
    expect(container?.className).toContain("bg-blue-50")
    expect(container?.className).toContain("border-blue-400")
  })

  it("applique le style correct correctement", () => {
    render(
      <AnswerOption option="Paris" index={0} state="correct" />,
    )

    const container = screen.getByText("Paris").closest("div")
    expect(container?.className).toContain("bg-green-50")
    expect(container?.className).toContain("border-green-400")
  })

  it("applique le style user-incorrect correctement", () => {
    render(
      <AnswerOption option="Lyon" index={1} state="user-incorrect" />,
    )

    const container = screen.getByText("Lyon").closest("div")
    expect(container?.className).toContain("bg-red-100")
    expect(container?.className).toContain("border-red-500")
  })

  it("applique le style user-correct correctement", () => {
    render(
      <AnswerOption option="Paris" index={0} state="user-correct" />,
    )

    const container = screen.getByText("Paris").closest("div")
    expect(container?.className).toContain("bg-green-100")
    expect(container?.className).toContain("border-green-500")
  })

  it("applique le style incorrect (review) correctement", () => {
    render(
      <AnswerOption option="Marseille" index={2} state="incorrect" />,
    )

    const container = screen.getByText("Marseille").closest("div")
    expect(container?.className).toContain("bg-gray-50")
  })

  it("rend un bouton interactif quand onClick est fourni", () => {
    const onClick = vi.fn()
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="default"
        onClick={onClick}
      />,
    )

    const btn = screen.getByTestId("answer-option-0")
    expect(btn.tagName).toBe("BUTTON")
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("ne rend pas de bouton quand onClick est absent (readonly)", () => {
    render(
      <AnswerOption option="Paris" index={0} state="correct" />,
    )

    expect(screen.queryByTestId("answer-option-0")).not.toBeInTheDocument()
    expect(screen.getByText("Paris")).toBeInTheDocument()
  })

  it("désactive le bouton quand disabled est vrai", () => {
    const onClick = vi.fn()
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="default"
        onClick={onClick}
        disabled={true}
      />,
    )

    // When disabled=true and onClick exists, isInteractive is false (disabled overrides)
    // Actually: isInteractive = onClick && !disabled → false
    // So it renders as non-interactive content
    expect(screen.queryByTestId("answer-option-0")).not.toBeInTheDocument()
    const container = screen.getByText("Paris").closest("div")
    expect(container?.className).toContain("opacity-60")
  })

  it("affiche l'icône check quand showCheckIcon est vrai", () => {
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="user-correct"
        showCheckIcon={true}
      />,
    )

    // CheckCircle icon should be present (aria-hidden)
    const container = screen.getByText("Paris").closest("div")
    const svg = container?.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("affiche l'icône X quand showXIcon est vrai", () => {
    render(
      <AnswerOption
        option="Lyon"
        index={1}
        state="user-incorrect"
        showXIcon={true}
      />,
    )

    const container = screen.getByText("Lyon").closest("div")
    const svg = container?.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("applique le mode compact correctement", () => {
    render(
      <AnswerOption option="Paris" index={0} state="default" compact={true} />,
    )

    const container = screen.getByText("Paris").closest("div")
    expect(container?.className).toContain("p-2.5")
    expect(container?.className).toContain("text-sm")
  })

  it("définit data-selected sur le bouton interactif", () => {
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="selected"
        onClick={vi.fn()}
      />,
    )

    const btn = screen.getByTestId("answer-option-0")
    expect(btn).toHaveAttribute("data-selected", "true")
  })

  it("définit data-selected à false quand non sélectionné", () => {
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="default"
        onClick={vi.fn()}
      />,
    )

    const btn = screen.getByTestId("answer-option-0")
    expect(btn).toHaveAttribute("data-selected", "false")
  })

  it("applique font-medium pour les réponses correctes", () => {
    render(
      <AnswerOption option="Paris" index={0} state="correct" />,
    )

    const textSpan = screen.getByText("Paris")
    expect(textSpan.className).toContain("font-medium")
  })

  it("applique font-normal pour les réponses par défaut", () => {
    render(
      <AnswerOption option="Paris" index={0} state="default" />,
    )

    const textSpan = screen.getByText("Paris")
    expect(textSpan.className).toContain("font-normal")
  })
})
