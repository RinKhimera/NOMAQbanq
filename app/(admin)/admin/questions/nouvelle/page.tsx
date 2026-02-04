"use client"

import { ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { QuestionFormPage } from "../_components/question-form-page"

export default function NewQuestionPage() {
  return (
    <div className="@container flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 @md:flex-row @md:items-center @md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Nouvelle question
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Créez une nouvelle question pour la banque QCM
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          asChild
        >
          <Link href="/admin/questions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux questions
          </Link>
        </Button>
      </div>

      {/* Form */}
      <QuestionFormPage mode="create" />
    </div>
  )
}
