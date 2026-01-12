"use client"

import { Trophy, Users } from "lucide-react"
import { Doc } from "@/convex/_generated/dataModel"
import { ExamStatItem } from "@/types"
import { ExamStatCard } from "./exam-stat-card"

export function ExamSectionStats({ exam }: { exam: Doc<"exams"> }) {
  const participants = exam.participants ?? []
  const statItems: ExamStatItem[] = [
    {
      title: "Participants",
      value: participants.length,
      icon: Users,
      iconClassName:
        "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    },
    {
      title: "Score moyen",
      value:
        participants.length > 0
          ? `${Math.round(
              participants.reduce((sum, p) => sum + p.score, 0) /
                participants.length,
            )}%`
          : "0%",
      icon: Trophy,
      iconClassName:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
    {
      title: "Meilleur score",
      value:
        participants.length > 0
          ? `${Math.max(...participants.map((p) => p.score))}%`
          : "0%",
      icon: Trophy,
      iconClassName:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {statItems.map((it) => (
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
