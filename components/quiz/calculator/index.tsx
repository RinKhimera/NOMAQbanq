"use client"

import { Delete, Divide, Equal, Minus, Plus, X } from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useCalculator } from "@/hooks/useCalculator"
import { cn } from "@/lib/utils"
import { CalculatorOperation } from "./types"

type CalculatorProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type ButtonVariant = "number" | "operator" | "action" | "equals"

const CalcButton = ({
  children,
  onClick,
  variant = "number",
  className,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: ButtonVariant
  className?: string
  ariaLabel?: string
}) => {
  const baseStyles =
    "relative flex items-center justify-center rounded-xl font-medium transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 cursor-pointer select-none"

  const variantStyles: Record<ButtonVariant, string> = {
    number: cn(
      "bg-slate-800/80 text-slate-100 text-xl",
      "hover:bg-slate-700/90 hover:text-white",
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.3)]",
      "dark:bg-slate-800/80 dark:hover:bg-slate-700/90",
    ),
    operator: cn(
      "bg-linear-to-b from-amber-500/90 to-amber-600/90 text-white text-lg",
      "hover:from-amber-400/90 hover:to-amber-500/90",
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_2px_8px_rgba(245,158,11,0.3)]",
    ),
    action: cn(
      "bg-slate-700/60 text-slate-300 text-base font-semibold",
      "hover:bg-slate-600/70 hover:text-slate-100",
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_2px_4px_rgba(0,0,0,0.2)]",
    ),
    equals: cn(
      "bg-linear-to-b from-cyan-500 to-teal-600 text-white text-lg",
      "hover:from-cyan-400 hover:to-teal-500",
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_2px_12px_rgba(6,182,212,0.4)]",
    ),
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(baseStyles, variantStyles[variant], "h-14", className)}
      whileTap={{ scale: 0.95 }}
      aria-label={ariaLabel}
    >
      {children}
    </motion.button>
  )
}

const OperatorIcon = ({ op }: { op: string }) => {
  const iconClass = "h-5 w-5"
  switch (op) {
    case "+":
      return <Plus className={iconClass} />
    case "-":
      return <Minus className={iconClass} />
    case "*":
      return <X className={iconClass} />
    case "/":
      return <Divide className={iconClass} />
    default:
      return null
  }
}

