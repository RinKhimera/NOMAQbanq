import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  AnswerOption,
  AnswerOptionList,
} from "@/components/quiz/question-card/answer-option"

describe("AnswerOption", () => {
  it("affiche la lettre et le texte de l'option", () => {
    render(<AnswerOption option="Paris" index={2} state="default" />)

    expect(screen.getByText("C")).toBeInTheDocument()
    expect(screen.getByText("Paris")).toBeInTheDocument()
  })

  it("est un bouton cliquable quand onClick est fourni, et reflète la sélection", () => {
    const onClick = vi.fn()
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="selected"
        onClick={onClick}
      />,
    )

    const button = screen.getByRole("button", { name: /Paris/ })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveAttribute("data-selected", "true")
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("n'est pas un bouton sans onClick (choix corrigé, aperçu)", () => {
    render(<AnswerOption option="Paris" index={0} state="correct" />)

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByTestId("answer-option-0")).toHaveAttribute(
      "data-state",
      "correct",
    )
  })

  it("désactivé, ne déclenche pas onClick", () => {
    const onClick = vi.fn()
    render(
      <AnswerOption
        option="Paris"
        index={0}
        state="default"
        onClick={onClick}
        disabled
      />,
    )

    fireEvent.click(screen.getByRole("button"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("nomme la bonne réponse et le choix faux, en gardant la lettre pour les lecteurs d'écran", () => {
    render(
      <>
        <AnswerOption option="Paris" index={0} state="correct" />
        <AnswerOption option="Lyon" index={1} state="incorrect" />
      </>,
    )

    const correct = screen.getByTestId("answer-option-0")
    expect(within(correct).getByText("Bonne réponse")).toBeInTheDocument()
    expect(within(correct).getByText("A")).toBeInTheDocument()
    expect(
      within(screen.getByTestId("answer-option-1")).getByText("Votre réponse"),
    ).toBeInTheDocument()
  })

  it("aucune mention pour un choix sélectionné ou atténué", () => {
    render(
      <>
        <AnswerOption option="Paris" index={0} state="selected" />
        <AnswerOption option="Lyon" index={1} state="muted" />
      </>,
    )

    expect(screen.queryByText("Bonne réponse")).not.toBeInTheDocument()
    expect(screen.queryByText("Votre réponse")).not.toBeInTheDocument()
  })
})

describe("AnswerOptionList", () => {
  it("rend les choix dans l'ordre A–E et transmet l'index choisi", () => {
    const onSelect = vi.fn()
    render(
      <AnswerOptionList
        options={["Paris", "Lyon", "Marseille"]}
        stateOf={(_, i) => (i === 1 ? "selected" : "default")}
        onSelect={onSelect}
      />,
    )

    const group = screen.getByRole("group", { name: "Choix de réponse" })
    const buttons = within(group).getAllByRole("button")
    expect(buttons.map((b) => b.textContent)).toEqual([
      "AParis",
      "BLyon",
      "CMarseille",
    ])
    expect(buttons[1]).toHaveAttribute("data-state", "selected")
    fireEvent.click(buttons[2])
    expect(onSelect).toHaveBeenCalledWith(2)
  })
})
