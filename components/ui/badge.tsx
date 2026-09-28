import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

// `badge` et `success_badge` : alias hérités, rendus au nouveau style jusqu'à
// la contraction.
const badgeVariants = cva(
  "focus-ring inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-xs border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] aria-invalid:border-danger [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground [a&]:hover:bg-accent-hover border-transparent",
        secondary:
          "bg-surface-2 text-ink-2 [a&]:hover:bg-line border-transparent",
        destructive: "border-danger-line bg-danger-soft text-danger-ink",
        outline: "border-line-strong text-ink-2 [a&]:hover:bg-surface-2",
        badge: "bg-accent-soft text-accent-ink border-transparent",
        success_badge: "border-success-line bg-success-soft text-success-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
