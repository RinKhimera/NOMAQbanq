import type { ComponentPropsWithoutRef } from "react"
import { vi } from "vitest"

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

export const filterMotionProps = <T extends Record<string, unknown>>(
  props: T,
) =>
  Object.fromEntries(
    Object.entries(props).filter(([key]) => !motionPropsToFilter.has(key)),
  )

/**
 * Call vi.mock("motion/react", ...) with this factory in each test file.
 * Usage:
 *   vi.mock("motion/react", () => motionMockFactory)
 */
export const motionMockFactory = {
  motion: {
    div: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"div"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <div {...filtered}>{children}</div>
    },
    button: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"button"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <button {...filtered}>{children}</button>
    },
    span: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"span"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <span {...filtered}>{children}</span>
    },
    p: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"p"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <p {...filtered}>{children}</p>
    },
    li: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"li"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <li {...filtered}>{children}</li>
    },
    tr: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"tr"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <tr {...filtered}>{children}</tr>
    },
    h2: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"h2"> & Record<string, unknown>) => {
      const filtered = filterMotionProps(props)
      return <h2 {...filtered}>{children}</h2>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: () => false,
  useInView: () => true,
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    set: vi.fn(),
  }),
}
