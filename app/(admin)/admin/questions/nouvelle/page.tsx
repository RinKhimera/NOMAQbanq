"use client"

import { ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import { QuestionFormPage } from "../_components/question-form-page"

export default function NewQuestionPage() {
  return (
    <div className="@container flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      <PageIntro
        icon={Sparkles}
        colorScheme="blue"
        title="Nouvelle question"
        description="Créez une nouvelle question pour la banque QCM"
        actions={
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
        }
      />

      {/* Form */}
      <QuestionFormPage mode="create" />
    </div>
  )
}
