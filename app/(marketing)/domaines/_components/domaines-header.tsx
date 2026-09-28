"use client"

import { BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function DomainesHeader() {
  return (
    <div className="mb-20 text-center">
      <Badge variant="badge" className="mb-8 px-6 py-3 text-sm font-semibold">
        <BookOpen className="mr-2 h-4 w-4" />
        Domaines d&apos;expertise
      </Badge>
      <h1 className="font-display mb-8 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl dark:text-white">
        Domaines d&apos;évaluation
      </h1>
      <p className="mx-auto max-w-4xl text-lg leading-relaxed text-gray-600 dark:text-gray-300">
        Explorez nos domaines médicaux spécialisés et testez vos connaissances
        avec des questions adaptées à l&apos;EACMC Partie I
      </p>
    </div>
  )
}
