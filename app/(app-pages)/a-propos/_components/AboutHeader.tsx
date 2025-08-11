"use client"

import { Sparkles } from "lucide-react"

export default function AboutHeader() {
  return (
    <div className="animate-fade-in-up mb-20 text-center">
      <div className="mb-8 inline-flex items-center rounded-full border border-blue-200/50 bg-gradient-to-r from-blue-100 to-indigo-100 px-6 py-3 text-sm font-semibold text-blue-700 dark:border-blue-700/50 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300">
        <Sparkles className="mr-2 h-4 w-4" />À propos de NOMAQbank
      </div>
      <h1 className="font-display text-display-lg mb-8 leading-tight text-gray-900 dark:text-white">
        Notre mission et nos engagements
      </h1>
      <p className="text-body-lg mx-auto max-w-4xl leading-relaxed text-gray-600 dark:text-gray-300">
        NOMAQbank accompagne les candidats francophones vers la réussite de
        l&apos;EACMC grâce à des outils modernes, adaptés et validés.
      </p>
    </div>
  )
}
