import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ComposerCounter } from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-counter"
import type { Counter } from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-model"

const counter = (over: Partial<Counter> = {}): Counter => ({
  need: 3,
  over: 0,
  tone: "accent",
  message: "Il reste 3 questions à choisir.",
  ...over,
})

const renderCounter = (
  over: Partial<Parameters<typeof ComposerCounter>[0]> = {},
) => {
  const onComplete = vi.fn()
  render(
    <ComposerCounter
      count={97}
      target={100}
      counter={counter()}
      frozen={false}
      doneHref="/admin/examens/e1/modifier"
      onComplete={onComplete}
      drawing={false}
      busy={false}
      {...over}
    />,
  )
  return { onComplete }
}

describe("ComposerCounter", () => {
  it("affiche le décompte et le message ; « Compléter » lance le tirage", () => {
    const { onComplete } = renderCounter()
    expect(screen.getAllByTestId("composer-count")[0]).toHaveTextContent(
      "97 / 100",
    )
    expect(screen.getByTestId("composer-counter-message")).toHaveTextContent(
      "Il reste 3 questions à choisir.",
    )
    const complete = screen.getByTestId("btn-composer-complete")
    expect(complete).toHaveTextContent("Compléter les 3 restantes")
    expect(
      screen.getByTestId("btn-composer-complete-mobile"),
    ).toHaveTextContent("Compléter les 3")
    fireEvent.click(complete)
    fireEvent.click(screen.getByTestId("btn-composer-complete-mobile"))
    expect(onComplete).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId("btn-composer-done")).toHaveAttribute(
      "href",
      "/admin/examens/e1/modifier",
    )
  })

  it.each([
    ["jeu complet", { counter: counter({ need: 0, tone: "success" }) }],
    ["tirage en cours", { drawing: true }],
    ["écriture en cours", { busy: true }],
  ])("« Compléter » désactivé : %s", (_, over) => {
    renderCounter(over)
    expect(screen.getByTestId("btn-composer-complete")).toBeDisabled()
    expect(screen.getByTestId("btn-composer-complete-mobile")).toBeDisabled()
  })

  it("tirage en cours : spinner dans les deux « Compléter »", () => {
    renderCounter({ drawing: true })
    expect(screen.getAllByRole("status")).toHaveLength(2)
  })

  it("jeu complet : libellés sans nombre", () => {
    renderCounter({
      count: 100,
      counter: counter({ need: 0, tone: "success" }),
    })
    expect(screen.getByTestId("btn-composer-complete")).toHaveTextContent(
      /^Compléter$/,
    )
    expect(
      screen.getByTestId("btn-composer-complete-mobile"),
    ).toHaveTextContent(/^Complet$/)
  })

  it("en trop : décompte en rouge", () => {
    renderCounter({ count: 102, counter: counter({ need: 0, over: 2 }) })
    for (const tally of screen.getAllByTestId("composer-count")) {
      expect(tally).toHaveClass("text-danger-ink")
    }
  })

  it("jeu figé : plus de « Compléter », « Terminé » reste", () => {
    renderCounter({ frozen: true })
    expect(
      screen.queryByTestId("btn-composer-complete"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("btn-composer-complete-mobile"),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Terminé" })).toHaveLength(2)
  })
})
