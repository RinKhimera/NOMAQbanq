"use client"

import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnswerOptionProps, AnswerOptionState } from "./types"

const OPTION: Record<AnswerOptionState, string> = {
  default: "bg-surface border-line-strong text-ink",
  selected: "bg-accent-soft border-accent text-ink",
  correct: "bg-success-soft border-success text-ink",
  incorrect: "bg-danger-soft border-danger text-ink",
  muted: "bg-surface border-line text-ink-3",
}

const LETTER: Record<AnswerOptionState, string> = {
  default: "bg-surface border-line-strong text-ink-2",
  selected: "bg-accent border-accent text-accent-foreground",
  correct: "bg-success border-success text-accent-foreground",
  incorrect: "bg-danger border-danger text-accent-foreground",
  muted: "bg-surface border-line text-ink-3",
}

const STATUS_LABEL: Partial<Record<AnswerOptionState, string>> = {
  correct: "Bonne réponse",
  incorrect: "Votre réponse",
}

export const optionLetter = (index: number) => String.fromCharCode(65 + index)

/**
 * Choix de réponse A–E. Un bouton quand `onClick` est fourni, un simple bloc
 * sinon (correction, aperçu) : un choix corrigé ne se clique plus.
 */
export const AnswerOption = ({
  option,
  index,
  state,
  onClick,
  disabled = false,
  compact = false,
  statusLabel = STATUS_LABEL[state],
}: AnswerOptionProps) => {
  const letter = optionLetter(index)
  const Icon = state === "correct" ? Check : state === "incorrect" ? X : null

  const content = (
    <>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-sm border font-mono text-[13px] font-medium",
          compact ? "size-6" : "size-7",
          LETTER[state],
        )}
      >
        {Icon ? (
          <>
            <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
            <span className="sr-only">{letter}</span>
          </>
        ) : (
          letter
        )}
      </span>
      <span className="min-w-0 wrap-break-word">{option}</span>
      {statusLabel ? (
        <span
          className={cn(
            "font-mono text-[11px] font-medium tracking-[0.04em] uppercase",
            state === "correct" ? "text-success-ink" : "text-danger-ink",
          )}
        >
          {statusLabel}
        </span>
      ) : (
        <span />
      )}
    </>
  )

  const className = cn(
    "grid w-full items-center gap-3.5 rounded-md border text-left leading-normal transition-[background-color,border-color] duration-(--duration-fast)",
    compact
      ? "grid-cols-[24px_1fr_auto] px-3 py-2 text-sm"
      : "grid-cols-[28px_1fr_auto] px-3.5 py-2.75 text-[15px]",
    OPTION[state],
  )
  const dataAttributes = {
    "data-state": state,
    "data-selected": state === "selected",
  }

  if (!onClick) {
    return (
      <div
        data-testid={`answer-option-${index}`}
        className={className}
        {...dataAttributes}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      data-testid={`answer-option-${index}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={cn(
        className,
        "focus-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        state === "default" && "hover:border-ink-4",
      )}
      {...dataAttributes}
    >
      {content}
    </button>
  )
}

type AnswerOptionListProps = {
  options: readonly string[]
  stateOf: (option: string, index: number) => AnswerOptionState
  onSelect?: (index: number) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}

/** Liste des choix d'une question, dans l'ordre A–E. */
export const AnswerOptionList = ({
  options,
  stateOf,
  onSelect,
  disabled,
  compact,
  className,
}: AnswerOptionListProps) => (
  <div
    role="group"
    aria-label="Choix de réponse"
    className={cn("flex flex-col gap-2", className)}
  >
    {options.map((option, index) => (
      <AnswerOption
        key={index}
        option={option}
        index={index}
        state={stateOf(option, index)}
        onClick={onSelect ? () => onSelect(index) : undefined}
        disabled={disabled}
        compact={compact}
      />
    ))}
  </div>
)
