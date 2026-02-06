"use client"

import { Award } from "lucide-react"

const stats = [
  {
    number: "2270",
    label: "Questions disponibles",
    color: "from-blue-500 to-indigo-600",
  },
  {
    number: "85%",
    label: "Taux de réussite moyen",
    color: "from-green-500 to-emerald-600",
  },
  {
    number: "6",
    label: "Domaines médicaux",
    color: "from-purple-500 to-pink-600",
  },
  {
    number: "4000+",
    label: "Candidats préparés",
    color: "from-orange-500 to-red-600",
  },
]

export default function EvaluationStats() {
  return (
    <div className="mb-12 grid grid-cols-2 gap-6 md:grid-cols-4">
      {stats.map((stat, index) => (
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
          <p className="font-display mb-1 text-2xl font-bold text-gray-900 dark:text-white">
            {stat.number}
          </p>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  )
}
