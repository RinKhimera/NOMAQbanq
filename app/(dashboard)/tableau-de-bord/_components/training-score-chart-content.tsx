"use client"

import { Brain, TrendingUp } from "lucide-react"
import { motion } from "motion/react"
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
import { formatExpiration } from "@/lib/format"

interface TrainingSessionItem {
  sessionId: string
  /** `null` = score retenu (réponse en correction différée) : hors courbe. */
  score: number | null
  completedAt: number
  questionCount: number
  domain: string
}

type ReadableSessionItem = TrainingSessionItem & { score: number }

const isReadable = (item: TrainingSessionItem): item is ReadableSessionItem =>
  item.score !== null

interface TrainingScoreChartProps {
  sessions: TrainingSessionItem[]
}

const AreaChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: {
      domain: string
      score: number
      completedAt: number
      questionCount: number
    }
  }>
}) => {
  if (!active || !payload?.length) return null

  const item = payload[0].payload

  return (
    <div className="rounded-xl border border-purple-200/50 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm dark:border-purple-800/50 dark:bg-gray-900/95">
      <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
        {item.domain}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {formatExpiration(item.completedAt)}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {item.questionCount} questions
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
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/30">
      <Brain className="h-8 w-8 text-purple-500" />
    </div>
    <div className="text-center">
      <p className="font-semibold text-gray-900 dark:text-white">
        Aucune donnée disponible
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Complétez des sessions d&apos;entraînement pour voir votre progression
      </p>
    </div>
  </motion.div>
)

export const TrainingScoreChartContent = ({
  sessions: allSessions,
}: TrainingScoreChartProps) => {
  const sessions = (allSessions ?? []).filter(isReadable)
  const withheldCount = (allSessions?.length ?? 0) - sessions.length
  if (sessions.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-gray-900 dark:text-white">
              Progression entraînement
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Évolution au fil des sessions
            </p>
          </div>
        </div>
        <div className="h-64">
          <EmptyState />
        </div>
      </div>
    )
  }

  const areaChartData = sessions.map((item, index) => ({
    ...item,
    index: index + 1,
    label: `#${index + 1}`,
  }))

  // Calculer la tendance (seulement si 2+ sessions)
  const canShowTrend = sessions.length >= 2
  let trendUp = true

  if (canShowTrend) {
    const firstHalf = sessions.slice(0, Math.ceil(sessions.length / 2))
    const secondHalf = sessions.slice(Math.ceil(sessions.length / 2))
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
      transition={{ duration: 0.5, delay: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-gray-900 dark:text-white">
              Progression entraînement
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sessions.length} session{sessions.length > 1 ? "s" : ""}{" "}
              complétée{sessions.length > 1 ? "s" : ""}
              {withheldCount > 0 &&
                ` · ${withheldCount} en attente de clôture d'examen`}
            </p>
          </div>
        </div>

        {/* Indicateur de tendance */}
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

      <div className="[&_svg_*:focus]:outline-none">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={areaChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="trainingScoreGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
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
              <Tooltip content={<AreaChartTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#8B5CF6"
                strokeWidth={3}
                fill="url(#trainingScoreGradient)"
                dot={{
                  fill: "#8B5CF6",
                  stroke: "#fff",
                  strokeWidth: 2,
                  r: 5,
                }}
                activeDot={{
                  fill: "#8B5CF6",
                  stroke: "#fff",
                  strokeWidth: 3,
                  r: 7,
                }}
              />
              {/* Ligne seuil de réussite à 60% */}
              <ReferenceLine
                y={60}
                stroke="#10B981"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Légende */}
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span className="text-gray-600 dark:text-gray-400">
              Votre score
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-emerald-500" />
            <span className="text-gray-600 dark:text-gray-400">
              Seuil de réussite (60%)
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
