import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { SessionHeader } from "@/components/quiz/session/session-header"
import type { SessionConfig } from "@/components/quiz/session/types"

// Hoist the motion props filter for ESM compatibility
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

// Mock motion/react with header support
vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"div"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <div {...filtered}>{children}</div>
    },
    header: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"header"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <header {...filtered}>{children}</header>
    },
    button: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"button"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <button {...filtered}>{children}</button>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock exam-timer
vi.mock("@/lib/exam-timer", () => ({
  formatExamTime: (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  },
}))

describe("SessionHeader", () => {
  const baseConfig: SessionConfig = {
    mode: "training",
    accentColor: "emerald",
  }

  const defaultProps = {
    config: baseConfig,
    currentIndex: 3,
    totalQuestions: 20,
    answeredCount: 5,
    onFinish: vi.fn(),
    title: "Entraînement",
    icon: <span data-testid="test-icon">E</span>,
    backUrl: "/entrainement",
  }

  it("affiche le titre et le badge de question", () => {
    render(<SessionHeader {...defaultProps} />)

    expect(screen.getByText("Entraînement")).toBeInTheDocument()
    expect(screen.getByText(/Question 4 \/ 20/)).toBeInTheDocument()
  })

  it("affiche le compteur de progression", () => {
    render(<SessionHeader {...defaultProps} />)

    expect(screen.getByText("5/20")).toBeInTheDocument()
  })

  it("n'affiche pas le timer en mode entraînement", () => {
    render(<SessionHeader {...defaultProps} />)

    // No Clock timer should be shown when showTimer is not set
    expect(screen.queryByText("00:30:00")).not.toBeInTheDocument()
  })

  it("affiche le timer en mode examen avec showTimer", () => {
    render(
      <SessionHeader
        {...defaultProps}
        config={{
          ...baseConfig,
          mode: "exam",
          showTimer: true,
          timeRemaining: 30 * 60 * 1000,
        }}
      />,
    )

    expect(screen.getByText("00:30:00")).toBeInTheDocument()
  })

  it("applique le style critique quand isTimeCritical est vrai", () => {
    render(
      <SessionHeader
        {...defaultProps}
        config={{
          ...baseConfig,
          mode: "exam",
          showTimer: true,
          timeRemaining: 3 * 60 * 1000,
          isTimeCritical: true,
        }}
      />,
    )

    const timerText = screen.getByText("00:03:00")
    const timerContainer = timerText.closest("div")
    expect(timerContainer?.className).toContain("animate-pulse")
    expect(timerContainer?.className).toContain("border-red-400")
  })

  it("applique le style ambre quand isTimeRunningOut est vrai", () => {
    render(
      <SessionHeader
        {...defaultProps}
        config={{
          ...baseConfig,
          mode: "exam",
          showTimer: true,
          timeRemaining: 7 * 60 * 1000,
          isTimeRunningOut: true,
        }}
      />,
    )

    const timerText = screen.getByText("00:07:00")
    const timerContainer = timerText.closest("div")
    expect(timerContainer?.className).toContain("border-amber-200")
  })

  it("affiche le bouton pause quand canTakePause est vrai", () => {
    const onTakePause = vi.fn()
    render(
      <SessionHeader
        {...defaultProps}
        examActions={{ canTakePause: true, onTakePause }}
      />,
    )

    const pauseBtn = screen.getByLabelText("Mettre en pause l'examen")
    expect(pauseBtn).toBeInTheDocument()
    fireEvent.click(pauseBtn)
    expect(onTakePause).toHaveBeenCalledOnce()
  })

  it("n'affiche pas le bouton pause quand canTakePause est faux", () => {
    render(
      <SessionHeader {...defaultProps} examActions={{ canTakePause: false }} />,
    )

    expect(
      screen.queryByLabelText("Mettre en pause l'examen"),
    ).not.toBeInTheDocument()
  })

  it("appelle onFinish au clic sur le bouton Terminer", () => {
    const onFinish = vi.fn()
    render(<SessionHeader {...defaultProps} onFinish={onFinish} />)

    fireEvent.click(screen.getByTestId("btn-header-finish"))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it("applique le style bleu avec accentColor blue", () => {
    render(
      <SessionHeader
        {...defaultProps}
        config={{ ...baseConfig, accentColor: "blue" }}
      />,
    )

    const finishBtn = screen.getByTestId("btn-header-finish")
    expect(finishBtn.className).toContain("from-blue-600")
  })

  it("rend le lien de retour correctement", () => {
    render(<SessionHeader {...defaultProps} />)

    const link = screen.getByText("Entraînement").closest("a")
    expect(link).toHaveAttribute("href", "/entrainement")
  })
})
