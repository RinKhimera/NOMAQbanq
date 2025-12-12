"use client"

import { memo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CalculatorButtonVariant } from "./types"

type CalculatorButtonProps = {
  value: string
  displayValue?: string
  onClick: (value: string) => void
  variant?: CalculatorButtonVariant
  className?: string
  ariaLabel?: string
  colSpan?: number
}

const variantStyles: Record<CalculatorButtonVariant, string> = {
  number:
    "bg-white text-gray-900 hover:bg-gray-100 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600",
  operator:
    "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70 border border-blue-200 dark:border-blue-800",
  action:
    "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500",
  equals:
    "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md",
}

export const CalculatorButton = memo(
  ({
    value,
    displayValue,
    onClick,
    variant = "number",
    className,
    ariaLabel,
    colSpan = 1,
  }: CalculatorButtonProps) => {
    const handleClick = useCallback(() => {
      onClick(value)
    }, [value, onClick])

    return (
      <Button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel || `Touche ${displayValue || value}`}
        className={cn(
          "h-14 text-xl font-semibold transition-transform active:scale-95",
          variantStyles[variant],
          colSpan === 2 && "col-span-2",
          className,
        )}
      >
        {displayValue || value}
      </Button>
    )
  },
)

CalculatorButton.displayName = "CalculatorButton"
