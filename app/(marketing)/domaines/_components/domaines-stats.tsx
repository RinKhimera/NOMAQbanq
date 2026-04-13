"use client"

import { BarChart3, BookOpen, Clock, Target } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useMarketingStats } from "@/hooks/useMarketingStats"

const icons = [BookOpen, Target, Clock, BarChart3] as const
const colors = [
  "from-blue-500 to-indigo-600",
  "from-green-500 to-emerald-600",
  "from-purple-500 to-pink-600",
  "from-orange-500 to-red-600",
]
const labels = [
  "Domaines disponibles",
  "Questions au total",
  "Par question",
  "Taux de réussite",
]

export default function DomainesStats() {
  const { stats, isLoading } = useMarketingStats()

  const values = [
    stats ? String(stats.totalDomains) : undefined,
    stats?.totalQuestions,
    "20s",
    stats?.successRate,
  ]

  return (
    <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-4">
      {labels.map((label, index) => {
        const Icon = icons[index]
        const value = values[index]

        return (
          <div
            key={index}
            className="card-modern animate-fade-in-scale p-8 text-center transition-all duration-300 hover:shadow-xl"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div
              className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br ${colors[index]} shadow-lg`}
            >
              <Icon className="h-8 w-8 text-white" />
            </div>
            {isLoading && !value ? (
              <Skeleton className="mx-auto mb-2 h-10 w-24" />
            ) : (
              <p className="font-display mb-2 text-4xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
            )}
            <p className="font-medium text-gray-600 dark:text-gray-300">
              {label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
