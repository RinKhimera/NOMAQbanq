"use client"

import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AboutHeader() {
  return (
    <div className="animate-fade-in-up mb-20 text-center">
      <Badge variant="badge" className="mb-8 px-6 py-3 text-sm font-semibold">
        <Sparkles className="mr-2 h-4 w-4" />À propos de NOMAQbanq
      </Badge>
      <h1 className="font-display text-display-lg mb-8 leading-tight text-gray-900 dark:text-white">
        Notre mission et nos engagements
      </h1>
      <p className="text-body-lg mx-auto max-w-4xl leading-relaxed text-gray-600 dark:text-gray-300">
        NOMAQbanq accompagne les candidats francophones vers la réussite de
        l&apos;EACMC grâce à des outils modernes, adaptés et validés.
      </p>
    </div>
  )
}
