"use client"

import { Flag, LayoutGrid } from "lucide-react"
import { type ReactNode, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { NavigatorCell, NavigatorCellState } from "./cells"

const CELL: Record<NavigatorCellState, string> = {
  unanswered: "bg-surface border-line text-ink-3",
  answered: "bg-surface-2 border-line-strong text-ink",
  correct: "bg-success-soft border-success-line text-success-ink",
  incorrect: "bg-danger-soft border-danger-line text-danger-ink",
  withheld: "bg-warning-soft border-warning-line text-warning-ink",
}

const STATE_LABEL: Record<NavigatorCellState, string> = {
  unanswered: "sans réponse",
  answered: "répondue",
  correct: "correcte",
  incorrect: "incorrecte",
  withheld: "correction différée",
}

const LEGEND: Record<"passation" | "correction", NavigatorCellState[]> = {
  passation: ["answered", "unanswered"],
  correction: ["correct", "incorrect", "unanswered", "withheld"],
}

const LEGEND_LABEL: Record<NavigatorCellState, string> = {
  unanswered: "Sans réponse",
  answered: "Répondue",
  correct: "Correcte",
  incorrect: "Incorrecte",
  withheld: "Différée",
}

type NavigatorPanelProps = {
  cells: NavigatorCell[]
  /** Passation : la question affichée. Absent en correction. */
  currentIndex?: number
  onSelect: (index: number) => void
  /** 8 en examen blanc ; 6 sous 768 px et 5 sous 400 px, pour des cibles de 44 px. */
  columns: 5 | 8
  kind: "passation" | "correction"
  title?: string
}

/**
 * Grille des numéros de question, commune à la passation et à la correction.
 * Dans une colonne de 300 px dès 1024 px, dans un Sheet en dessous
 * (`NavigatorSheet`).
 */
export const NavigatorPanel = ({
  cells,
  currentIndex,
  onSelect,
  columns,
  kind,
  title = "Questions",
}: NavigatorPanelProps) => {
  const count = (state: NavigatorCellState) =>
    cells.filter((c) => c.state === state).length
  const answered = cells.filter((c) => c.state !== "unanswered").length
  const legend = LEGEND[kind].filter(
    (state) => kind === "passation" || state === "correct" || count(state) > 0,
  )

  return (
    <nav aria-label="Navigation des questions" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <span className="text-ink-3 font-mono text-xs font-medium tracking-[0.06em] uppercase">
          {title}
        </span>
        <span className="text-ink-3 font-mono text-xs">
          {kind === "passation" ? answered : count("correct")}/{cells.length}
        </span>
      </div>

      <ol
        className={cn(
          "grid max-h-[min(52vh,460px)] gap-1 overflow-y-auto p-0.5",
          columns === 8
            ? "grid-cols-8 max-[400px]:grid-cols-5 max-md:grid-cols-6"
            : "grid-cols-5",
        )}
      >
        {cells.map((cell, index) => {
          const isCurrent = index === currentIndex
          const label = [
            `Question ${index + 1}`,
            STATE_LABEL[cell.state],
            cell.flagged && "marquée",
          ]
            .filter(Boolean)
            .join(", ")
          return (
            <li key={index}>
              <button
                type="button"
                data-testid={
                  kind === "correction"
                    ? `results-nav-item-${index}`
                    : `nav-item-${index}`
                }
                data-state={cell.state}
                aria-label={label}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={cn(
                  "focus-ring relative flex h-6.5 w-full cursor-pointer items-center justify-center rounded-sm border font-mono text-[11px] font-medium transition-[background-color,border-color] duration-(--duration-fast) max-md:h-11",
                  isCurrent
                    ? "bg-accent border-accent text-accent-foreground"
                    : cell.flagged
                      ? cn(CELL[cell.state], "border-warning text-warning-ink")
                      : CELL[cell.state],
                )}
              >
                {index + 1}
                {cell.flagged && (
                  <Flag
                    aria-hidden
                    className="text-warning absolute top-0.5 right-0.5 size-2 fill-current"
                  />
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <ul className="border-line text-ink-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 text-xs">
        {legend.map((state) => (
          <li key={state} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("size-3 rounded-xs border", CELL[state])}
            />
            {LEGEND_LABEL[state]}
            {kind === "correction" && ` (${count(state)})`}
          </li>
        ))}
        {kind === "passation" && (
          <>
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="bg-surface border-warning size-3 rounded-xs border"
              />
              Marquée
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="bg-accent border-accent size-3 rounded-xs border"
              />
              Actuelle
            </li>
          </>
        )}
      </ul>
    </nav>
  )
}

type NavigatorSheetProps = Omit<NavigatorPanelProps, "onSelect"> & {
  onSelect: (index: number) => void
  /**
   * La page déplace elle-même le focus (et défile) après le choix : la
   * sélection n'est alors transmise qu'une fois le Sheet fermé, sans rendre
   * le focus au déclencheur, qui ramènerait la page vers lui.
   */
  handsOffFocus?: boolean
  triggerClassName?: string
  /** Contenu ajouté sous la grille (outils). */
  children?: ReactNode
}

/** Déclencheur « Questions » et Sheet du navigateur, sous 1024 px. */
export const NavigatorSheet = ({
  onSelect,
  handsOffFocus = false,
  triggerClassName,
  children,
  ...panel
}: NavigatorSheetProps) => {
  const [open, setOpen] = useState(false)
  const pendingRef = useRef<number | null>(null)

  const select = (index: number) => {
    if (handsOffFocus) pendingRef.current = index
    else onSelect(index)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="btn-questions"
          className={cn("max-md:h-11", triggerClassName)}
        >
          <LayoutGrid aria-hidden />
          Questions
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="flex w-[min(320px,calc(100vw-32px))] flex-col gap-0 overflow-y-auto p-0"
        onCloseAutoFocus={(event) => {
          const pending = pendingRef.current
          if (pending === null) return
          pendingRef.current = null
          event.preventDefault()
          onSelect(pending)
        }}
      >
        <SheetHeader className="border-line h-16 shrink-0 justify-center border-b px-5 text-left">
          <SheetTitle className="text-base">Questions</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-5 py-4">
          <NavigatorPanel {...panel} onSelect={select} />
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
