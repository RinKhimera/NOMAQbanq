import type { ChartDatum } from "./value-bar-chart"

const defaultFormat = (v: number) => v.toLocaleString("fr-CA")

/**
 * Colonnes verticales pour une série temporelle de valeurs quelconques
 * (revenus par jour) : échelle sur le maximum, jamais 0–100. Balisage seul :
 * rendu serveur, aucun chargement différé. Chaque colonne porte sa valeur en
 * infobulle ; la figure se résume par son maximum.
 */
export const ColumnChart = ({
  data,
  format = defaultFormat,
  height = 160,
  label,
}: {
  data: ChartDatum[]
  format?: (value: number) => string
  height?: number
  /** Résumé pour un lecteur d'écran, complété du maximum. */
  label: string
}) => {
  const max = Math.max(0, ...data.map((d) => d.value))
  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`${label}, maximum sur un jour : ${format(max)}`}
        className="border-line flex items-end gap-1 overflow-hidden border-b"
        style={{ height }}
      >
        {data.map((d) => (
          <div
            key={d.label}
            title={`${d.label} · ${format(d.value)}`}
            className="flex h-full flex-1 items-end"
          >
            <span
              className="bg-accent block w-full rounded-t-[1px]"
              style={{
                height:
                  d.value > 0
                    ? `${Math.max(3, (d.value / Math.max(1, max)) * 100)}%`
                    : 0,
              }}
            />
          </div>
        ))}
      </div>
      {data.length > 0 && (
        <figcaption className="text-ink-3 flex justify-between gap-2 font-mono text-[0.6875rem]">
          <span>{data[0].label}</span>
          <span>Maximum sur un jour : {format(max)}</span>
          <span>{data.at(-1)!.label}</span>
        </figcaption>
      )}
    </figure>
  )
}
