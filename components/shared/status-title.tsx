"use client"

import { type ReactNode, useEffect, useRef } from "react"

/** `h1` d'une `StatusCard`, qui peut prendre le focus à son apparition. */
export const StatusTitle = ({
  focusOnMount,
  children,
}: {
  focusOnMount: boolean
  children: ReactNode
}) => {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusOnMount) ref.current?.focus()
  }, [focusOnMount])

  return (
    <h1
      ref={ref}
      tabIndex={focusOnMount ? -1 : undefined}
      className="type-h2 text-ink outline-none"
    >
      {children}
    </h1>
  )
}
