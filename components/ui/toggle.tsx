"use client"

import * as TogglePrimitive from "@radix-ui/react-toggle"
import { type VariantProps, cva } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "focus-ring text-ink-2 hover:bg-surface-2 hover:text-ink data-[state=on]:bg-accent-soft data-[state=on]:text-accent-ink aria-invalid:border-danger inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-line-strong bg-surface border",
      },
      size: {
        default: "h-10 px-2 min-w-10",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-12 px-2.5 min-w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
