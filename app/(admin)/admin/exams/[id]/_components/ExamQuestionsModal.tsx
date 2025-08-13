"use client"

import { useQuery } from "convex/react"
import { CheckCircle, FileText } from "lucide-react"
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

type ExamQuestionsModalProps = {
  examId: Id<"exams">
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExamQuestionsModal({
  examId,
  open,
  onOpenChange,
}: ExamQuestionsModalProps) {
  // No backend? Use exam query when available, else mock fallback
  const exam = useQuery(api.exams.getExamWithQuestions, { examId })

  const data = exam

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card flex max-h-[85vh] max-w-3xl flex-col overflow-hidden p-0">
        {/* Fixed header */}
        <DialogHeader className="bg-card sticky top-0 z-10 border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              <FileText className="h-4 w-4" />
            </div>
            Questions liées à l&apos;examen
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <ScrollArea className="h-72 flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {data?.questions?.length === 0 ? (
              <Card>Aucune question trouvée</Card>
            ) : (
              data?.questions?.map((q, index: number) => (
                <div
                  key={q?._id ?? index}
                  className="bg-muted rounded-lg border p-4 dark:bg-gray-900"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">Question {index + 1}</Badge>
                    <Badge variant="badge">{q?.domain}</Badge>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed">{q?.question}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {q?.options?.map((opt: string, i: number) => {
                      const isCorrect = opt === q?.correctAnswer
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                            isCorrect
                              ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
                              : "border-primary/20 dark:bg-muted/40 bg-blue-200"
                          }`}
                        >
                          <Badge
                            variant={isCorrect ? "default" : "outline"}
                            className="flex h-6 min-w-[24px] items-center justify-center"
                          >
                            {String.fromCharCode(65 + i)}
                          </Badge>
                          <span
                            className={`flex-1 ${isCorrect ? "font-medium" : ""}`}
                          >
                            {opt}
                          </span>
                          {isCorrect && (
                            <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Fixed footer */}
        <DialogFooter className="bg-card sticky bottom-0 z-10 border-t p-3">
          <Button variant="destructive" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
