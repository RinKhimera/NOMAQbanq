import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  ComposerRow,
  LastUseTag,
} from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-row"
import { bankQuestion } from "../../helpers/bank-question"

describe("ComposerRow", () => {
  it("l'énoncé ouvre l'aperçu de sa question, sauts de ligne aplatis", () => {
    const onPreview = vi.fn()
    const q = bankQuestion("q1", { question: "Ligne une\nligne deux" })
    render(
      <ul>
        <ComposerRow q={q} onPreview={onPreview} testId="row" />
      </ul>,
    )
    expect(screen.getByTestId("row")).toHaveAttribute("data-question-id", "q1")
    const button = screen.getByTestId("composer-question-preview")
    expect(button).toHaveTextContent("Ligne une ligne deux")
    fireEvent.click(button)
    expect(onPreview).toHaveBeenCalledWith(q)
  })

  it("drapeaux clé à vérifier et image, méta et action seulement si fournies", () => {
    const { rerender } = render(
      <ul>
        <ComposerRow
          q={bankQuestion("q1", { keyToVerify: true, imageCount: 2 })}
          onPreview={vi.fn()}
          meta={<span>méta</span>}
          action={<button type="button">Agir</button>}
          testId="row"
        />
      </ul>,
    )
    expect(screen.getByLabelText("Clé à vérifier")).toBeInTheDocument()
    expect(screen.getByLabelText("Image d'énoncé")).toBeInTheDocument()
    expect(screen.getByText("méta")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Agir" })).toBeInTheDocument()

    rerender(
      <ul>
        <ComposerRow q={bankQuestion("q1")} onPreview={vi.fn()} testId="row" />
      </ul>,
    )
    expect(screen.queryByLabelText("Clé à vérifier")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Image d'énoncé")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Agir" }),
    ).not.toBeInTheDocument()
  })
})

describe("LastUseTag", () => {
  it("tiret sans dernière utilisation ; ambre quand récente, titre au survol", () => {
    const { rerender } = render(<LastUseTag label={null} recent={false} />)
    expect(screen.getByText("—")).not.toHaveAttribute("title")

    rerender(<LastUseTag label="EB-25 · il y a 2 sem." recent />)
    const tag = screen.getByText("EB-25 · il y a 2 sem.")
    expect(tag).toHaveAttribute("title", "EB-25 · il y a 2 sem.")
    expect(tag).toHaveClass("text-warning-ink")

    rerender(<LastUseTag label="EB-20 · il y a 6 mois" recent={false} />)
    expect(screen.getByText("EB-20 · il y a 6 mois")).not.toHaveClass(
      "text-warning-ink",
    )
  })
})
