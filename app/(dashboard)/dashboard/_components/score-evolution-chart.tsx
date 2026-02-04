"use client"

import dynamic from "next/dynamic"
import { TrendingUp } from "lucide-react"
import { motion } from "motion/react"
import { Skeleton } from "@/components/ui/skeleton"

interface ScoreHistoryItem {
  examId: string
  examTitle: string
  score: number
  completedAt: number
}

interface ScoreEvolutionChartProps {
  data: ScoreHistoryItem[]
}

// Lazy-load the heavy recharts component to reduce initial bundle size
const ScoreEvolutionChartContent = dynamic(
  () =>
    import("./score-evolution-chart-content").then((mod) => ({
      default: mod.ScoreEvolutionChartContent,
    })),
  {
    loading: () => (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <Skeleton className="mb-1 h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </motion.div>
    ),
    ssr: false,
  },
)

export const ScoreEvolutionChart = (props: ScoreEvolutionChartProps) => {
  return <ScoreEvolutionChartContent {...props} />
}
