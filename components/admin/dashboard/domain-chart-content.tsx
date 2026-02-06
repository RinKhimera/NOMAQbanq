"use client"

import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconBooks } from "@tabler/icons-react"

interface DomainChartContentProps {
  data: {
    domain: string
    count: number
  }[]
  totalQuestions: number
}

const chartConfig = {
  count: {
    label: "Questions",
    color: "hsl(215, 20%, 45%)",
  },
} satisfies ChartConfig

// Palette de couleurs harmonieuse
const COLORS = [
  "hsl(215, 60%, 50%)",
  "hsl(215, 55%, 55%)",
  "hsl(215, 50%, 60%)",
  "hsl(215, 45%, 65%)",
  "hsl(215, 40%, 70%)",
  "hsl(220, 35%, 72%)",
  "hsl(225, 30%, 74%)",
  "hsl(230, 25%, 76%)",
  "hsl(235, 20%, 78%)",
  "hsl(240, 15%, 80%)",
]

export function DomainChartContent({
  data,
  totalQuestions,
}: DomainChartContentProps) {
  // Tronquer les noms de domaines trop longs
  const truncateDomain = (domain: string, maxLength: number = 20) => {
    if (domain.length <= maxLength) return domain
    return domain.substring(0, maxLength - 1) + "…"
  }

  // Early return si pas de données
  if (data.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">
              Répartition par domaine
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Aucune question disponible
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <IconBooks className="h-5 w-5 text-slate-500" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2 text-4xl">📚</div>
            <p className="text-muted-foreground text-sm">
              Ajoutez des questions pour voir la répartition
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prendre les 10 premiers domaines triés par count
  const topDomains = [...data].sort((a, b) => b.count - a.count).slice(0, 10)

  const chartData = topDomains.map((d, index) => ({
    ...d,
    shortDomain: truncateDomain(d.domain, 18),
    fill: COLORS[index % COLORS.length],
  }))

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Répartition par domaine
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {totalQuestions.toLocaleString("fr-CA")} questions au total
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <IconBooks className="h-5 w-5 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              type="category"
              dataKey="shortDomain"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              width={140}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => (
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground font-medium">
                        {props.payload.domain}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: props.payload.fill }}
                        />
                        <span className="text-muted-foreground">Questions:</span>
                        <span className="font-mono font-semibold">
                          {(value as number).toLocaleString("fr-CA")}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {((value as number / totalQuestions) * 100).toFixed(1)}%
                        du total
                      </span>
                    </div>
                  )}
                  hideLabel
                />
              }
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
