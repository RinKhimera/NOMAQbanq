"use client"

import { motion, useReducedMotion } from "motion/react"
import { scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"

interface ScoreRingProps {
  value: number
  label?: string
  size?: number
  strokeWidth?: number
  className?: string
}

export const ScoreRing = ({
  value,
  label = "Score moyen",
  size = 160,
  strokeWidth = 12,
  className,
}: ScoreRingProps) => {
  const shouldReduceMotion = useReducedMotion()

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  const color = TONE_COLOR[scoreTone(value)]

  return (
    <div className={cn("relative", className)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-2"
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          initial={{
            strokeDashoffset: shouldReduceMotion ? offset : circumference,
          }}
          animate={{ strokeDashoffset: offset }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.9, ease: [0.2, 0, 0, 1], delay: 0.2 }
          }
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-serif text-4xl font-semibold tracking-tight tabular-nums"
          style={{ color }}
        >
          {value}%
        </span>
        <span className="text-ink-3 font-mono text-xs font-medium tracking-[0.06em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}
