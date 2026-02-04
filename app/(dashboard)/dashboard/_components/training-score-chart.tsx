"use client"

import dynamic from "next/dynamic"
import { Brain } from "lucide-react"
import { motion } from "motion/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
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

// Lazy-load the heavy recharts component to reduce initial bundle size
const TrainingScoreChartContent = dynamic(
  () =>
    import("./training-score-chart-content").then((mod) => ({
      default: mod.TrainingScoreChartContent,
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-1" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-3">
            <TabsTrigger value="trend">Tendance</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="domains">Domaines</TabsTrigger>
          </TabsList>
          <TabsContent value="trend">
            <Skeleton className="h-64 w-full" />
          </TabsContent>
        </Tabs>
      </motion.div>
    ),
    ssr: false,
  },
)

export const TrainingScoreChart = (props: TrainingScoreChartProps) => {
  return <TrainingScoreChartContent {...props} />
}
