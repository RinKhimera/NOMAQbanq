import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["Compte créé", "Profil", "Tableau de bord"] as const

/** Étapes de l'accueil : le compte est créé, le profil est l'étape en cours. */
export const OnboardingStepper = ({ current = 1 }: { current?: number }) => (
  <ol
    aria-label="Étapes de l'inscription"
    className="flex items-center gap-3 text-sm"
  >
    {STEPS.map((label, index) => {
      const done = index < current
      const active = index === current
      return (
        <li
          key={label}
          aria-current={active ? "step" : undefined}
          className="flex min-w-0 items-center gap-3 not-last:flex-1 last:flex-none"
        >
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-sm border font-mono text-xs",
                done && "bg-accent border-accent text-accent-foreground",
                active && "border-accent text-accent-ink",
                !done && !active && "border-line-strong text-ink-3",
              )}
            >
              {done ? (
                <Check className="size-3.5" aria-label="Terminée" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "whitespace-nowrap",
                active ? "text-ink font-semibold" : "text-ink-3",
                !active && "max-[480px]:sr-only",
              )}
            >
              {label}
            </span>
          </span>
          {index < STEPS.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "h-px min-w-4 flex-1",
                done ? "bg-accent" : "bg-line-strong",
              )}
            />
          )}
        </li>
      )
    })}
  </ol>
)
