import type { LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { TONE_TEXT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { StatusTitle } from "./status-title"

type StatusCardProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  iconTone?: Tone
  /** Libellé mono à côté de l'icône (« Erreur 404 », « Compte suspendu »). */
  label?: string
  actions?: ReactNode
  /** Aide sous un filet, en bas de carte. */
  help?: ReactNode
  /** `form` 440 px (authentification), `status` 520 px (pages d'état). */
  size?: "form" | "status"
  /**
   * Carte qui remplace l'écran où l'utilisateur vient d'agir (courriel
   * envoyé, désabonnement confirmé) : le bouton activé a disparu, le focus
   * va au titre plutôt que de tomber sur `<body>`.
   */
  focusTitle?: boolean
}

/** Carte centrée portant le `h1` de la page : authentification, pages d'état. */
export const StatusCard = ({
  title,
  description,
  icon: Icon,
  iconTone = "neutral",
  label,
  actions,
  help,
  size = "status",
  focusTitle = false,
  className,
  children,
  ...props
}: StatusCardProps) => (
  <div
    className={cn(
      "bg-surface border-line shadow-1 flex w-full flex-col gap-5 rounded-lg border p-8 max-[480px]:px-5 max-[480px]:py-6",
      size === "form" ? "max-w-110" : "max-w-130",
      className,
    )}
    {...props}
  >
    <div className="flex flex-col gap-2">
      {(Icon || label) && (
        <div className="mb-2 flex items-center gap-2.5">
          {Icon && (
            <Icon aria-hidden className={cn("size-5", TONE_TEXT[iconTone])} />
          )}
          {label && <span className="type-label">{label}</span>}
        </div>
      )}
      <StatusTitle focusOnMount={focusTitle}>{title}</StatusTitle>
      {description && <p className="text-ink-3 text-[15px]">{description}</p>}
    </div>
    {children}
    {actions && <div className="flex flex-wrap gap-2.5 pt-1">{actions}</div>}
    {help && (
      <div className="border-line text-ink-3 border-t pt-4 text-[13px]">
        {help}
      </div>
    )}
  </div>
)

/** Fond des pages d'état de la vitrine : trame de points, carte centrée. */
export const StatusScreen = ({ children }: { children: ReactNode }) => (
  <div className="bg-dots-fade border-line border-b">
    <div className="relative mx-auto grid min-h-[min(72vh,720px)] max-w-6xl place-items-center px-4 py-18 sm:px-6">
      {children}
    </div>
  </div>
)
