"use client"

import { useQuery } from "convex/react"
import { CheckCircle, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

export function ExamQuestions({ examId }: { examId: Id<"exams"> }) {
  const exam = useQuery(api.exams.getExamWithQuestions, { examId })
  if (!exam) return null

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
          {exam.questions?.map((question, index) => (
            <div key={question?._id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">Question {index + 1}</Badge>
                    <Badge variant="badge">{question?.domain}</Badge>
                  </div>
                  <p className="line-clamp-5 text-sm leading-relaxed @lg:line-clamp-3">
                    {question?.question}
                  </p>
                </div>
              </div>
              <Separator className="my-3" />
              {/* Options de réponse */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {question?.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                      option === question.correctAnswer
                        ? "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "border-primary/20 bg-muted dark:bg-gray-900"
                    }`}
                  >
                    <Badge
                      variant={
                        option === question.correctAnswer
                          ? "default"
                          : "outline"
                      }
                      className="flex h-6 min-w-[24px] flex-shrink-0 items-center justify-center"
                    >
                      {String.fromCharCode(65 + optionIndex)}
                    </Badge>
                    <span
                      className={`flex-1 ${option === question.correctAnswer ? "font-medium" : ""}`}
                    >
                      {option}
                    </span>
                    {option === question.correctAnswer && (
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
