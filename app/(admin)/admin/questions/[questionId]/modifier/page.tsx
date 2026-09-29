"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import { QuestionFormPage } from "../../_components/question-form-page"

interface EditQuestionPageProps {
  params: Promise<{
    questionId: string
  }>
}

export default function EditQuestionPage({ params }: EditQuestionPageProps) {
  const { questionId } = use(params)

  return (
    <div className="@container flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      <PageIntro
        title="Modifier la question"
        description="Modifiez les détails de cette question"
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
      <QuestionFormPage mode="edit" questionId={questionId} />
    </div>
  )
}
