"use client"

import { BookOpen, Clock, Target } from "lucide-react"

const instructions = [
  {
    icon: Clock,
    title: "Temps limité",
    description:
      "20 secondes par question pour simuler les conditions réelles de l'examen",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: BookOpen,
    title: "Questions variées",
    description:
      "Sélection aléatoire couvrant tous les domaines médicaux de l'EACMC",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Target,
    title: "Résultats détaillés",
    description:
      "Analyse complète de vos performances avec recommandations personnalisées",
    color: "from-purple-500 to-pink-600",
  },
]

export default function EvaluationInstructions() {
  return (
    <div className="mb-16">
      <div className="animate-fade-in-up mb-12 text-center">
        <h2 className="font-display mb-4 text-3xl font-bold text-gray-900 dark:text-white">
          Comment ça fonctionne
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
          Suivez ces étapes simples pour commencer votre évaluation
        </p>
      </div>
      <div className="mb-12 grid gap-8 md:grid-cols-3">
        {instructions.map((instruction, index) => (
          <div
            key={index}
            className="card-feature animate-fade-in-scale"
            style={{ animationDelay: `${index * 0.2}s` }}
          >
            <div
              className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${instruction.color} shadow-lg`}
            >
              <instruction.icon className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-display mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              {instruction.title}
            </h3>
            <p className="leading-relaxed text-gray-600 dark:text-gray-300">
              {instruction.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
