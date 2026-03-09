import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

describe("SessionToolbar", () => {
  it("affiche le bouton calculatrice quand showCalculator est vrai", () => {
    const onOpenCalculator = vi.fn()
    render(
      <SessionToolbar
        showCalculator={true}
        onOpenCalculator={onOpenCalculator}
        showLabValues={false}
      />,
    )

    const calcBtn = screen.getByTestId("btn-calculator")
    expect(calcBtn).toBeInTheDocument()
    fireEvent.click(calcBtn)
    expect(onOpenCalculator).toHaveBeenCalledOnce()
  })

  it("n'affiche pas le bouton calculatrice quand showCalculator est faux", () => {
    render(
      <SessionToolbar showCalculator={false} showLabValues={false} />,
    )

    expect(screen.queryByTestId("btn-calculator")).not.toBeInTheDocument()
  })

  it("n'affiche pas le bouton calculatrice sans callback", () => {
    render(
      <SessionToolbar
        showCalculator={true}
        onOpenCalculator={undefined}
        showLabValues={false}
      />,
    )

    expect(screen.queryByTestId("btn-calculator")).not.toBeInTheDocument()
  })

  it("affiche le bouton valeurs de labo quand showLabValues est vrai", () => {
    const onOpenLabValues = vi.fn()
    render(
      <SessionToolbar
        showCalculator={false}
        showLabValues={true}
        onOpenLabValues={onOpenLabValues}
      />,
    )

    const labBtn = screen.getByTestId("btn-lab-values")
    expect(labBtn).toBeInTheDocument()
    fireEvent.click(labBtn)
    expect(onOpenLabValues).toHaveBeenCalledOnce()
  })

  it("n'affiche pas le bouton valeurs de labo quand showLabValues est faux", () => {
    render(
      <SessionToolbar showCalculator={false} showLabValues={false} />,
    )

    expect(screen.queryByTestId("btn-lab-values")).not.toBeInTheDocument()
  })

  it("affiche les labels accessibles corrects", () => {
    render(
      <SessionToolbar
        showCalculator={true}
        onOpenCalculator={vi.fn()}
        showLabValues={true}
        onOpenLabValues={vi.fn()}
      />,
    )

    expect(
      screen.getByLabelText("Ouvrir la calculatrice"),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Ouvrir les valeurs de laboratoire"),
    ).toBeInTheDocument()
  })

  it("affiche le navFab quand showNavFab est vrai", () => {
    render(
      <SessionToolbar
        showCalculator={false}
        showLabValues={false}
        navFab={<button data-testid="nav-fab-content">Nav</button>}
        showNavFab={true}
      />,
    )

    expect(screen.getByTestId("nav-fab-content")).toBeInTheDocument()
  })

  it("n'affiche pas le navFab quand showNavFab est faux", () => {
    render(
      <SessionToolbar
        showCalculator={false}
        showLabValues={false}
        navFab={<button data-testid="nav-fab-content">Nav</button>}
        showNavFab={false}
      />,
    )

    expect(screen.queryByTestId("nav-fab-content")).not.toBeInTheDocument()
  })
})
