"use client"

import { Star } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useMarketingStats } from "@/hooks/useMarketingStats"

const staticStats = [
  {
    label: "Candidats accompagnés",
    color: "from-blue-500 to-indigo-600",
    key: "totalUsers" as const,
  },
  {
    label: "Taux de réussite",
    color: "from-green-500 to-emerald-600",
    key: "successRate" as const,
  },
  {
    label: "Questions disponibles",
    color: "from-purple-500 to-pink-600",
    key: "totalQuestions" as const,
  },
  {
    label: "Support réactif",
    color: "from-orange-500 to-red-600",
    key: null,
    staticValue: "Dédié",
  },
]

export default function AboutStats() {
  const { stats, isLoading } = useMarketingStats()

  return (
    <div className="mb-20 grid grid-cols-2 gap-6 md:grid-cols-4">
      {staticStats.map((stat, index) => {
        const value = stat.key ? stats?.[stat.key] : stat.staticValue

        return (
          <div
            key={index}
            className="card-modern animate-fade-in-scale p-8 text-center transition-all duration-300 hover:shadow-xl"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div
              className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br ${stat.color} shadow-lg`}
            >
              <Star className="h-8 w-8 text-white" />
            </div>
            {isLoading && stat.key ? (
              <Skeleton className="mx-auto mb-2 h-10 w-24" />
            ) : (
              <p className="font-display mb-2 text-4xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
            )}
            <p className="font-medium text-gray-600 dark:text-gray-300">
              {stat.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
