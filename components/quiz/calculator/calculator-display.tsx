"use client"

import { cn } from "@/lib/utils"

type CalculatorDisplayProps = {
  value: string
  operation?: string | null
  hasError?: boolean
}

const operatorSymbol: Record<string, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
}

export const CalculatorDisplay = ({
  value,
  operation,
  hasError,
}: CalculatorDisplayProps) => {
  return (
    <div className="mb-4 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
      {/* Operation indicator */}
      {operation && (
        <div className="mb-1 text-right text-sm text-gray-500 dark:text-gray-400">
          {operatorSymbol[operation] || operation}
        </div>
      )}

      {/* Main display */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "overflow-x-auto text-right font-mono text-3xl font-bold tracking-wide",
          hasError
            ? "animate-pulse text-red-600 dark:text-red-400"
            : "text-gray-900 dark:text-white",
        )}
      >
        {value}
      </div>
    </div>
  )
}
