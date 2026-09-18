import { Trophy, Users } from "lucide-react"
import type { LeaderboardEntry } from "@/features/exams/dal"
import { ExamStatItem } from "@/types"
import { ExamStatCard } from "./exam-stat-card"

export function ExamSectionStats({
  leaderboard,
}: {
  leaderboard: LeaderboardEntry[]
}) {
  const participants = leaderboard
  // Un score retenu (`null`) ne pèse pas dans les agrégats.
  const scores = leaderboard.flatMap((p) => (p.score === null ? [] : [p.score]))

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
        scores.length > 0
          ? `${Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)}%`
          : "0%",
      icon: Trophy,
      iconClassName:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
    {
      title: "Meilleur score",
      value: scores.length > 0 ? `${Math.max(...scores)}%` : "0%",
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
