"use client"

import { FileText } from "lucide-react"
import ReusableQuestionCard from "@/components/reusable-question-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Doc } from "@/convex/_generated/dataModel"

export function ExamQuestions({
  examQuestions,
}: {
  examQuestions: Doc<"questions">[]
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-blue-600 dark:text-white">
              Questions de l&apos;examen
            </CardTitle>
            <CardDescription>
              Liste des questions composant cet examen
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {examQuestions.map((question, index) => (
            <ReusableQuestionCard
              key={question?._id}
              question={question}
              questionNumber={index + 1}
              actions={[]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
