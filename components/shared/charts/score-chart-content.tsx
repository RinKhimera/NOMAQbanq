"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PASS_THRESHOLD, formatScore, scoreTextClass } from "@/lib/score"
import { cn } from "@/lib/utils"
import type { ScorePoint } from "./score-chart"

const TICK = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fill: "var(--ink-3)",
}

const PointTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ScorePoint }>
}) => {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="bg-surface border-line shadow-pop rounded-lg border px-3 py-2">
      <p className="text-ink text-sm font-medium">{point.detail}</p>
      <p
        className={cn(
          "font-mono text-sm font-medium",
          scoreTextClass(point.value),
        )}
      >
        {formatScore(point.value)}
      </p>
    </div>
  )
}

/** Courbe 0–100 et seuil de réussite. Chargée à part par `ScoreChart`. */
export const ScoreChartContent = ({
  data,
  height,
}: {
  data: ScorePoint[]
  height: number
}) => (
  <div style={{ height }} className="[&_svg_*:focus]:outline-none">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 8, right: 12, left: -24, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={TICK}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          axisLine={false}
          tickLine={false}
          tick={TICK}
        />
        <ReferenceLine
          y={PASS_THRESHOLD}
          stroke="var(--ink-2)"
          strokeDasharray="3 3"
        />
        <Tooltip
          content={<PointTooltip />}
          cursor={{ stroke: "var(--line-strong)" }}
        />
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={1.75}
          dot={{
            r: 3.5,
            fill: "var(--surface)",
            stroke: "var(--accent)",
            strokeWidth: 1.75,
          }}
          activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)
