"use client"

import { RotateCcw } from "lucide-react"
import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { QuestionCard } from "@/components/quiz/question-card"
import { optionLetter } from "@/components/quiz/question-card/answer-option"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * - `tutor` : correction dès le choix, explication comprise si la question la porte ;
 * - `exam` : le choix reste sélectionné, rien n'est corrigé ;
 * - `sample` : correction dès le choix, sans explication (pages domaine).
 */
type DemoMode = "tutor" | "exam" | "sample"

type DemoQuestionProps = {
  question: QuizQuestion
  mode: DemoMode
  questionNumber?: number
  totalQuestions?: number
  /** Choix déjà posé au chargement (démo du mode tuteur). */
  initialAnswer?: number
  caption?: string
  className?: string
}

const pendingLabel = "Choisissez une réponse"

function statusOf(mode: DemoMode, question: QuizQuestion, answer: string) {
  if (mode === "tutor") {
    return question.explanation
      ? "Correction immédiate"
      : "Mode tuteur · correction immédiate"
  }
  if (mode === "exam") return "Mode examen · correction en fin d'examen"
  if (answer === question.correctAnswer) return "Bonne réponse"
  const key = question.options.indexOf(question.correctAnswer ?? "")
  return `La bonne réponse est ${optionLetter(key)}`
}

/** Vraie carte de question, jouable sans compte, pour la vitrine. */
export const DemoQuestion = ({
  question,
  mode,
  questionNumber = 1,
  totalQuestions = 1,
  initialAnswer,
  caption,
  className,
}: DemoQuestionProps) => {
  const [answer, setAnswer] = useState<string | null>(
    initialAnswer === undefined ? null : question.options[initialAnswer],
  )
  const cardRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)

  // Une fois corrigé, le choix n'est plus un bouton : le focus clavier suit le
  // statut plutôt que de tomber sur <body>. Rendu synchrone avant de déplacer
  // le focus, sinon il viserait l'élément d'avant le rendu.
  const chooseAnswer = (index: number) => {
    flushSync(() => setAnswer(question.options[index]))
    if (mode !== "exam") statusRef.current?.focus()
  }

  const restart = () => {
    flushSync(() => setAnswer(null))
    cardRef.current
      ?.querySelector<HTMLButtonElement>("[data-testid='answer-option-0']")
      ?.focus()
  }

  return (
    <div ref={cardRef} className={cn("min-w-0", className)}>
      <QuestionCard
        variant="exam"
        question={question}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        selectedAnswer={answer}
        onAnswerSelect={chooseAnswer}
        showCorrectAnswer={mode !== "exam" && answer !== null}
        footer={
          <>
            <span
              ref={statusRef}
              tabIndex={-1}
              className="text-ink-3 focus-ring min-w-0 rounded-sm font-mono text-xs"
            >
              {answer === null
                ? pendingLabel
                : statusOf(mode, question, answer)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className={cn("max-md:h-11", answer === null && "invisible")}
              aria-hidden={answer === null}
              tabIndex={answer === null ? -1 : undefined}
            >
              <RotateCcw aria-hidden />
              Recommencer
            </Button>
          </>
        }
      />
      {caption && (
        <p className="text-ink-3 mt-2.5 font-mono text-xs">{caption}</p>
      )}
    </div>
  )
}
