"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { IconTrendingUp } from "@tabler/icons-react"
import { Skeleton } from "@/components/ui/skeleton"

interface RevenueChartProps {
  data: {
    CAD: { date: string; revenue: number }[]
    XAF: { date: string; revenue: number }[]
  }
}

// Lazy-load the heavy recharts component to reduce initial bundle size
const RevenueChartContent = dynamic(
  () =>
    import("./revenue-chart-content").then((mod) => ({
      default: mod.RevenueChartContent,
    })),
  {
    loading: () => (
      <Card className="flex h-full flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <IconTrendingUp className="h-5 w-5 text-slate-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4">
          <Skeleton className="h-70 w-full" />
        </CardContent>
      </Card>
    ),
    ssr: false,
  },
)

export function RevenueChart(props: RevenueChartProps) {
  return <RevenueChartContent {...props} />
}
