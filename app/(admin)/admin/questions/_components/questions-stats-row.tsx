"use client"

import {
  IconCategory,
  IconListDetails,
  IconPhoto,
  IconPhotoOff,
} from "@tabler/icons-react"
import {
  AnimatedStatCardSkeleton,
  AnimatedStatCard as StatCard,
} from "@/components/admin/animated-stat-card"

interface QuestionsStatsRowProps {
  stats: {
    totalCount: number
    withImagesCount: number
    withoutImagesCount: number
    uniqueDomainsCount: number
  } | null
  isLoading?: boolean
}

export function QuestionsStatsRow({
  stats,
  isLoading,
}: QuestionsStatsRowProps) {
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
        label="Total questions"
        value={stats.totalCount.toLocaleString("fr-CA")}
        color="emerald"
        delay={0}
        subtitle="dans la banque"
        icon={<IconListDetails className="h-5 w-5" />}
      />

      <StatCard
        label="Avec images"
        value={stats.withImagesCount.toLocaleString("fr-CA")}
        color="blue"
        delay={0.05}
        subtitle={`${stats.totalCount > 0 ? Math.round((stats.withImagesCount / stats.totalCount) * 100) : 0}% du total`}
        icon={<IconPhoto className="h-5 w-5" />}
      />

      <StatCard
        label="Sans images"
        value={stats.withoutImagesCount.toLocaleString("fr-CA")}
        color="slate"
        delay={0.1}
        subtitle={`${stats.totalCount > 0 ? Math.round((stats.withoutImagesCount / stats.totalCount) * 100) : 0}% du total`}
        icon={<IconPhotoOff className="h-5 w-5" />}
      />

      <StatCard
        label="Domaines couverts"
        value={stats.uniqueDomainsCount}
        color="teal"
        delay={0.15}
        subtitle="spécialités médicales"
        icon={<IconCategory className="h-5 w-5" />}
      />
    </div>
  )
}
