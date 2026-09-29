import { BookOpen, ClipboardCheck, History, Receipt } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import type { ActivityItem } from "@/features/analytics/dal"
import { formatDayMonth } from "@/lib/format"
import { formatScore } from "@/lib/score"

const questions = (n: number) => `${n} question${n > 1 ? "s" : ""}`

const activityCopy = (item: ActivityItem) => {
  switch (item.kind) {
    case "exam":
      return {
        icon: ClipboardCheck,
        title: item.title,
        detail: `Examen blanc soumis · ${questions(item.questionCount)} · ${formatScore(item.score)}`,
      }
    case "series":
      return {
        icon: BookOpen,
        title: `Série terminée · ${item.domain ?? "Tous domaines"}`,
        detail: `${questions(item.questionCount)} · ${formatScore(item.score)}`,
      }
    case "purchase":
      return {
        icon: Receipt,
        title: item.product ?? "Achat",
        detail: "Paiement confirmé",
      }
  }
}

/** Dernières actions : examens soumis, séries closes, achats. */
export const RecentActivity = ({ items }: { items: ActivityItem[] }) => {
  if (items.length === 0) {
    return (
      <EmptyState
        size="compact"
        icons={[History]}
        title="Aucune activité pour le moment"
        description="Vos séries, examens blancs et achats apparaîtront ici."
      />
    )
  }

  return (
    <ol className="flex flex-col">
      {items.map((item) => {
        const { icon: Icon, title, detail } = activityCopy(item)
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="border-line grid grid-cols-[1.125rem_minmax(0,1fr)_auto] items-start gap-3 border-t py-3 first:border-t-0 first:pt-0"
          >
            <Icon className="text-ink-3 mt-0.5 size-4" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-ink truncate text-sm font-medium">{title}</p>
              <p className="text-ink-3 font-mono text-xs">{detail}</p>
            </div>
            <span className="text-ink-3 text-xs whitespace-nowrap">
              {formatDayMonth(item.at)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
