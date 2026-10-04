"use client"

import * as ProgressPrimitive from "@radix-ui/react-progress"
import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indicatorColor,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Couleur CSS de la barre (`TONE_COLOR` de `lib/tone.ts`) ; accent par défaut. */
  indicatorColor?: string
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-surface-2 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-accent h-full w-full flex-1 transition-transform duration-(--duration-slow)"
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          backgroundColor: indicatorColor,
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
