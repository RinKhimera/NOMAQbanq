export type ChartDatum = { label: string; value: number }

const defaultFormat = (v: number) => v.toLocaleString("fr-CA")

/**
 * Barres horizontales pour des valeurs quelconques (montants, nombres) :
 * l'échelle est la valeur maximale, jamais 0–100. Balisage seul, sans
 * bibliothèque de graphiques : rendu serveur, aucun chargement différé.
 */
export const ValueBarChart = ({
  data,
  format = defaultFormat,
  label,
}: {
  data: ChartDatum[]
  format?: (value: number) => string
  /** Résumé pour un lecteur d'écran. */
  label: string
}) => {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li
          key={d.label}
          className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_48px] items-center gap-3 text-sm max-[480px]:grid-cols-[minmax(0,1fr)_48px]"
        >
          <span className="text-ink-2 truncate">{d.label}</span>
          <span
            aria-hidden="true"
            className="bg-surface-2 h-2 overflow-hidden rounded-xs max-[480px]:col-span-full max-[480px]:row-start-2"
          >
            <span
              className="bg-accent block h-full"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="text-ink text-right font-mono text-xs tabular-nums">
            {format(d.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}
