import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const

type SpinnerProps = {
  /** `sm` dans un bouton ou un champ, `md` par défaut, `lg` pour un écran d'attente dédié. */
  size?: keyof typeof SIZES
  /** Classes du SVG. La couleur vient de `currentColor` : hériter plutôt que forcer. */
  className?: string
  /** Annoncé aux lecteurs d'écran. */
  label?: string
}

/**
 * Le seul spinner de l'application. Réservé aux attentes déclenchées par une
 * action de l'utilisateur (bouton, formulaire, upload) — jamais pour une
 * navigation, qui relève du squelette. Voir `.claude/rules/loading-ui.md`.
 */
export const Spinner = ({
  size = "md",
  className,
  label = "Chargement…",
}: SpinnerProps) => (
  <span role="status" className="inline-flex items-center">
    <LoaderCircle
      aria-hidden="true"
      className={cn(
        SIZES[size],
        "animate-spin motion-reduce:animate-none",
        className,
      )}
    />
    <span className="sr-only">{label}</span>
  </span>
)