export const Calculator = ({ isOpen, onOpenChange }: CalculatorProps) => {
  const {
    display,
    operation,
    inputNumber,
    inputOperator,
    calculate,
    clear,
    inputDecimal,
    backspace,
  } = useCalculator()

  const hasError = display === "Erreur"

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (
        /^[0-9+\-*/.=]$/.test(e.key) ||
        ["Enter", "Escape", "Backspace", "Delete", "c", "C"].includes(e.key)
      ) {
        e.preventDefault()
      }

      if (/^[0-9]$/.test(e.key)) {
        inputNumber(e.key)
      } else if (["+", "-", "*", "/"].includes(e.key)) {
        inputOperator(e.key as Exclude<CalculatorOperation, null>)
      } else if (e.key === "Enter" || e.key === "=") {
        calculate()
      } else if (e.key === "Escape") {
        onOpenChange(false)
      } else if (e.key === "Backspace" || e.key === "Delete") {
        backspace()
      } else if (e.key === "." || e.key === ",") {
        inputDecimal()
      } else if (e.key.toLowerCase() === "c") {
        clear()
      }
    },
    [
      isOpen,
      inputNumber,
      inputOperator,
      calculate,
      onOpenChange,
      backspace,
      inputDecimal,
      clear,
    ],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const handleNumber = useCallback(
    (value: string) => () => inputNumber(value),
    [inputNumber],
  )

  const handleOperator = useCallback(
    (op: Exclude<CalculatorOperation, null>) => () => inputOperator(op),
    [inputOperator],
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[320px] overflow-hidden rounded-2xl border-0 p-0",
          "bg-linear-to-b from-slate-900 via-slate-900 to-slate-950",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.8)]",
        )}
        aria-describedby="calculator-description"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Calculatrice</DialogTitle>
        <p id="calculator-description" className="sr-only">
          Calculatrice avec opérations de base. Utilisez le clavier ou les
          boutons pour effectuer des calculs.
        </p>

        {/* Display Section */}
        <div className="relative px-5 pt-6 pb-4">
          {/* Subtle grid pattern background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />

          {/* Operation indicator */}
          <div className="mb-1 flex h-6 items-center justify-end">
            {operation && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-amber-400/80"
              >
                <OperatorIcon op={operation} />
              </motion.div>
            )}
          </div>

          {/* Main display */}
          <motion.div
            className={cn(
              "relative overflow-hidden rounded-xl px-4 py-3",
              "bg-slate-950/80",
              "shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.03)]",
            )}
          >
            <motion.div
              key={display}
              initial={{ opacity: 0.8, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.1 }}
              className={cn(
                "text-right font-mono text-4xl font-light tracking-tight",
                hasError
                  ? "text-rose-400"
                  : "bg-linear-to-r from-slate-100 to-white bg-clip-text text-transparent",
              )}
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {display}
            </motion.div>

            {/* Subtle shine effect */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
          </motion.div>
        </div>

        {/* Button Grid */}
        <div className="relative p-4 pt-0">
          {/* Separator line */}
          <div className="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-slate-700/50 to-transparent" />

          <div className="grid grid-cols-4 gap-2.5 pt-4">
            {/* Row 1 */}
            <CalcButton
              onClick={clear}
              variant="action"
              className="col-span-2"
              ariaLabel="Effacer tout"
            >
              AC
            </CalcButton>
            <CalcButton
              onClick={backspace}
              variant="action"
              ariaLabel="Supprimer le dernier chiffre"
            >
              <Delete className="h-5 w-5" />
            </CalcButton>
            <CalcButton
              onClick={handleOperator("/")}
              variant="operator"
              ariaLabel="Division"
            >
              <Divide className="h-5 w-5" />
            </CalcButton>

            {/* Row 2 */}
            <CalcButton onClick={handleNumber("7")}>7</CalcButton>
            <CalcButton onClick={handleNumber("8")}>8</CalcButton>
            <CalcButton onClick={handleNumber("9")}>9</CalcButton>
            <CalcButton
              onClick={handleOperator("*")}
              variant="operator"
              ariaLabel="Multiplication"
            >
              <X className="h-5 w-5" />
            </CalcButton>

            {/* Row 3 */}
            <CalcButton onClick={handleNumber("4")}>4</CalcButton>
            <CalcButton onClick={handleNumber("5")}>5</CalcButton>
            <CalcButton onClick={handleNumber("6")}>6</CalcButton>
            <CalcButton
              onClick={handleOperator("-")}
              variant="operator"
              ariaLabel="Soustraction"
            >
              <Minus className="h-5 w-5" />
            </CalcButton>

            {/* Row 4 */}
            <CalcButton onClick={handleNumber("1")}>1</CalcButton>
            <CalcButton onClick={handleNumber("2")}>2</CalcButton>
            <CalcButton onClick={handleNumber("3")}>3</CalcButton>
            <CalcButton
              onClick={handleOperator("+")}
              variant="operator"
              ariaLabel="Addition"
            >
              <Plus className="h-5 w-5" />
            </CalcButton>

            {/* Row 5 */}
            <CalcButton onClick={handleNumber("0")} className="col-span-2">
              0
            </CalcButton>
            <CalcButton
              onClick={inputDecimal}
              variant="action"
              ariaLabel="Point décimal"
            >
              ,
            </CalcButton>
            <CalcButton
              onClick={calculate}
              variant="equals"
              ariaLabel="Calculer le résultat"
            >
              <Equal className="h-5 w-5" />
            </CalcButton>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="h-1 bg-linear-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0" />
      </DialogContent>
    </Dialog>
  )
}
