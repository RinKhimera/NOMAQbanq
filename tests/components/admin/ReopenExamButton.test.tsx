import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ReopenExamButton } from "@/components/admin/reopen-exam-button"

const now = Date.parse("2026-10-01T12:00:00Z")

describe("ReopenExamButton", () => {
  it("mène à la création pré-remplie depuis un examen clos", () => {
    render(
      <ReopenExamButton
        exam={{
          id: "e1",
          startDate: now - 99,
          endDate: now - 1,
          finalizedAt: now - 9,
        }}
        now={now}
      />,
    )

    expect(
      screen.getByRole("link", { name: "Rouvrir" }).getAttribute("href"),
    ).toBe("/admin/examens/creer?source=e1")
  })

  it("n'apparaît pas sur un examen ouvert", () => {
    render(
      <ReopenExamButton
        exam={{
          id: "e1",
          startDate: now - 99,
          endDate: now + 1,
          finalizedAt: now - 9,
        }}
        now={now}
      />,
    )

    expect(screen.queryByRole("link", { name: "Rouvrir" })).toBeNull()
  })

  it("n'apparaît pas sur un examen en préparation, même daté dans le passé", () => {
    render(
      <ReopenExamButton
        exam={{
          id: "e1",
          startDate: now - 99,
          endDate: now - 1,
          finalizedAt: null,
        }}
        now={now}
      />,
    )

    expect(screen.queryByRole("link", { name: "Rouvrir" })).toBeNull()
  })
})
