"use client"

import { LucideIcon } from "lucide-react"
import { ExamStatCard } from "./ExamStatCard"

export type ExamStatItem = {
  title: string
  value: string | number
  icon: LucideIcon
  iconClassName?: string
}

export function ExamStatsGrid({ items }: { items: ExamStatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((it) => (
        <ExamStatCard
          key={it.title}
          title={it.title}
          value={it.value}
          icon={it.icon}
          iconClassName={it.iconClassName}
        />
      ))}
    </div>
  )
}
