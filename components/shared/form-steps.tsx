import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleX,
  Lock,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Titre d'une étape numérotée d'un long formulaire : « 03 Choix de réponse ». */
export const StepTitle = ({
  n,
  children,
}: {
  n: number
  children: ReactNode
}) => (
  <span className="inline-flex items-baseline gap-2.5">
    <span className="text-ink-3 font-mono text-[0.8125rem] font-medium">
      {String(n).padStart(2, "0")}
    </span>
    {children}
  </span>
)

/** Carte d'une étape : titre, description, contenu. `id` sert d'ancre au défilement vers une erreur. */
export const StepCard = ({
  id,
  n,
  title,
  description,
  children,
}: {
  id: string
  n: number
  title: string
  description?: ReactNode
  children: ReactNode
}) => (
  <section
    id={id}
    aria-labelledby={`${id}-title`}
    className="bg-surface border-line shadow-1 flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-lg border p-5 max-md:p-4"
  >
    <div className="flex flex-col gap-1">
      <h2 id={`${id}-title`} className="type-h4 text-ink">
        <StepTitle n={n}>{title}</StepTitle>
      </h2>
      {description && (
        <p className="text-ink-3 text-[0.8125rem] leading-normal">
          {description}
        </p>
      )}
    </div>
    {children}
  </section>
)

/**
 * `ok` vérifiée, `todo` à faire, `error` à faire après une tentative
 * d'enregistrement, `locked` imposée (verrou), `advice` recommandée sans
 * bloquer.
 */
export type SummaryCheckState = "ok" | "todo" | "error" | "locked" | "advice"

export type SummaryCheck = {
  id: string
  label: string
  state: SummaryCheckState
}

const CHECK_ICON: Record<SummaryCheckState, [LucideIcon, string]> = {
  ok: [CircleCheck, "text-success"],
  todo: [Circle, "text-ink-4"],
  error: [CircleX, "text-danger"],
  locked: [Lock, "text-ink-3"],
  advice: [CircleDashed, "text-warning"],
}

/**
 * Colonne de synthèse d'un formulaire en étapes : vérifications mises à jour
 * en direct, puis les actions. `blink` change à chaque tentative refusée :
 * les vérifications en échec sont remontées, et un lecteur d'écran les relit.
 */
export const SummaryPanel = ({
  checks,
  blink = 0,
  children,
}: {
  checks: SummaryCheck[]
  blink?: number
  children: ReactNode
}) => (
  <div className="bg-surface-2 border-line flex flex-col gap-2.5 rounded-lg border p-4">
    <span className="type-label">Vérifications</span>
    <ul
      className="flex flex-col gap-2"
      data-testid="form-checks"
      aria-live="polite"
    >
      {checks.map((c) => {
        const [Icon, color] = CHECK_ICON[c.state]
        return (
          <li
            key={c.state === "error" ? `${c.id}-${blink}` : c.id}
            data-state={c.state}
            className={cn(
              "flex items-start gap-2 text-sm",
              c.state === "ok" && "text-ink",
              c.state === "error" && "text-danger-ink",
              (c.state === "todo" ||
                c.state === "locked" ||
                c.state === "advice") &&
                "text-ink-3",
            )}
          >
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", color)} />
            {c.label}
          </li>
        )
      })}
    </ul>
    <div className="border-line mt-1 flex flex-col gap-2 border-t pt-3">
      {children}
    </div>
  </div>
)
