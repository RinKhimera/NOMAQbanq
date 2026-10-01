import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import QuestionDetailsDialog from "@/components/admin/question-details-dialog"
import type { QuestionDetail } from "@/features/questions/dal"

const question: QuestionDetail = {
  id: "q1",
  question: "Énoncé",
  options: ["A", "B"],
  correctAnswer: "B",
  objectifCMC: "OBJ",
  domain: "Cardiologie",
  createdAt: 0,
  updatedAt: 0,
  keyConfirmation: null,
  explanation: "Premier paragraphe [1].\n\nSecond paragraphe.",
  references: ["1.\nMotor Delays.\n\n2.\nAutre source."],
  images: [],
  explanationImages: [{ id: "img1", storagePath: "q/x.png", position: 0 }],
}

describe("QuestionDetailsDialog", () => {
  it("affiche la correction avec le rendu partagé", () => {
    render(
      <QuestionDetailsDialog question={question} open onOpenChange={vi.fn()} />,
    )

    expect(screen.getByText("Second paragraphe.").tagName).toBe("P")
    expect(screen.getByTestId("explanation-images")).toBeInTheDocument()
    const reference = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Motor Delays"))
    expect(reference?.textContent).toBe(
      "1.\nMotor Delays.\n\n2.\nAutre source.",
    )

    fireEvent.click(screen.getByTestId("citation"))
    expect(
      within(screen.getByTestId("citation-popover")).getByText(/Motor Delays/),
    ).toBeInTheDocument()
  })
})
