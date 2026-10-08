"use client"

import { ReactNode, createContext, useContext, useState } from "react"
import {
  CalculatorContextType,
  CalculatorOperation,
} from "@/components/quiz/calculator/types"

const CalculatorContext = createContext<CalculatorContextType | undefined>(
  undefined,
)

const MAX_DISPLAY_LENGTH = 12

export const formatDisplay = (value: number): string => {
  if (!isFinite(value)) return "Erreur"
  if (Math.abs(value) > 1e12) return value.toExponential(2)
  const str = value.toString()
  if (str.length > MAX_DISPLAY_LENGTH) {
    return value.toPrecision(MAX_DISPLAY_LENGTH - 2)
  }
  return str
}

type Operator = Exclude<CalculatorOperation, null>

/** Une division par zéro rend un non-fini, que `formatDisplay` affiche en « Erreur ». */
const apply = (left: number, operator: Operator, right: number): number => {
  switch (operator) {
    case "+":
      return left + right
    case "-":
      return left - right
    case "*":
      return left * right
    case "/":
      return left / right
  }
}

export const CalculatorProvider = ({ children }: { children: ReactNode }) => {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<CalculatorOperation>(null)
  const [shouldResetDisplay, setShouldResetDisplay] = useState(false)
  // Valeur exacte d'un résultat affiché : l'écran l'arrondit (10 chiffres, ou
  // 3 en notation scientifique), et relire l'écran fausserait la suite du calcul.
  // `null` dès que l'utilisateur tape : l'écran redevient la seule source.
  const [exact, setExact] = useState<number | null>(null)

  const readValue = () => exact ?? parseFloat(display)

  const inputNumber = (num: string) => {
    setExact(null)
    if (display === "Erreur") {
      setDisplay(num)
      setShouldResetDisplay(false)
      return
    }

    if (shouldResetDisplay) {
      setDisplay(num)
      setShouldResetDisplay(false)
    } else {
      if (display.replace(".", "").length >= MAX_DISPLAY_LENGTH) return
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const endChain = (value: number) => {
    setDisplay(formatDisplay(value))
    setExact(isFinite(value) ? value : null)
    setPreviousValue(null)
    setOperation(null)
    setShouldResetDisplay(true)
  }

  const inputOperator = (op: Operator) => {
    if (display === "Erreur") return

    let operand = readValue()
    if (previousValue !== null && operation !== null && !shouldResetDisplay) {
      operand = apply(previousValue, operation, operand)
      if (!isFinite(operand)) {
        endChain(operand)
        return
      }
      setDisplay(formatDisplay(operand))
      setExact(operand)
    }
    setPreviousValue(operand)
    setOperation(op)
    setShouldResetDisplay(true)
  }

  const calculate = () => {
    if (previousValue === null || operation === null) return
    endChain(apply(previousValue, operation, readValue()))
  }

  const clear = () => {
    setDisplay("0")
    setExact(null)
    setPreviousValue(null)
    setOperation(null)
    setShouldResetDisplay(false)
  }

  const inputDecimal = () => {
    setExact(null)
    if (display === "Erreur") {
      setDisplay("0.")
      setShouldResetDisplay(false)
      return
    }

    if (shouldResetDisplay) {
      setDisplay("0.")
      setShouldResetDisplay(false)
    } else if (!display.includes(".")) {
      setDisplay(display + ".")
    }
  }

  const backspace = () => {
    setExact(null)
    if (display === "Erreur" || shouldResetDisplay) {
      setDisplay("0")
      setShouldResetDisplay(false)
      return
    }

    if (display.length === 1) {
      setDisplay("0")
    } else {
      setDisplay(display.slice(0, -1))
    }
  }

  return (
    <CalculatorContext.Provider
      value={{
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
      }}
    >
      {children}
    </CalculatorContext.Provider>
  )
}

export const useCalculator = () => {
  const context = useContext(CalculatorContext)
  if (context === undefined) {
    throw new Error("useCalculator must be used within CalculatorProvider")
  }
  return context
}
