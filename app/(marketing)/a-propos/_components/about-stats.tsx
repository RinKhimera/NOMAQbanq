"use client"

import { Star } from "lucide-react"

const stats = [
  {
    number: "4000+",
    label: "Candidats accompagnés",
    color: "from-blue-500 to-indigo-600",
  },
  {
    number: "85%",
    label: "Taux de réussite",
    color: "from-green-500 to-emerald-600",
  },
  {
    number: "5000+",
    label: "Questions disponibles",
    color: "from-purple-500 to-pink-600",
  },
  {
    number: "24/7",
    label: "Support disponible",
    color: "from-orange-500 to-red-600",
  },
]

export default function AboutStats() {
  return (
    <div className="mb-20 grid grid-cols-2 gap-6 md:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="card-modern animate-fade-in-scale p-8 text-center transition-all duration-300 hover:shadow-xl"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div
            className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg`}
          >
            <Star className="h-8 w-8 text-white" />
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
