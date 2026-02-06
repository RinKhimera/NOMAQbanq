"use client"

import { cn } from "@/lib/utils"
import { motion, useReducedMotion } from "motion/react"

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
}

export const ProgressRing = ({
  value,
  size = 160,
  strokeWidth = 12,
  className,
}: ProgressRingProps) => {
  const shouldReduceMotion = useReducedMotion()

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return { stroke: "#10B981", glow: "rgba(16, 185, 129, 0.3)" }
    if (score >= 60) return { stroke: "#3B82F6", glow: "rgba(59, 130, 246, 0.3)" }
    if (score >= 40) return { stroke: "#F59E0B", glow: "rgba(245, 158, 11, 0.3)" }
    return { stroke: "#EF4444", glow: "rgba(239, 68, 68, 0.3)" }
  }

  const colors = getScoreColor(value)

  return (
    <div className={cn("relative", className)}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-50"
        style={{
          background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
        }}
      />

      <svg
        width={size}
        height={size}
        className="-rotate-90 transform"
        style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />

        {/* Animated progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: shouldReduceMotion ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: 1.5,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.3,
                }
          }
        />

        {/* Inner decorative circles */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth - 4}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="text-gray-100 dark:text-gray-800"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-display text-4xl font-bold tracking-tight"
          style={{ color: colors.stroke }}
          initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.8 }
          }
        >
          {value}%
        </motion.span>
        <motion.span
          className="text-muted-foreground text-xs font-medium uppercase tracking-widest"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 1 }
          }
        >
          Score moyen
        </motion.span>
      </div>
    </div>
  )
}
