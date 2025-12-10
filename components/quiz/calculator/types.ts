export type CalculatorOperation = "+" | "-" | "*" | "/" | null

export type CalculatorState = {
  display: string
  previousValue: number | null
  operation: CalculatorOperation
  shouldResetDisplay: boolean
}

export type CalculatorActions = {
  inputNumber: (num: string) => void
  inputOperator: (op: Exclude<CalculatorOperation, null>) => void
  calculate: () => void
  clear: () => void
  inputDecimal: () => void
  backspace: () => void
}

export type CalculatorContextType = CalculatorState & CalculatorActions

export type CalculatorButtonVariant =
  | "number"
  | "operator"
  | "action"
  | "equals"
