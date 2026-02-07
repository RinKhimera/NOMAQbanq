"use client"

import { ReactNode } from "react"
import { motion } from "motion/react"

type AccentColor = "blue" | "violet" | "amber"

interface LegalSectionProps {
  id: string
  number: number
  title: string
  children: ReactNode
  accentColor?: AccentColor
}

const dotColors: Record<AccentColor, string> = {
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
}

const hoverColors: Record<AccentColor, string> = {
  blue: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20",
  violet: "group-hover:bg-violet-50 dark:group-hover:bg-violet-950/20",
  amber: "group-hover:bg-amber-50 dark:group-hover:bg-amber-950/20",
}

export const LegalSection = ({
  id,
  number,
  title,
  children,
  accentColor = "blue",
}: LegalSectionProps) => {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="group relative scroll-mt-28 pb-12 pl-10 last:pb-0"
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ${dotColors[accentColor]} text-xs font-bold text-white shadow-md transition-transform group-hover:scale-110`}
      >
        {number}
      </div>

      {/* Content card */}
      <div
        className={`rounded-2xl border border-transparent bg-white/50 p-6 transition-all duration-300 dark:bg-gray-900/30 ${hoverColors[accentColor]} group-hover:border-gray-200/60 group-hover:shadow-sm dark:group-hover:border-gray-800/60`}
      >
        {/* Section title */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>

        {/* Section content */}
        <div className="mt-4 space-y-4 text-gray-600 leading-relaxed dark:text-gray-400">
          {children}
        </div>
      </div>
    </motion.section>
  )
}

// Export type for use in pages
export type { AccentColor }
