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

const IconTile = ({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) => (
  <div
    className={cn(
      "bg-surface border-line grid size-12 place-items-center rounded-lg border",
      className,
    )}
  >
    <Icon className="text-ink-3 size-6" aria-hidden="true" />
  </div>
)

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
          <Icon
            className={cn("text-ink-3 mb-3 size-8", iconClassName)}
            aria-hidden="true"
          />
        )}
        <p className="text-ink font-medium">{title}</p>
        {description && (
          <p className="text-ink-3 mt-1 text-sm whitespace-pre-line">
            {description}
          </p>
        )}
        {action && (
          <Button
            type="button"
            onClick={action.onClick}
            variant="outline"
            className="mt-4"
          >
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
        "bg-surface border-line w-full max-w-155 rounded-lg border p-14 text-center",
        className,
      )}
    >
      {icons.length > 0 && (
        <div className="flex justify-center gap-2">
          {icons.slice(0, 3).map((icon, index) => (
            <IconTile key={index} icon={icon} className={iconClassName} />
          ))}
        </div>
      )}
      <h2 className="text-ink mt-6 font-medium">{title}</h2>
      {description && (
        <p className="text-ink-3 mt-1 text-sm whitespace-pre-line">
          {description}
        </p>
      )}
      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          variant="outline"
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
