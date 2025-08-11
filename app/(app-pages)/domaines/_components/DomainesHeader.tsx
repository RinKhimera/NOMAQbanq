"use client"

import { BookOpen } from "lucide-react"

export default function DomainesHeader() {
  return (
    <div className="animate-fade-in-up mb-20 text-center">
      <div className="mb-8 inline-flex items-center rounded-full border border-blue-200/50 bg-gradient-to-r from-blue-100 to-indigo-100 px-6 py-3 text-sm font-semibold text-blue-700 dark:border-blue-700/50 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300">
        <BookOpen className="mr-2 h-4 w-4" />
        Domaines d&apos;expertise
      </div>
      <h1 className="font-display text-display-lg mb-8 text-gray-900 dark:text-white">
        Domaines d&apos;évaluation
      </h1>
      <p className="text-body-lg mx-auto max-w-4xl leading-relaxed text-gray-600 dark:text-gray-300">
        Explorez nos domaines médicaux spécialisés et testez vos connaissances
        avec des questions adaptées à l&apos;EACMC Partie I
      </p>
    </div>
  )
}
