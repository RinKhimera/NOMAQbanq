import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ElementType, ReactNode } from "react"
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
  icon?: ElementType
  colorScheme?: keyof typeof colorSchemes
  backHref?: string
  actions?: ReactNode
  className?: string
}

/** En-tête unique des pages de l'app : un seul `h1` par page. */
export const PageIntro = ({
  title,
  description,
  icon: Icon,
  colorScheme = "blue",
  backHref,
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

    {actions && (
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {actions}
      </div>
    )}
  </div>
)
