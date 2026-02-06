"use client"

import { BarChart3, BookOpen, Clock, Target } from "lucide-react"

const stats = [
  {
    icon: BookOpen,
    number: "6",
    label: "Domaines disponibles",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Target,
    number: "2270",
    label: "Questions au total",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Clock,
    number: "20s",
    label: "Par question",
    color: "from-purple-500 to-pink-600",
  },
  {
    icon: BarChart3,
    number: "85%",
    label: "Taux de réussite",
    color: "from-orange-500 to-red-600",
  },
]

export default function DomainesStats() {
  return (
    <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="card-modern animate-fade-in-scale p-8 text-center transition-all duration-300 hover:shadow-xl"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div
            className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br ${stat.color} shadow-lg`}
          >
            <stat.icon className="h-8 w-8 text-white" />
          </div>
          <p className="font-display mb-2 text-4xl font-bold text-gray-900 dark:text-white">
            {stat.number}
          </p>
          <p className="font-medium text-gray-600 dark:text-gray-300">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  )
}
