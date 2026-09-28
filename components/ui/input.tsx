import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "focus-ring border-line-strong bg-surface text-ink placeholder:text-ink-4 file:text-ink selection:bg-accent-soft flex h-10 w-full min-w-0 rounded-md border px-3 py-1 text-base transition-[color,border-color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
