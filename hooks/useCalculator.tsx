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

const formatDisplay = (value: number): string => {
  if (!isFinite(value)) return "Erreur"
  if (Math.abs(value) > 1e12) return value.toExponential(2)
  const str = value.toString()
  if (str.length > MAX_DISPLAY_LENGTH) {
    return value.toPrecision(MAX_DISPLAY_LENGTH - 2)
  }
  return str
}

export const CalculatorProvider = ({ children }: { children: ReactNode }) => {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<CalculatorOperation>(null)
  const [shouldResetDisplay, setShouldResetDisplay] = useState(false)

  const inputNumber = (num: string) => {
    if (display === "Erreur") {
      setDisplay(num)
      setShouldResetDisplay(false)
      return
    }

    if (shouldResetDisplay) {
      setDisplay(num)
      setShouldResetDisplay(false)
    } else {
      if (
        display.replace(".", "").replace("-", "").length >= MAX_DISPLAY_LENGTH
      )
        return
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const inputOperator = (op: Exclude<CalculatorOperation, null>) => {
    if (display === "Erreur") return

    if (previousValue !== null && operation && !shouldResetDisplay) {
      calculate()
      setPreviousValue(parseFloat(display))
    } else {
      setPreviousValue(parseFloat(display))
    }
    setOperation(op)
    setShouldResetDisplay(true)
  }

  const calculate = () => {
    if (previousValue === null || operation === null) return
    if (display === "Erreur") return

    const current = parseFloat(display)
    let result: number

    switch (operation) {
      case "+":
        result = previousValue + current
        break
      case "-":
        result = previousValue - current
        break
      case "*":
        result = previousValue * current
        break
      case "/":
        if (current === 0) {
          setDisplay("Erreur")
          setPreviousValue(null)
          setOperation(null)
          setShouldResetDisplay(true)
          return
        }
        result = previousValue / current
        break
      default:
        return
    }

    setDisplay(formatDisplay(result))
    setPreviousValue(null)
    setOperation(null)
    setShouldResetDisplay(true)
  }

  const clear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperation(null)
    setShouldResetDisplay(false)
  }

  const inputDecimal = () => {
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
    if (display === "Erreur" || shouldResetDisplay) {
      setDisplay("0")
      setShouldResetDisplay(false)
      return
    }

    if (display.length === 1 || (display.length === 2 && display[0] === "-")) {
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
