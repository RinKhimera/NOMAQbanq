import { X } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type FilterChipProps = {
  children: ReactNode
  onRemove: () => void
  /** Nom accessible du bouton de retrait, ex. « Retirer Dyspnée ». */
  removeLabel: string
  disabled?: boolean
  className?: string
}

/** Pastille d'une valeur sélectionnée, retirable. */
export const FilterChip = ({
  children,
  onRemove,
  removeLabel,
  disabled = false,
  className,
}: FilterChipProps) => (
  <Badge
    variant="secondary"
    className={cn("flex items-center gap-1.5 py-1 pr-1 pl-2.5", className)}
  >
    <span className="max-w-50 truncate">{children}</span>
    <button
      type="button"
      disabled={disabled}
      onClick={onRemove}
      aria-label={removeLabel}
      className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <X className="h-3 w-3" />
    </button>
  </Badge>
)
