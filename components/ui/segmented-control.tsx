"use client"

import { cn } from "@/lib/utils"

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  /** Effectif du segment (« Incorrectes 4 »), en mono à droite du libellé. */
  count?: number
  /** Remplace le `data-testid` dérivé de `testIdPrefix` pour ce segment. */
  testId?: string
}

type SegmentedControlProps<T extends string> = {
  /** Nom du groupe pour un lecteur d'écran (« Période »). */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onValueChange: (value: T) => void
  /** Préfixe des `data-testid` : `${prefix}-${value}`. */
  testIdPrefix?: string
  className?: string
}

/**
 * Onglets segmentés (filtre compact) : boutons à `aria-pressed`, 40 px comme
 * tout contrôle d'une barre de filtres, cibles de 44 px sous 768 px. Pour un
 * choix exclusif sans panneau à afficher ; des onglets à panneaux restent
 * `Tabs`.
 */
export const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onValueChange,
  testIdPrefix,
  className,
}: SegmentedControlProps<T>) => (
  <div
    role="group"
    aria-label={label}
    className={cn(
      "bg-surface-2 inline-flex h-10 items-center rounded-md p-1 max-md:h-13",
      className,
    )}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        data-testid={
          option.testId ??
          (testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined)
        }
        onClick={() => onValueChange(option.value)}
        className="focus-ring text-ink-3 hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-1 inline-flex h-full cursor-pointer items-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-[background-color,opacity] max-md:px-4"
      >
        {option.label}
        {option.count !== undefined && (
          <span className="text-ink-3 font-mono text-xs tabular-nums">
            {option.count}
          </span>
        )}
      </button>
    ))}
  </div>
)
