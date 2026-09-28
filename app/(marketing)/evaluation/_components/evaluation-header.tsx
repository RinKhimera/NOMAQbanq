"use client"

import { Target } from "lucide-react"

export default function EvaluationHeader() {
  return (
    <div className="mb-20 text-center">
      <div className="mb-8 inline-flex items-center rounded-full border border-blue-200/50 bg-linear-to-r from-blue-100 to-indigo-100 px-6 py-3 text-sm font-semibold text-blue-700 dark:border-blue-700/50 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300">
        <Target className="mr-2 h-4 w-4" />
        Évaluation EACMC Partie I
      </div>
      <h1 className="font-display mb-8 text-4xl leading-tight font-semibold tracking-tight text-gray-900 md:text-5xl dark:text-white">
        Testez vos connaissances
        <span className="text-accent-ink block">en conditions réelles</span>
      </h1>
      <p className="mx-auto max-w-4xl text-lg leading-relaxed text-gray-600 dark:text-gray-300">
        Évaluez votre niveau avec des questions authentiques adaptées à
        l&apos;examen d&apos;aptitude du Conseil médical du Canada. Obtenez un
        feedback détaillé pour optimiser votre préparation.
      </p>
    </div>
  )
}
