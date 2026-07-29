import { cn } from "@/lib/utils"

type PendingRegionProps = React.ComponentProps<"div"> & {
  isPending: boolean
}

/**
 * Zone en cours de rechargement : le contenu reste à l'écran (pas de saut de
 * layout, l'utilisateur garde son repère) mais devient inerte le temps de la
 * requête. Pour un rechargement en place uniquement — une navigation relève du
 * squelette. Voir `.claude/rules/loading-ui.md`.
 *
 * `pointer-events-none` neutralise la souris mais PAS le clavier : volontaire,
 * l'attente dure quelques centaines de ms et rendre les enfants `inert`
 * déplacerait le focus au retour.
 */
export const PendingRegion = ({
  isPending,
  className,
  children,
  ...props
}: PendingRegionProps) => (
  <div
    aria-busy={isPending}
    className={cn(
      "transition-opacity duration-200",
      isPending && "pointer-events-none opacity-60",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)
