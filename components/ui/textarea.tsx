import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "focus-ring border-line-strong bg-surface text-ink placeholder:text-ink-4 aria-invalid:border-danger flex field-sizing-content min-h-20 w-full rounded-md border px-3 py-2 text-base transition-[color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
