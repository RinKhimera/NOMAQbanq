"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconTrendingUp } from "@tabler/icons-react"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

interface RevenueChartProps {
  data: {
    date: string
    revenue: number
  }[]
}

const chartConfig = {
  revenue: {
    label: "Revenus",
    color: "hsl(215, 20%, 45%)",
  },
} satisfies ChartConfig

export function RevenueChart({ data }: RevenueChartProps) {
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100)
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "d MMM", { locale: fr })
    } catch {
      return dateStr
    }
  }

  const hasData = data.some((d) => d.revenue > 0)

  if (!hasData) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">
              Revenus (30 jours)
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Aucune transaction sur cette période
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <IconTrendingUp className="h-5 w-5 text-slate-500" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2 text-4xl">📊</div>
            <p className="text-muted-foreground text-sm">
              Les données apparaîtront ici
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Revenus (30 jours)
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Total: {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <IconTrendingUp className="h-5 w-5 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(215, 20%, 45%)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(215, 20%, 45%)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-gray-200 dark:stroke-gray-800"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatDate(value)}
              interval="preserveStartEnd"
              tick={{ fontSize: 11 }}
              className="text-gray-500"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                value === 0 ? "0" : `${(value / 100).toFixed(0)}$`
              }
              tick={{ fontSize: 11 }}
              className="text-gray-500"
              width={50}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-slate-500" />
                      <span className="text-muted-foreground">Revenus:</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  )}
                  labelFormatter={(label) => {
                    try {
                      return format(parseISO(label), "EEEE d MMMM yyyy", {
                        locale: fr,
                      })
                    } catch {
                      return label
                    }
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(215, 20%, 45%)"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "hsl(215, 20%, 45%)",
                stroke: "white",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
