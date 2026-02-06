"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts"
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

interface RevenueChartContentProps {
  data: {
    CAD: { date: string; revenue: number }[]
    XAF: { date: string; revenue: number }[]
  }
}

const chartConfig = {
  revenueCAD: {
    label: "CAD",
    color: "hsl(215, 20%, 45%)",
  },
  revenueXAF: {
    label: "XAF",
    color: "hsl(168, 76%, 36%)",
  },
} satisfies ChartConfig

export function RevenueChartContent({ data }: RevenueChartContentProps) {
  const totalCAD = data.CAD.reduce((sum, d) => sum + d.revenue, 0)
  const totalXAF = data.XAF.reduce((sum, d) => sum + d.revenue, 0)
  const hasXAFData = totalXAF > 0

  const formatCAD = (value: number) => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100)
  }

  const formatXAF = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100) + " XAF"
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "d MMM", { locale: fr })
    } catch {
      return dateStr
    }
  }

  // Fusionner les données CAD et XAF par date
  const mergedData = data.CAD.map((cadItem, index) => ({
    date: cadItem.date,
    revenueCAD: cadItem.revenue,
    revenueXAF: data.XAF[index]?.revenue ?? 0,
  }))

  const hasData = totalCAD > 0 || totalXAF > 0

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
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>CAD: {formatCAD(totalCAD)}</span>
            {hasXAFData && <span>XAF: {formatXAF(totalXAF)}</span>}
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <IconTrendingUp className="h-5 w-5 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer config={chartConfig} className="h-70 w-full">
          <AreaChart
            data={mergedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cadGradient" x1="0" y1="0" x2="0" y2="1">
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
              <linearGradient id="xafGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(168, 76%, 36%)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(168, 76%, 36%)"
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
              yAxisId="cad"
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
            {hasXAFData && (
              <YAxis
                yAxisId="xaf"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) =>
                  value === 0 ? "0" : `${(value / 100).toFixed(0)}`
                }
                tick={{ fontSize: 11 }}
                className="text-gray-500"
                width={50}
              />
            )}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const isXAF = name === "revenueXAF"
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: isXAF
                              ? "hsl(168, 76%, 36%)"
                              : "hsl(215, 20%, 45%)",
                          }}
                        />
                        <span className="text-muted-foreground">
                          {isXAF ? "XAF:" : "CAD:"}
                        </span>
                        <span className="font-mono font-semibold">
                          {isXAF
                            ? formatXAF(value as number)
                            : formatCAD(value as number)}
                        </span>
                      </div>
                    )
                  }}
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
            {hasXAFData && (
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (value === "revenueCAD" ? "CAD" : "XAF")}
              />
            )}
            <Area
              yAxisId="cad"
              type="monotone"
              dataKey="revenueCAD"
              stroke="hsl(215, 20%, 45%)"
              strokeWidth={2}
              fill="url(#cadGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "hsl(215, 20%, 45%)",
                stroke: "white",
                strokeWidth: 2,
              }}
            />
            {hasXAFData && (
              <Area
                yAxisId="xaf"
                type="monotone"
                dataKey="revenueXAF"
                stroke="hsl(168, 76%, 36%)"
                strokeWidth={2}
                fill="url(#xafGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "hsl(168, 76%, 36%)",
                  stroke: "white",
                  strokeWidth: 2,
                }}
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
