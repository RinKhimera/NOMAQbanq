"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { motion } from "motion/react"
import { TrendingUp, BarChart3 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface ScoreHistoryItem {
  examId: string
  examTitle: string
  score: number
  completedAt: number
}

interface ScoreEvolutionChartProps {
  data: ScoreHistoryItem[]
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: {
      examTitle: string
      score: number
      completedAt: number
    }
  }>
}) => {
  if (!active || !payload?.length) return null

  const item = payload[0].payload
  const date = new Date(item.completedAt)

  return (
    <div className="rounded-xl border border-blue-200/50 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm dark:border-blue-800/50 dark:bg-gray-900/95">
      <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
        {item.examTitle}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {format(date, "d MMMM yyyy", { locale: fr })}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${
            item.score >= 60 ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {item.score}%
        </span>
      </div>
    </div>
  )
}

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="flex h-full flex-col items-center justify-center gap-4 py-8"
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
      <BarChart3 className="h-8 w-8 text-blue-500" />
    </div>
    <div className="text-center">
      <p className="font-semibold text-gray-900 dark:text-white">
        Aucune donnée disponible
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Complétez des examens pour voir votre progression
      </p>
    </div>
  </motion.div>
)

export const ScoreEvolutionChart = ({ data }: ScoreEvolutionChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-gray-900 dark:text-white">
              Évolution du score
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Progression au fil des examens
            </p>
          </div>
        </div>
        <div className="h-64">
          <EmptyState />
        </div>
      </div>
    )
  }

  // Format data for chart
  const chartData = data.map((item, index) => ({
    ...item,
    index: index + 1,
    label: `#${index + 1}`,
  }))

  // Calculate trend (only meaningful with 2+ exams)
  const canShowTrend = data.length >= 2
  let trendUp = true

  if (canShowTrend) {
    const firstHalf = data.slice(0, Math.ceil(data.length / 2))
    const secondHalf = data.slice(Math.ceil(data.length / 2))
    const firstAvg =
      firstHalf.reduce((acc, item) => acc + item.score, 0) / firstHalf.length
    const secondAvg =
      secondHalf.reduce((acc, item) => acc + item.score, 0) / secondHalf.length
    trendUp = secondAvg >= firstAvg
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80"
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-gray-900 dark:text-white">
              Évolution du score
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.length} examen{data.length > 1 ? "s" : ""} complété
              {data.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Trend indicator (only shown with 2+ exams) */}
        {canShowTrend && (
          <div
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${
              trendUp
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            <TrendingUp
              className={`h-4 w-4 ${!trendUp && "rotate-180 transform"}`}
            />
            <span>{trendUp ? "En hausse" : "En baisse"}</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-gray-500 dark:text-gray-400"
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-gray-500 dark:text-gray-400"
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#3B82F6"
              strokeWidth={3}
              fill="url(#scoreGradient)"
              dot={{
                fill: "#3B82F6",
                stroke: "#fff",
                strokeWidth: 2,
                r: 5,
              }}
              activeDot={{
                fill: "#3B82F6",
                stroke: "#fff",
                strokeWidth: 3,
                r: 7,
              }}
            />
            {/* Pass threshold line at 60% */}
            <ReferenceLine
              y={60}
              stroke="#10B981"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-gray-600 dark:text-gray-400">Votre score</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-6 bg-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Seuil de réussite (60%)
          </span>
        </div>
      </div>
    </motion.div>
  )
}
