"use client"

import { use } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Id } from "@/convex/_generated/dataModel"
import { QuestionFormPage } from "../../_components/question-form-page"

interface EditQuestionPageProps {
  params: Promise<{
    questionId: string
  }>
}

export default function EditQuestionPage({ params }: EditQuestionPageProps) {
  const { questionId } = use(params)

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/questions">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-blue-600">
            Modifier la question
          </h1>
          <p className="text-muted-foreground">
            Modifiez les détails de cette question
          </p>
        </div>
      </div>

      {/* Form */}
      <QuestionFormPage
        mode="edit"
        questionId={questionId as Id<"questions">}
      />
    </div>
  )
}
