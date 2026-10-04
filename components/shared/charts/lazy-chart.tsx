"use client"

import dynamic from "next/dynamic"
import type { ComponentType } from "react"
import { Skeleton } from "@/components/ui/skeleton"

/** Réserve la hauteur du graphique pendant le chargement : aucun saut de mise en page. */
export const ChartSkeleton = ({ height }: { height: number }) => (
  <Skeleton
    data-testid="chart-skeleton"
    className="w-full rounded-md"
    style={{ height }}
  />
)

/**
 * Charge un graphique recharts à part du bundle de la page, côté client
 * seulement. Sans `ssr`, Next n'a rien à précharger au rendu serveur : le
 * `import()` peut donc vivre chez l'appelant, qui passe le composant exporté.
 *
 *   const ScoreLines = lazyChart(
 *     () => import("./score-chart-content").then((m) => m.ScoreChartContent),
 *     { height: 200 },
 *   )
 *
 * À appeler au niveau du module, jamais pendant un rendu.
 */
export const lazyChart = <P extends object>(
  load: () => Promise<ComponentType<P>>,
  { height }: { height: number },
) =>
  dynamic(() => load().then((Chart) => ({ default: Chart })), {
    ssr: false,
    loading: () => <ChartSkeleton height={height} />,
  })
