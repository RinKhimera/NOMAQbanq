"use client"

import { ChartNoAxesColumn } from "lucide-react"
import type { ReactNode } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { PASS_THRESHOLD, formatScore } from "@/lib/score"
import { lazyChart } from "./lazy-chart"

export type ScorePoint = {
  /** Clé stable du point (id, semaine). */
  key: string
  /** Graduation de l'axe horizontal, courte. */
  label: string
  /** Score 0–100, déjà lisible : un score retenu n'a pas de point. */
  value: number
  /** En-tête de l'infobulle (titre d'examen, semaine). */
  detail: string
}

const DEFAULT_HEIGHT = 200

const ScoreLines = lazyChart(
  () => import("./score-chart-content").then((m) => m.ScoreChartContent),
  { height: DEFAULT_HEIGHT },
)

type ScoreChartProps = {
  data: ScorePoint[]
  /** Nom du graphique pour un lecteur d'écran (« Évolution du score »). */
  label: string
  empty: { title: string; description: string }
  /** Recours de l'état vide (lien vers une série, un examen). */
  emptyAction?: ReactNode
}

/**
 * Seul graphique de score de l'app : courbe 0–100 et seuil de réussite. Les
 * montants ont leurs propres graphiques — jamais cette échelle. recharts n'est
 * chargé que s'il y a au moins un point.
 */
export const ScoreChart = ({
  data,
  label,
  empty,
  emptyAction,
}: ScoreChartProps) => {
  if (data.length === 0) {
    return (
      <EmptyState
        size="compact"
        icons={[ChartNoAxesColumn]}
        title={empty.title}
        description={empty.description}
        className="min-h-50"
      >
        {emptyAction}
      </EmptyState>
    )
  }

  const last = data.at(-1)
  return (
    <figure
      aria-label={`${label} : ${data.length} point${data.length > 1 ? "s" : ""}, dernier ${formatScore(last?.value ?? null)}, seuil de réussite ${formatScore(PASS_THRESHOLD)}`}
    >
      <ScoreLines data={data} height={DEFAULT_HEIGHT} />
    </figure>
  )
}
