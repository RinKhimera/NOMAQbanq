"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { type ReactNode, useOptimistic, useTransition } from "react"
import { PendingRegion } from "@/components/ui/pending-region"
import {
  DEFAULT_PERIOD,
  type DashboardPeriod,
  PERIOD_PARAM,
} from "@/lib/dashboard-period"
import { cn } from "@/lib/utils"

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "tout", label: "Tout" },
]

/**
 * Période du tableau de bord, portée par l'URL : le serveur relit
 * `?periode=` et renvoie les chiffres ; la zone qu'elle filtre reste affichée,
 * grisée, le temps de la requête.
 */
export const PeriodFilter = ({
  value,
  children,
}: {
  value: DashboardPeriod
  children: ReactNode
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useOptimistic(value)

  const choose = (next: DashboardPeriod) => {
    if (next === selected) return
    const params = new URLSearchParams(searchParams)
    if (next === DEFAULT_PERIOD) params.delete(PERIOD_PARAM)
    else params.set(PERIOD_PARAM, next)
    const query = params.toString()
    startTransition(() => {
      setSelected(next)
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <div
          role="group"
          aria-label="Période"
          className="bg-surface-2 inline-flex h-10 items-center rounded-md p-1 max-md:h-13"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected === option.value}
              data-testid={`period-${option.value}`}
              onClick={() => choose(option.value)}
              className={cn(
                "focus-ring text-ink-3 hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-1 inline-flex h-full cursor-pointer items-center rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-[background-color,opacity] max-md:px-4",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <PendingRegion isPending={isPending} className="flex flex-col gap-5">
        {children}
      </PendingRegion>
    </>
  )
}
