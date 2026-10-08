"use client"

import { Delete, X } from "lucide-react"
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react"
import { formatDisplay, useCalculator } from "@/hooks/useCalculator"
import { cn } from "@/lib/utils"
import type { CalculatorOperation } from "./types"

type Operator = Exclude<CalculatorOperation, null>

const OPERATOR_SYMBOL: Record<Operator, string> = {
  "/": "÷",
  "*": "×",
  "-": "−",
  "+": "+",
}

const OPERATOR_LABEL: Record<Operator, string> = {
  "/": "Division",
  "*": "Multiplication",
  "-": "Soustraction",
  "+": "Addition",
}

type KeyProps = {
  children: ReactNode
  onClick: () => void
  tone?: "digit" | "function" | "operator" | "equals"
  active?: boolean
  label?: string
  className?: string
}

const Key = ({
  children,
  onClick,
  tone = "digit",
  active = false,
  label,
  className,
}: KeyProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      "focus-ring flex h-12 cursor-pointer items-center justify-center font-mono text-base font-medium transition-[background-color,border-color] duration-(--duration-fast) select-none focus-visible:relative focus-visible:z-10",
      tone === "digit" && "bg-surface text-ink hover:bg-surface-2",
      tone === "function" && "bg-surface-2 text-ink hover:bg-line",
      tone === "operator" &&
        (active
          ? "bg-accent-soft text-accent-ink"
          : "bg-surface-2 text-accent-ink hover:bg-line"),
      tone === "equals" &&
        "bg-accent text-accent-foreground hover:bg-accent-hover",
      className,
    )}
  >
    {children}
  </button>
)

type CalculatorProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Reçoit le focus à la fermeture (bouton qui a ouvert la calculatrice). */
  returnFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Calculatrice d'examen, en panneau flottant non modal : la question reste
 * lisible et cliquable pendant le calcul. Le clavier ne la pilote que lorsque
 * le focus est dans le panneau.
 */
export const Calculator = ({
  isOpen,
  onOpenChange,
  returnFocusRef,
}: CalculatorProps) => {
  const {
    display,
    previousValue,
    operation,
    shouldResetDisplay,
    inputNumber,
    inputOperator,
    calculate,
    clear,
    inputDecimal,
    backspace,
  } = useCalculator()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (isOpen) panelRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const close = () => {
    onOpenChange(false)
    returnFocusRef?.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { key } = e
    let handled = true
    if (/^[0-9]$/.test(key)) inputNumber(key)
    else if (key in OPERATOR_SYMBOL) inputOperator(key as Operator)
    // Entrée sur un bouton du panneau l'active (Fermer compris) ; elle ne
    // calcule que depuis le panneau lui-même.
    else if ((key === "Enter" && e.target === e.currentTarget) || key === "=")
      calculate()
    else if (key === "Backspace" || key === "Delete") backspace()
    else if (key === "." || key === ",") inputDecimal()
    else if (key === "c" || key === "C") clear()
    else if (key === "Escape") close()
    else handled = false
    if (handled) e.preventDefault()
  }

  const operator = (op: Operator) => (
    <Key
      tone="operator"
      active={operation === op && shouldResetDisplay}
      label={OPERATOR_LABEL[op]}
      onClick={() => inputOperator(op)}
    >
      {OPERATOR_SYMBOL[op]}
    </Key>
  )
  const digit = (n: string, className?: string) => (
    <Key onClick={() => inputNumber(n)} className={className}>
      {n}
    </Key>
  )

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      // Sous 1024 px, la carte occupe toute la largeur : en bas, le panneau
      // masquerait son pied (« Suivante »). Il se pose sous l'en-tête.
      className="bg-surface shadow-pop fixed top-[calc(var(--shell-offset,0px)+4rem)] right-4 z-30 w-70 overflow-hidden rounded-lg outline-none lg:top-auto lg:bottom-4"
    >
      <div className="border-line flex items-center border-b py-1.5 pr-1.5 pl-3">
        <span
          id={titleId}
          className="text-ink-3 flex-1 font-mono text-[11px] font-medium tracking-[0.06em] uppercase"
        >
          Calculatrice
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Fermer la calculatrice"
          className="focus-ring text-ink-3 hover:bg-surface-2 hover:text-ink grid size-8 cursor-pointer place-items-center rounded-sm max-md:size-11"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="bg-surface-2 border-line border-b px-3.5 pt-3.5 pb-2.5 text-right">
        <div className="text-ink-3 h-4 font-mono text-xs">
          {previousValue !== null && operation
            ? `${formatDisplay(previousValue)} ${OPERATOR_SYMBOL[operation]}`
            : ""}
        </div>
        <output
          aria-live="polite"
          className={cn(
            "block truncate font-mono text-[28px] font-medium tabular-nums",
            display === "Erreur" ? "text-danger-ink" : "text-ink",
          )}
        >
          {display}
        </output>
      </div>

      <div className="bg-line grid grid-cols-4 gap-px">
        <Key
          tone="function"
          label="Effacer tout"
          onClick={clear}
          className="col-span-2"
        >
          C
        </Key>
        <Key
          tone="function"
          label="Supprimer le dernier chiffre"
          onClick={backspace}
        >
          <Delete className="size-4" aria-hidden />
        </Key>
        {operator("/")}
        {digit("7")}
        {digit("8")}
        {digit("9")}
        {operator("*")}
        {digit("4")}
        {digit("5")}
        {digit("6")}
        {operator("-")}
        {digit("1")}
        {digit("2")}
        {digit("3")}
        {operator("+")}
        {digit("0", "col-span-2")}
        <Key tone="function" label="Virgule décimale" onClick={inputDecimal}>
          ,
        </Key>
        <Key tone="equals" label="Calculer le résultat" onClick={calculate}>
          =
        </Key>
      </div>
    </div>
  )
}
