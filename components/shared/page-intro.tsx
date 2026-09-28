import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ElementType, ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const colorSchemes = {
  slate: "from-slate-600 to-slate-700 shadow-slate-500/20",
  blue: "from-blue-600 to-indigo-600 shadow-blue-500/25",
  violet: "from-violet-600 to-purple-600 shadow-violet-500/25",
  amber: "from-amber-500 to-orange-600 shadow-amber-500/25",
  emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/25",
} as const

type PageIntroProps = {
  title: string
  description?: ReactNode
  /** Surtitre court (zone, rubrique). */
  label?: string
  icon?: ElementType
  colorScheme?: keyof typeof colorSchemes
  backHref?: string
  badge?: { count: number | string; label: string }
  actions?: ReactNode
  className?: string
}

/** En-tête unique des pages de l'app : un seul `h1` par page. */
export const PageIntro = ({
  title,
  description,
  label,
  icon: Icon,
  colorScheme = "blue",
  backHref,
  badge,
  actions,
  className,
}: PageIntroProps) => (
  <div
    className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
      className,
    )}
  >
    <div className="flex items-center gap-4">
      {backHref && (
        <Button
          asChild
          variant="outline"
          size="icon"
          className="shrink-0 rounded-xl"
        >
          <Link href={backHref} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {Icon && (
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br shadow-lg",
            colorSchemes[colorScheme],
          )}
        >
          <Icon className="h-7 w-7 text-white" />
        </div>
      )}
      <div className="min-w-0">
        {label && (
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
            {label}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    </div>

    {(badge || actions) && (
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {badge && (
          <Badge
            variant="secondary"
            className="h-8 shrink-0 bg-gray-100 px-3 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {badge.count} {badge.label}
          </Badge>
        )}
        {actions}
      </div>
    )}
  </div>
)
