"use client"

import { BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function DomainesHeader() {
  return (
    <div className="animate-fade-in-up mb-20 text-center">
      <Badge variant="badge" className="mb-8 px-6 py-3 text-sm font-semibold">
        <BookOpen className="mr-2 h-4 w-4" />
        Domaines d&apos;expertise
      </Badge>
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
