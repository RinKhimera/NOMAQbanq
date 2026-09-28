import { LucideIcon } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  icons?: LucideIcon[]
  action?: {
    label: string
    onClick: () => void
  }
  /** Action libre (lien, plusieurs boutons) sous le texte. */
  children?: React.ReactNode
  /** `compact` : dans une carte, une liste ou un panneau, sans cadre. */
  size?: "default" | "compact"
  className?: string
  iconClassName?: string
}

export function EmptyState({
  title,
  description,
  icons = [],
  action,
  children,
  size = "default",
  className,
  iconClassName,
}: EmptyStateProps) {
  if (size === "compact") {
    const Icon = icons[0]
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center px-4 py-8 text-center",
          className,
        )}
      >
        {Icon && (
          <div
            className={cn(
              "bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full",
              iconClassName,
            )}
          >
            <Icon className="text-muted-foreground h-6 w-6" />
          </div>
        )}
        <p className="text-foreground font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick} variant="outline" className="mt-4">
            {action.label}
          </Button>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-background border-border hover:border-border/80 text-center",
        "w-full max-w-155 rounded-xl border p-14",
        "group hover:bg-muted/50 transition duration-500 hover:duration-200",
        className,
      )}
    >
      <div className="isolate flex justify-center">
        {icons.length === 3 ? (
          <>
            <div
              className={cn(
                "bg-background ring-border relative top-1.5 left-2.5 grid size-12 -rotate-6 place-items-center rounded-xl shadow-lg ring-1 transition duration-500 group-hover:-translate-x-5 group-hover:-translate-y-0.5 group-hover:-rotate-12 group-hover:duration-200",
                iconClassName,
              )}
            >
              {React.createElement(icons[0], {
                className: "w-6 h-6 text-muted-foreground",
              })}
            </div>
            <div
              className={cn(
                "bg-background ring-border relative z-10 grid size-12 place-items-center rounded-xl shadow-lg ring-1 transition duration-500 group-hover:-translate-y-0.5 group-hover:duration-200",
                iconClassName,
              )}
            >
              {React.createElement(icons[1], {
                className: "w-6 h-6 text-muted-foreground",
              })}
            </div>
            <div
              className={cn(
                "bg-background ring-border relative top-1.5 right-2.5 grid size-12 rotate-6 place-items-center rounded-xl shadow-lg ring-1 transition duration-500 group-hover:translate-x-5 group-hover:-translate-y-0.5 group-hover:rotate-12 group-hover:duration-200",
                iconClassName,
              )}
            >
              {React.createElement(icons[2], {
                className: "w-6 h-6 text-muted-foreground",
              })}
            </div>
          </>
        ) : (
          <div
            className={cn(
              "bg-background ring-border grid size-12 place-items-center rounded-xl shadow-lg ring-1 transition duration-500 group-hover:-translate-y-0.5 group-hover:duration-200",
              iconClassName,
            )}
          >
            {icons[0] &&
              React.createElement(icons[0], {
                className: "w-6 h-6 text-muted-foreground",
              })}
          </div>
        )}
      </div>
      <h2 className="text-foreground mt-6 font-medium">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          className={cn("mt-4", "shadow-sm active:shadow-none")}
        >
          {action.label}
        </Button>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
