import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Une seule couleur d'action, en aplat ; le survol change le fond, jamais la
 * géométrie. Les variantes héritées (`btn_modern`, `btn_secondary`,
 * `btn_link`, `btn_modern_outline`, `badge`) sont des alias du nouveau style,
 * conservés le temps que les écrans migrent (retrait à la contraction).
 */
const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-(--duration-base) disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent-hover",
        destructive: "bg-danger text-accent-foreground hover:bg-danger-ink",
        outline:
          "border-line-strong bg-surface text-ink hover:bg-surface-2 border",
        secondary: "bg-surface-2 text-ink hover:bg-line",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        link: "text-accent-ink underline-offset-4 hover:underline",
        btn_modern: "bg-accent text-accent-foreground hover:bg-accent-hover",
        btn_secondary:
          "border-line-strong bg-surface text-ink hover:bg-surface-2 border",
        btn_modern_outline:
          "border-line-strong bg-surface text-ink hover:bg-surface-2 border",
        btn_link: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        badge: "bg-accent-soft text-accent-ink rounded-xs",
        none: "",
      },
      size: {
        default: "h-10 px-4 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-base has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
