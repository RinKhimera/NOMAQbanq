"use client"

import { Calculator as CalculatorIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCalculator } from "@/hooks/useCalculator"
import { CalculatorButton } from "./calculator-button"
import { CalculatorDisplay } from "./calculator-display"
import { CalculatorOperation } from "./types"

type CalculatorProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
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

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      // Prevent default for calculator keys
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

  const handleNumberClick = useCallback(
    (value: string) => {
      inputNumber(value)
    },
    [inputNumber],
  )

  const handleOperatorClick = useCallback(
    (value: string) => {
      inputOperator(value as Exclude<CalculatorOperation, null>)
    },
    [inputOperator],
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] rounded-xl p-4 sm:max-w-xs sm:p-6"
        aria-describedby="calculator-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-600">
              <CalculatorIcon className="h-4 w-4 text-white" />
            </div>
            <span>Calculatrice</span>
          </DialogTitle>
          <p id="calculator-description" className="sr-only">
            Calculatrice avec opérations de base. Utilisez le clavier ou les
            boutons pour effectuer des calculs.
          </p>
        </DialogHeader>

        <div className="mt-4">
          <CalculatorDisplay
            value={display}
            operation={operation}
            hasError={hasError}
          />

          {/* Calculator grid */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1: AC, backspace, ÷ */}
            <CalculatorButton
              value="AC"
              onClick={clear}
              variant="action"
              ariaLabel="Effacer tout"
              colSpan={2}
              className="col-span-2"
            />
            <CalculatorButton
              value="backspace"
              displayValue="⌫"
              onClick={backspace}
              variant="action"
              ariaLabel="Supprimer le dernier chiffre"
            />
            <CalculatorButton
              value="/"
              displayValue="÷"
              onClick={handleOperatorClick}
              variant="operator"
              ariaLabel="Division"
            />

            {/* Row 2: 7, 8, 9, × */}
            <CalculatorButton value="7" onClick={handleNumberClick} />
            <CalculatorButton value="8" onClick={handleNumberClick} />
            <CalculatorButton value="9" onClick={handleNumberClick} />
            <CalculatorButton
              value="*"
              displayValue="×"
              onClick={handleOperatorClick}
              variant="operator"
              ariaLabel="Multiplication"
            />

            {/* Row 3: 4, 5, 6, - */}
            <CalculatorButton value="4" onClick={handleNumberClick} />
            <CalculatorButton value="5" onClick={handleNumberClick} />
            <CalculatorButton value="6" onClick={handleNumberClick} />
            <CalculatorButton
              value="-"
              displayValue="−"
              onClick={handleOperatorClick}
              variant="operator"
              ariaLabel="Soustraction"
            />

            {/* Row 4: 1, 2, 3, + */}
            <CalculatorButton value="1" onClick={handleNumberClick} />
            <CalculatorButton value="2" onClick={handleNumberClick} />
            <CalculatorButton value="3" onClick={handleNumberClick} />
            <CalculatorButton
              value="+"
              onClick={handleOperatorClick}
              variant="operator"
              ariaLabel="Addition"
            />

            {/* Row 5: 0, ., = */}
            <CalculatorButton
              value="0"
              onClick={handleNumberClick}
              colSpan={2}
              className="col-span-2"
            />
            <CalculatorButton
              value="."
              onClick={inputDecimal}
              variant="action"
              ariaLabel="Point décimal"
            />
            <CalculatorButton
              value="="
              onClick={calculate}
              variant="equals"
              ariaLabel="Calculer le résultat"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
