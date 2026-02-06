"use client"

import { useQuery } from "convex/react"
import { ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { useState } from "react"
import QuestionDetailsDialog from "@/components/admin/question-details-dialog"
import { QuestionCard, createViewAction } from "@/components/quiz/question-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Doc } from "@/convex/_generated/dataModel"

type ExamQuestionsModalProps = {
  examId: Id<"exams">
  open: boolean
  onOpenChange: (open: boolean) => void
}

const QUESTIONS_PER_PAGE = 10

export function ExamQuestionsModal({
  examId,
  open,
  onOpenChange,
}: ExamQuestionsModalProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedQuestion, setSelectedQuestion] =
    useState<Doc<"questions"> | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const exam = useQuery(api.exams.getExamWithQuestions, { examId })

  const questions = exam?.questions?.filter((q) => q !== null) || []
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE)
  const startIndex = currentPage * QUESTIONS_PER_PAGE
  const endIndex = startIndex + QUESTIONS_PER_PAGE
  const currentQuestions = questions.slice(startIndex, endIndex)

  const handleViewDetails = (question: Doc<"questions">) => {
    setSelectedQuestion(question)
    setIsDetailsOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card flex max-h-[90vh] w-full max-w-6xl! flex-col overflow-hidden p-0">
          {/* Fixed header */}
          <DialogHeader className="bg-card sticky top-0 z-10 border-b p-4">
            <DialogTitle className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-1">
                <span>Questions liées à l&apos;examen</span>
                <span className="text-xs font-normal text-gray-500">
                  Page {currentPage + 1} sur {totalPages || 1} (
                  {questions.length} questions)
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center text-gray-500">
                  Aucune question trouvée
                </div>
              ) : (
                currentQuestions.map((q, index) => {
                  const questionNumber = startIndex + index + 1

                  return (
                    <QuestionCard
                      key={q._id}
                      variant="default"
                      question={q}
                      questionNumber={questionNumber}
                      showCorrectAnswer={true}
                      showImage={false}
                      actions={[createViewAction(() => handleViewDetails(q))]}
                    />
                  )
                })
              )}
            </div>
          </div>

          {/* Fixed footer with pagination */}
          <div className="bg-card sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Précédent
            </Button>

            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage + 1} / {totalPages || 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
              }
              disabled={currentPage === totalPages - 1}
            >
              Suivant
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Details Dialog */}
      {selectedQuestion && (
        <QuestionDetailsDialog
          question={selectedQuestion}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      )}
    </>
  )
}
