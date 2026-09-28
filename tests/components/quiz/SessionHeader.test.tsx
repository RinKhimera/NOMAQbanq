import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SessionHeader } from "@/components/quiz/session/session-header"

const base = {
  title: "Examen blanc 26",
  kind: "exam" as const,
  currentIndex: 11,
  totalQuestions: 50,
  answeredCount: 10,
}

describe("SessionHeader", () => {
  it("porte le titre en h1 et la position dans la série", () => {
    render(<SessionHeader {...base} onFinish={vi.fn()} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Examen blanc 26" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/12 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText("10/50")).toBeInTheDocument()
  })

  it("affiche le chrono et son palier", () => {
    render(
      <SessionHeader
        {...base}
        timer={{ label: "00:04:59", zone: "critical" }}
        onFinish={vi.fn()}
      />,
    )

    const timer = screen.getByRole("timer", { name: "Temps restant" })
    expect(timer).toHaveTextContent("00:04:59")
    expect(timer).toHaveAttribute("data-zone", "critical")
  })

  it("sans chrono (série), n'en affiche aucun", () => {
    render(<SessionHeader {...base} kind="training" onFinish={vi.fn()} />)

    expect(screen.queryByRole("timer")).not.toBeInTheDocument()
  })

  it("propose la pause seulement quand elle est disponible", () => {
    const onPause = vi.fn()
    const { rerender } = render(
      <SessionHeader {...base} onPause={onPause} onFinish={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId("btn-pause"))
    expect(onPause).toHaveBeenCalledOnce()

    rerender(<SessionHeader {...base} onFinish={vi.fn()} />)
    expect(screen.queryByTestId("btn-pause")).not.toBeInTheDocument()
  })

  it("« Terminer » demande la fin ; absent sans onFinish", () => {
    const onFinish = vi.fn()
    const { rerender } = render(<SessionHeader {...base} onFinish={onFinish} />)

    fireEvent.click(screen.getByTestId("btn-header-finish"))
    expect(onFinish).toHaveBeenCalledOnce()

    rerender(<SessionHeader {...base} />)
    expect(screen.queryByTestId("btn-header-finish")).not.toBeInTheDocument()
  })
})
