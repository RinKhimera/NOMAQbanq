import { formatScore, scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"

interface ScoreRingProps {
  /** `null` = aucun score lisible : anneau vide et « — », jamais un 0 %. */
  value: number | null
  label?: string
  size?: number
  strokeWidth?: number
  className?: string
  /** `data-testid` du pourcentage affiché. */
  valueTestId?: string
}

export const ScoreRing = ({
  value,
  label = "Score moyen",
  size = 160,
  strokeWidth = 12,
  className,
  valueTestId,
}: ScoreRingProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - ((value ?? 0) / 100) * circumference

  const color =
    value === null ? TONE_COLOR.neutral : TONE_COLOR[scoreTone(value)]

  return (
    <div className={cn("relative", className)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-2"
        />

        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          data-testid={valueTestId}
          className={cn(
            "font-serif text-4xl font-semibold tracking-tight tabular-nums",
            value === null && "text-ink-3",
          )}
          style={value === null ? undefined : { color }}
        >
          {formatScore(value)}
        </span>
        <span className="text-ink-3 font-mono text-xs font-medium tracking-[0.06em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}
