"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion } from "motion/react"
import Image from "next/image"
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  ImageIcon,
  Pencil,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

interface QuestionSidePanelProps {
  questionId: Id<"questions"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

function PanelSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>

      {/* Options skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>

      {/* Explanation skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

function PanelContent({
  questionId,
  onDeleted,
}: {
  questionId: Id<"questions">
  onDeleted?: () => void
}) {
  const [isExplanationOpen, setIsExplanationOpen] = useState(true)
  const [isReferencesOpen, setIsReferencesOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const question = useQuery(api.questions.getQuestionById, { questionId })
  const deleteQuestion = useMutation(api.questions.deleteQuestion)

  const handleCopyId = () => {
    navigator.clipboard.writeText(questionId)
    toast.success("ID copié")
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteQuestion({ id: questionId })
      toast.success("Question supprimée")
      setShowDeleteDialog(false)
      onDeleted?.()
    } catch {
      toast.error("Erreur lors de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  if (question === undefined) {
    return <PanelSkeleton />
  }

  if (!question) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Question non trouvée</p>
      </div>
    )
  }

  const hasImages = question.images && question.images.length > 0
  const hasReferences = question.references && question.references.length > 0

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-1"
      >
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          >
            {question.domain}
          </Badge>
          <Badge
            variant="outline"
            className="border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
          >
            {question.objectifCMC}
          </Badge>
        </div>

        {/* Question Text */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Question
          </h4>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {question.question}
          </p>
        </div>

        {/* Images */}
        {hasImages && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Images ({question.images!.length})
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {question.images!.map((img, idx) => (
                <a
                  key={idx}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
                >
                  <Image
                    src={img.url}
                    alt={`Image ${idx + 1}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 200px"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-5 w-5 text-white" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Options
          </h4>
          <div className="space-y-2">
            {question.options.map((option, idx) => {
              const isCorrect = option === question.correctAnswer
              const letter = String.fromCharCode(65 + idx) // A, B, C, D, E

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                    isCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isCorrect
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    )}
                  >
                    {isCorrect ? <Check className="h-3.5 w-3.5" /> : letter}
                  </div>
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      isCorrect
                        ? "font-medium text-emerald-800 dark:text-emerald-300"
                        : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {option}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Explanation (Toggle) */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => setIsExplanationOpen(!isExplanationOpen)}
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Explication
              </h4>
            </div>
            {isExplanationOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </Button>
          {isExplanationOpen && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm leading-relaxed text-blue-800 dark:text-blue-300">
                {question.explanation}
              </p>
            </div>
          )}
        </div>

        {/* References (Toggle) */}
        {hasReferences && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              onClick={() => setIsReferencesOpen(!isReferencesOpen)}
              className="flex w-full items-center justify-between p-0 hover:bg-transparent"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Références ({question.references!.length})
                </h4>
              </div>
              {isReferencesOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </Button>
            {isReferencesOpen && (
              <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {question.references!.map((ref, idx) => (
                  <li key={idx}>{ref}</li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2 rounded-xl bg-gray-50/80 p-4 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Créée le{" "}
              {format(new Date(question._creationTime), "d MMMM yyyy 'à' HH:mm", {
                locale: fr,
              })}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-xs text-gray-400">
              ID: {questionId.slice(0, 12)}...
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={handleCopyId}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/admin/questions/${questionId}/modifier`} className="flex-1">
            <Button variant="outline" className="w-full gap-2">
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
          </Link>
          <Button
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Supprimer cette question ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La question sera définitivement
              supprimée de la banque de questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function QuestionSidePanel({
  questionId,
  open,
  onOpenChange,
  onDeleted,
}: QuestionSidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-105 overflow-y-auto sm:max-w-105"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Détails de la question</SheetTitle>
          <SheetDescription>
            Informations complètes sur la question
          </SheetDescription>
        </SheetHeader>
        {questionId ? (
          <PanelContent questionId={questionId} onDeleted={onDeleted} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">Sélectionnez une question</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
