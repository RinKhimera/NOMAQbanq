"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { BarChart3, Brain, LineChart, TrendingUp } from "lucide-react"
import { motion } from "motion/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Id } from "@/convex/_generated/dataModel"

interface TrainingSessionItem {
  sessionId: Id<"trainingParticipations">
  score: number
  completedAt: number
  questionCount: number
  domain: string
}

interface DomainPerformanceItem {
  domain: string
  averageScore: number
  sessionCount: number
}

interface TrainingScoreChartProps {
  sessions: TrainingSessionItem[]
  domainPerformance: DomainPerformanceItem[]
}

// Palette de couleurs pour les domaines (du meilleur au moins bon)
const DOMAIN_COLORS = [
  "#10B981", // emerald-500
  "#14B8A6", // teal-500
  "#06B6D4", // cyan-500
  "#0EA5E9", // sky-500
  "#3B82F6", // blue-500
  "#6366F1", // indigo-500
  "#8B5CF6", // violet-500
  "#A855F7", // purple-500
  "#D946EF", // fuchsia-500
  "#EC4899", // pink-500
]

// Tooltip personnalisé pour le graphique en aire
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
  const date = new Date(item.completedAt)

  return (
    <div className="rounded-xl border border-purple-200/50 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm dark:border-purple-800/50 dark:bg-gray-900/95">
      <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
        {item.domain}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {format(date, "d MMMM yyyy", { locale: fr })}
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

// Tooltip personnalisé pour le graphique en barres
const BarChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: {
      domain: string
      averageScore: number
      sessionCount: number
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
        {item.sessionCount} session{item.sessionCount > 1 ? "s" : ""}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${
            item.averageScore >= 60 ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {item.averageScore}%
        </span>
      </div>
    </div>
  )
}

// État vide
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

// Tronquer les noms de domaine trop longs
const truncateDomain = (domain: string, maxLength: number) => {
  if (domain.length <= maxLength) return domain
  return domain.slice(0, maxLength - 1) + "…"
}

export const TrainingScoreChartContent = ({
  sessions,
  domainPerformance,
}: TrainingScoreChartProps) => {
  // État vide
  if (!sessions || sessions.length === 0) {
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

  // Formater les données pour le graphique en aire
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

  // Formater les données pour le graphique en barres
  const barChartData = domainPerformance.map((d, index) => ({
    ...d,
    shortDomain: truncateDomain(d.domain, 18),
    fill: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
  }))

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

      {/* Tabs */}
      <Tabs
        defaultValue="evolution"
        className="[&_*:focus]:outline-none [&_*:focus-visible]:outline-none"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="evolution" className="cursor-pointer gap-1.5">
            <LineChart className="h-4 w-4" />
            Évolution
          </TabsTrigger>
          <TabsTrigger value="domains" className="cursor-pointer gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Par domaine
          </TabsTrigger>
        </TabsList>

        {/* Vue Évolution (graphique en aire) */}
        <TabsContent value="evolution">
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
        </TabsContent>

        {/* Vue Par domaine (graphique en barres horizontales) */}
        <TabsContent value="domains">
          {domainPerformance.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucune donnée par domaine disponible
              </p>
            </div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "currentColor" }}
                      className="text-gray-500 dark:text-gray-400"
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortDomain"
                      width={120}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      className="text-gray-500 dark:text-gray-400"
                    />
                    <Tooltip content={<BarChartTooltip />} cursor={false} />
                    {/* Ligne seuil de réussite à 60% */}
                    <ReferenceLine
                      x={60}
                      stroke="#10B981"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    />
                    <Bar
                      dataKey="averageScore"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={24}
                    >
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Légende */}
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <div className="h-3 w-1.5 rounded-sm bg-emerald-500" />
                    <div className="h-3 w-1.5 rounded-sm bg-blue-500" />
                    <div className="h-3 w-1.5 rounded-sm bg-purple-500" />
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Score moyen par domaine
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 bg-emerald-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Seuil de réussite (60%)
                  </span>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
