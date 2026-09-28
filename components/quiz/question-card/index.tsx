"use client"

import {
  ChevronDown,
  CircleCheck,
  CircleMinus,
  CircleX,
  Flag,
  Hourglass,
} from "lucide-react"
import { QuestionImageGallery } from "@/components/shared/question-image-gallery"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonText } from "@/components/ui/skeleton-patterns"
import { TONE_TEXT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { KEY_WITHHELD_MESSAGE } from "../runner/types"
import { AnswerOptionList } from "./answer-option"
import {
  QuestionActions,
  createAddAction,
  createDeleteAction,
  createEditAction,
  createPermanentDeleteAction,
  createRemoveAction,
  createViewAction,
} from "./question-actions"
import { RevealPanels } from "./reveal-panels"
import type { AnswerOptionState, QuestionCardProps } from "./types"

export {
  createViewAction,
  createEditAction,
  createDeleteAction,
  createAddAction,
  createPermanentDeleteAction,
  createRemoveAction,
}
export type { ActionConfig, QuestionCardProps } from "./types"

type ReviewStatus = "unanswered" | "withheld" | "correct" | "incorrect"

const REVIEW_STATUS: Record<
  ReviewStatus,
  { label: string; tone: Tone; Icon: typeof CircleX }
> = {
  unanswered: { label: "Non répondu", tone: "neutral", Icon: CircleMinus },
  withheld: { label: "Correction différée", tone: "warning", Icon: Hourglass },
  correct: { label: "Correct", tone: "success", Icon: CircleCheck },
  incorrect: { label: "Incorrect", tone: "danger", Icon: CircleX },
}

// Clé retenue par un examen ouvert : tient lieu de correction, en passation
// tuteur comme en révision, tant que l'examen n'est pas clos.
const KeyWithheldNotice = () => (
  <div
    data-testid="key-withheld-notice"
    className="border-warning-line bg-warning-soft text-warning-ink rounded-md border p-4 text-sm"
  >
    {KEY_WITHHELD_MESSAGE}. Cette question figure dans un examen blanc encore
    ouvert : sa correction sera disponible ici dès sa clôture.
  </div>
)

const ExplanationSkeleton = () => (
  <div className="border-line bg-surface-2 border-t px-5 py-4">
    <Skeleton className="mb-3 h-3 w-24" />
    <SkeletonText lines={3} />
  </div>
)

/**
 * Carte de question : en-tête mono, vignette clinique en serif, choix A–E.
 * Trois usages : `exam` (passation, révélation tuteur comprise), `review`
 * (correction repliable) et `default` (liste admin).
 */
export const QuestionCard = ({
  question,
  lazyExplanation,
  lazyReferences,
  lazyExplanationImages,
  variant = "default",
  selectedAnswer,
  onAnswerSelect,
  disabled = false,
  isFlagged = false,
  onFlagToggle,
  userAnswer,
  userVerdict,
  isExpanded = false,
  onToggleExpand,
  questionNumber,
  totalQuestions,
  showImage = true,
  showCorrectAnswer = true,
  showDomainBadge = true,
  showObjectifBadge = true,
  footer,
  actions = [],
  className,
}: QuestionCardProps) => {
  const explanation = lazyExplanation ?? question.explanation
  const references = lazyReferences ?? question.references
  const explanationImages = [
    ...(lazyExplanationImages ?? question.explanationImages ?? []),
  ]
    .sort((a, b) => a.order - b.order)
    .map((img) => ({ key: img.storagePath, url: img.url }))

  const isReview = variant === "review"
  const isExam = variant === "exam"
  const isKeyWithheld = !!question.keyWithheld

  const matchesCurrentKey = userAnswer === question.correctAnswer
  const isCorrect = userVerdict ?? matchesCurrentKey
  const isFormerWording =
    userAnswer != null && !question.options.includes(userAnswer)
  const isKeyCorrected =
    !isKeyWithheld &&
    userVerdict !== undefined &&
    !isFormerWording &&
    userVerdict !== matchesCurrentKey

  // Révélation tuteur : seulement si la correction est montrée ET qu'on
  // dispose réellement de la clé. La vitrine publique passe par `exam` sans
  // clé : sans cette garde, le choix y serait marqué faux à tort.
  const isExamReveal = isExam && showCorrectAnswer && !!question.correctAnswer
  // Tuteur validé sur une clé retenue : la notice tient lieu de correction.
  const isExamWithheld = isExam && showCorrectAnswer && isKeyWithheld

  const reviewStatus: ReviewStatus =
    userAnswer == null
      ? "unanswered"
      : isKeyWithheld
        ? "withheld"
        : isCorrect
          ? "correct"
          : "incorrect"

  const stateOf = (option: string): AnswerOptionState => {
    if (isKeyWithheld) {
      return option === (userAnswer ?? selectedAnswer) ? "selected" : "default"
    }
    const isKey = option === question.correctAnswer
    const chosen = isReview ? userAnswer : selectedAnswer
    if (isReview || isExamReveal) {
      if (isKey) return "correct"
      if (chosen != null && option === chosen) return "incorrect"
      return "muted"
    }
    if (variant === "default" && showCorrectAnswer && isKey) return "correct"
    return selectedAnswer != null && option === selectedAnswer
      ? "selected"
      : "default"
  }

  const label =
    questionNumber === undefined
      ? null
      : isReview
        ? `Question ${questionNumber}`
        : `Question ${questionNumber}${totalQuestions ? ` / ${totalQuestions}` : ""}`

  const status = REVIEW_STATUS[reviewStatus]
  const showOptions = !isReview || isExpanded
  const showImages =
    showImage && question.images.length > 0 && variant !== "review"

  return (
    <article
      id={isReview ? `question-${questionNumber}` : undefined}
      className={cn(
        "bg-surface border-line text-ink overflow-hidden rounded-lg border",
        className,
      )}
    >
      <header className="border-line flex flex-wrap items-center gap-2.5 border-b px-5 py-3">
        {label && (
          <h2 className="text-ink font-mono text-xs font-normal">{label}</h2>
        )}
        {showDomainBadge && question.domain && (
          <Badge variant="badge">{question.domain}</Badge>
        )}
        {showObjectifBadge && question.objectifCMC && (
          <Badge className="bg-objective-soft text-objective max-w-full truncate border-transparent">
            {question.objectifCMC}
          </Badge>
        )}

        {isExam && onFlagToggle && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="btn-flag"
            data-flagged={isFlagged}
            aria-pressed={isFlagged}
            onClick={onFlagToggle}
            className={cn(
              "ml-auto h-7 gap-1.5 border px-2 max-md:h-11",
              isFlagged
                ? "border-warning-line bg-warning-soft text-warning-ink hover:bg-warning-soft hover:text-warning-ink"
                : "text-ink-3 border-transparent",
            )}
          >
            <Flag
              aria-hidden
              className={cn("size-3.5", isFlagged && "fill-current")}
            />
            {isFlagged ? "Marquée" : "Marquer"}
          </Button>
        )}

        {isReview && (
          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                TONE_TEXT[status.tone],
              )}
            >
              <status.Icon aria-hidden className="size-4" />
              {status.label}
            </span>
            {onToggleExpand && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleExpand}
                aria-label={
                  isExpanded ? "Réduire la question" : "Développer la question"
                }
                aria-expanded={isExpanded}
                className="max-md:size-11"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(isExpanded && "rotate-180")}
                />
              </Button>
            )}
          </div>
        )}

        {variant === "default" && actions.length > 0 && (
          <div className="ml-auto">
            <QuestionActions actions={actions} />
          </div>
        )}
      </header>

      <div className="flex flex-col gap-5 px-5 pt-6 pb-5">
        <p
          className={cn(
            "font-serif text-lg leading-[1.65] text-pretty",
            variant === "default" && "line-clamp-3 text-base",
          )}
        >
          {question.question}
        </p>

        {showImages && (
          <QuestionImageGallery
            images={question.images}
            size="md"
            maxDisplay={4}
          />
        )}

        {showOptions && (
          <AnswerOptionList
            options={question.options}
            stateOf={stateOf}
            onSelect={
              isExam && onAnswerSelect && !isExamReveal && !isExamWithheld
                ? onAnswerSelect
                : undefined
            }
            disabled={disabled}
            compact={variant === "default"}
            className={cn(variant === "default" && "sm:grid sm:grid-cols-2")}
          />
        )}

        {isReview && isExpanded && isFormerWording && (
          <div
            data-testid="former-wording-answer"
            data-state={reviewStatus}
            className={cn(
              "rounded-md border p-3 text-sm",
              isKeyWithheld
                ? "border-line bg-surface-2 text-ink-2"
                : isCorrect
                  ? "border-success bg-success-soft text-ink"
                  : "border-danger bg-danger-soft text-ink",
            )}
          >
            <p className="text-ink-3 font-mono text-[11px] font-medium tracking-[0.04em] uppercase">
              Votre réponse (texte de l&apos;option modifié depuis)
            </p>
            <p className="mt-1 wrap-break-word">{userAnswer}</p>
          </div>
        )}

        {isReview && isKeyCorrected && (
          <p
            data-testid="key-corrected-notice"
            className="text-warning-ink text-sm"
          >
            La clé de cette question a été corrigée depuis votre réponse
          </p>
        )}

        {((isReview && isExpanded) || isExamWithheld) && isKeyWithheld && (
          <KeyWithheldNotice />
        )}
      </div>

      {isReview &&
        isExpanded &&
        !isKeyWithheld &&
        (explanation !== undefined ? (
          <RevealPanels
            explanation={explanation}
            references={references}
            images={explanationImages}
          />
        ) : (
          <ExplanationSkeleton />
        ))}

      {/* Pas d'images d'explication en passation : canal réservé à la
          correction (anti-triche). */}
      {isExamReveal && explanation !== undefined && (
        <RevealPanels explanation={explanation} references={references} />
      )}

      {footer && (
        <footer className="border-line flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          {footer}
        </footer>
      )}
    </article>
  )
}

export default QuestionCard
