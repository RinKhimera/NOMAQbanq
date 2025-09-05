"use client"

import { CheckCircle, Eye, Target } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Doc } from "@/convex/_generated/dataModel"

interface QuestionDetailsDialogProps {
  question: Doc<"questions"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function QuestionDetailsDialog({
  question,
  open,
  onOpenChange,
}: QuestionDetailsDialogProps) {
  if (!question) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            <span>Détails de la question</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">
            {/* En-tête avec badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{question.domain}</Badge>
              <Badge variant="secondary">{question.objectifCMC}</Badge>
            </div>

            {/* Question */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Target className="h-5 w-5" />
                Question
              </h3>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-base leading-relaxed">{question.question}</p>
              </div>
            </div>

            {/* Image si présente */}
            {question.imageSrc && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Eye className="h-5 w-5" />
                  Image
                </h3>
                <div className="bg-muted rounded-lg p-4">
                  <Image
                    src={question.imageSrc}
                    alt="Question illustration"
                    width={600}
                    height={400}
                    className="h-auto max-w-full rounded"
                  />
                </div>
              </div>
            )}

            {/* Options de réponse */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Options de réponse</h3>
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 rounded-lg border-2 p-3 ${
                      option === question.correctAnswer
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                    }`}
                  >
                    <Badge
                      variant={
                        option === question.correctAnswer
                          ? "default"
                          : "outline"
                      }
                      className="flex h-8 w-8 items-center justify-center text-sm font-bold"
                    >
                      {String.fromCharCode(65 + index)}
                    </Badge>
                    <p className="flex-1 text-base leading-relaxed">{option}</p>
                    {option === question.correctAnswer && (
                      <CheckCircle className="h-6 w-6 flex-shrink-0 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Explication */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Explication</h3>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-base leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            </div>

            {/* Références */}
            {question.references && question.references.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Références</h3>
                <div className="bg-muted rounded-lg p-4">
                  <ul className="space-y-2">
                    {question.references.map((reference, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-1 font-mono text-sm">
                          [{index + 1}]
                        </span>
                        <span className="text-base">{reference}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
