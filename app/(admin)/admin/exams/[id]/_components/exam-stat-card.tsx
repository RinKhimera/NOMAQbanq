"use client"

import { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ExamStatCardProps = {
  title: string
  value: string | number
  icon: LucideIcon
  iconClassName?: string
  className?: string
}

export function ExamStatCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  className,
}: ExamStatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={cn(
            "grid size-8 place-items-center rounded-md",
            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
