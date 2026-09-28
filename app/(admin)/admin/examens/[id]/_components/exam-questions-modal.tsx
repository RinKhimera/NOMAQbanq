"use client"

import { FileText } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import QuestionDetailsDialog from "@/components/admin/question-details-dialog"
import { QuestionCard, createViewAction } from "@/components/quiz/question-card"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { TablePagination } from "@/components/shared/data-table/table-pagination"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { loadQuestionById } from "@/features/questions/actions"
import type { QuestionDetail } from "@/features/questions/dal"

type ExamQuestionsModalProps = {
  questions: QuizQuestion[]
  open: boolean
  onOpenChange: (open: boolean) => void
  // Le détail par question charge le doc complet via loadQuestionById (admin
  // only). Désactivé côté étudiant.
  enableDetails?: boolean
}

const QUESTIONS_PER_PAGE = 10

export function ExamQuestionsModal({
  questions,
  open,
  onOpenChange,
  enableDetails = false,
}: ExamQuestionsModalProps) {
  const [page, setPage] = useState(1)
  // Détails à la demande : on charge le doc complet (avec explication jointe
  // côté serveur) via loadQuestionById quand l'admin ouvre une question.
  const [selectedQuestion, setSelectedQuestion] =
    useState<QuestionDetail | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE)
  const startIndex = (page - 1) * QUESTIONS_PER_PAGE
  const currentQuestions = questions.slice(
    startIndex,
    startIndex + QUESTIONS_PER_PAGE,
  )

  const handleViewDetails = async (questionId: string) => {
    setIsDetailsOpen(true)
    try {
      const q = await loadQuestionById(questionId)
      setSelectedQuestion(q)
    } catch {
      // rejet réseau : refermer le dialog (sinon il reste ouvert et vide)
      setIsDetailsOpen(false)
      toast.error("Chargement impossible. Vérifiez votre réseau.")
    }
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
                  Page {page} sur {totalPages || 1} ({questions.length}{" "}
                  questions)
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {questions.length === 0 ? (
                <EmptyState size="compact" title="Aucune question trouvée" />
              ) : (
                currentQuestions.map((q, index) => (
                  <QuestionCard
                    key={q._id}
                    variant="default"
                    question={q}
                    questionNumber={startIndex + index + 1}
                    showCorrectAnswer={true}
                    showImage={false}
                    actions={
                      enableDetails
                        ? [createViewAction(() => handleViewDetails(q._id))]
                        : []
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div className="bg-card sticky bottom-0 z-10">
            <TablePagination
              page={page}
              pageSize={QUESTIONS_PER_PAGE}
              total={questions.length}
              onPageChange={setPage}
              itemNoun={{ one: "question", many: "questions" }}
            />
          </div>
        </DialogContent>
      </Dialog>

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
