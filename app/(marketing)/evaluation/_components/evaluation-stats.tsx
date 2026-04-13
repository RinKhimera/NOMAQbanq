"use client"

import { Award } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useMarketingStats } from "@/hooks/useMarketingStats"

const statConfig = [
  {
    label: "Questions disponibles",
    color: "from-blue-500 to-indigo-600",
    key: "totalQuestions" as const,
  },
  {
    label: "Taux de réussite moyen",
    color: "from-green-500 to-emerald-600",
    key: "successRate" as const,
  },
  {
    label: "Domaines médicaux",
    color: "from-purple-500 to-pink-600",
    key: "totalDomains" as const,
  },
  {
    label: "Candidats préparés",
    color: "from-orange-500 to-red-600",
    key: "totalUsers" as const,
  },
]

export default function EvaluationStats() {
  const { stats, isLoading } = useMarketingStats()

  return (
    <div className="mb-12 grid grid-cols-2 gap-6 md:grid-cols-4">
      {statConfig.map((stat, index) => {
        const value = stats?.[stat.key]

        return (
          <div
            key={index}
            className="card-modern animate-fade-in-scale p-6 text-center transition-all duration-300 hover:shadow-xl"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${stat.color} shadow-lg`}
            >
              <Award className="h-6 w-6 text-white" />
            </div>
            {isLoading ? (
              <Skeleton className="mx-auto mb-1 h-8 w-20" />
            ) : (
              <p className="font-display mb-1 text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
            )}
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {stat.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
