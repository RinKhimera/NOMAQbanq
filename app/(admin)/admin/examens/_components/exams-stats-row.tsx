"use client"

import {
  IconCalendarEvent,
  IconClipboardCheck,
  IconClipboardList,
  IconUsers,
} from "@tabler/icons-react"
import {
  AnimatedStatCardSkeleton,
  AnimatedStatCard as StatCard,
} from "@/components/admin/animated-stat-card"

interface ExamsStatsRowProps {
  stats: {
    total: number
    active: number
    upcoming: number
    eligibleCandidates: number
  } | null
  isLoading?: boolean
}

export function ExamsStatsRow({ stats, isLoading }: ExamsStatsRowProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <AnimatedStatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total examens"
        value={stats.total}
        color="emerald"
        delay={0}
        icon={<IconClipboardList className="h-5 w-5" />}
      />

      <StatCard
        label="Examens actifs"
        value={stats.active}
        color="blue"
        delay={0.05}
        subtitle="En cours actuellement"
        icon={<IconClipboardCheck className="h-5 w-5" />}
      />

      <StatCard
        label="À venir"
        value={stats.upcoming}
        color="amber"
        delay={0.1}
        subtitle="Planifiés prochainement"
        icon={<IconCalendarEvent className="h-5 w-5" />}
      />

      <StatCard
        label="Candidats éligibles"
        value={stats.eligibleCandidates}
        color="teal"
        delay={0.15}
        subtitle="Avec accès exam actif"
        icon={<IconUsers className="h-5 w-5" />}
      />
    </div>
  )
}
