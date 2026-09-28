"use client"

import { Timer } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const START = 20
const LOW = 5

/** Aperçu du chrono de 20 secondes, en boucle. */
export const TimerDemo = () => {
  const [seconds, setSeconds] = useState(START)

  useEffect(() => {
    const id = setInterval(
      () => setSeconds((s) => (s <= 0 ? START : s - 1)),
      1000,
    )
    return () => clearInterval(id)
  }, [])

  const low = seconds <= LOW
  return (
    <div aria-hidden className="flex items-center gap-2.5">
      <Timer className={cn("size-4", low ? "text-warning" : "text-ink-3")} />
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          low ? "text-warning-ink" : "text-ink",
        )}
      >
        00:{String(seconds).padStart(2, "0")}
      </span>
      <span className="bg-line h-1 w-24 overflow-hidden rounded-xs">
        <span
          className={cn("block h-full", low ? "bg-warning" : "bg-accent")}
          style={{ width: `${(seconds / START) * 100}%` }}
        />
      </span>
    </div>
  )
}
