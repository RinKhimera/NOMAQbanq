"use client"

import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react"
import { motion } from "motion/react"
import Image from "next/image"
import { type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { loadQuestionById } from "@/features/questions/actions"
import type { QuestionDetail } from "@/features/questions/dal"
import { cdnUrl } from "@/lib/cdn"
import { formatLongDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface QuestionDetailModalProps {
  questionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rendu sous les options. */
  insights?: (questionId: string) => ReactNode
  /**
   * Actions du pied, toujours visibles ; masquées si la question est
   * introuvable, à désactiver tant qu'elle charge.
   */
  footer: (questionId: string, isLoading: boolean) => ReactNode
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const Chevron = isOpen ? ChevronUp : ChevronDown

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-0 hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h4>
        </div>
        <Chevron className="h-4 w-4 text-gray-500" />
      </Button>
      {isOpen && children}
    </div>
  )
}

function QuestionBody({
  questionId,
  question,
  insights,
}: {
  questionId: string
  question: QuestionDetail
  insights?: (questionId: string) => ReactNode
}) {
  const references = question.references ?? []

  const handleCopyId = () => {
    navigator.clipboard.writeText(questionId)
    toast.success("ID copié")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
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

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Question
        </h4>
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {question.question}
        </p>
      </div>

      {question.images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Images ({question.images.length})
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {question.images.map((img, idx) => (
              <a
                key={img.id}
                href={cdnUrl(img.storagePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
              >
                <Image
                  src={cdnUrl(img.storagePath)}
                  alt={`Image ${idx + 1}`}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 320px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="h-5 w-5 text-white" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Options
        </h4>
        <div className="space-y-2">
          {question.options.map((option, idx) => {
            const isCorrect = option === question.correctAnswer
            const letter = String.fromCharCode(65 + idx)

            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  isCorrect
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50",
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isCorrect
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
                  )}
                >
                  {isCorrect ? <Check className="h-3.5 w-3.5" /> : letter}
                </div>
                <p
                  className={cn(
                    "text-sm leading-relaxed",
                    isCorrect
                      ? "font-medium text-emerald-800 dark:text-emerald-300"
                      : "text-gray-700 dark:text-gray-300",
                  )}
                >
                  {option}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {insights?.(questionId)}

      <CollapsibleSection title="Explication">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-sm leading-relaxed text-blue-800 dark:text-blue-300">
            {question.explanation}
          </p>
        </div>
      </CollapsibleSection>

      {references.length > 0 && (
        <CollapsibleSection title={`Références (${references.length})`}>
          <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {references.map((ref, idx) => (
              <li key={idx}>{ref}</li>
            ))}
          </ol>
        </CollapsibleSection>
      )}

      <div className="space-y-2 rounded-xl bg-gray-50/80 p-4 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Créée le {formatLongDateTime(question.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-xs text-gray-400">
            ID: {questionId.slice(0, 12)}...
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={handleCopyId}
            aria-label="Copier l'ID"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

function ModalLayout({
  questionId,
  insights,
  footer,
}: {
  questionId: string
  insights?: (questionId: string) => ReactNode
  footer: QuestionDetailModalProps["footer"]
}) {
  // `undefined` = en chargement ; `null` = introuvable. Monté avec
  // key={questionId} : un nouvel id repart du squelette, sections repliées.
  const [question, setQuestion] = useState<QuestionDetail | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let active = true
    loadQuestionById(questionId)
      .then((q) => {
        if (active) setQuestion(q)
      })
      .catch(() => {
        if (!active) return
        setQuestion(null)
        toast.error("Chargement impossible. Vérifiez votre réseau.")
      })
    return () => {
      active = false
    }
  }, [questionId])

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {question === undefined && <DetailSkeleton />}
        {question === null && (
          <div className="flex h-full min-h-40 items-center justify-center">
            <p className="text-gray-500">Question non trouvée</p>
          </div>
        )}
        {question && (
          <QuestionBody
            questionId={questionId}
            question={question}
            insights={insights}
          />
        )}
      </div>
      {question !== null && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
          {footer(questionId, question === undefined)}
        </div>
      )}
    </>
  )
}

/**
 * Détail d'une question admin : plein écran sur téléphone, centrée à partir de
 * 640 px. Seul le contenu défile, le pied reste visible quelle que soit la
 * longueur de la question.
 */
export function QuestionDetailModal({
  questionId,
  open,
  onOpenChange,
  insights,
  footer,
}: QuestionDetailModalProps) {
  // Garde la dernière question pendant l'animation de fermeture, où l'id
  // repasse déjà à null.
  const [shownId, setShownId] = useState(questionId)
  if (questionId && questionId !== shownId) setShownId(questionId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-auto sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Détails de la question</DialogTitle>
          <DialogDescription className="sr-only">
            Informations complètes sur la question
          </DialogDescription>
        </DialogHeader>
        {shownId && (
          <ModalLayout
            key={shownId}
            questionId={shownId}
            insights={insights}
            footer={footer}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
