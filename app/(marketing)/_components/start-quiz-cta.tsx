"use client"

import { Play } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function StartQuizCTA() {
  return (
    <div className="animate-fade-in-up text-center">
      <Link href="/evaluation/quiz">
        <Button className="btn-modern rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-12 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl">
          <Play className="mr-3 h-6 w-6" />
          Commencer le Quiz
        </Button>
      </Link>
      <p className="mx-auto mt-4 max-w-md text-sm text-gray-600 dark:text-gray-300">
        10 questions • 20 secondes par question • Feedback instantané
      </p>
    </div>
  )
}

