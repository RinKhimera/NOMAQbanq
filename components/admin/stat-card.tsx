import { IconTrendingUp } from "@tabler/icons-react"
import { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string | number
  growth: string
  footerLabel: string
  footerDescription: string
  icon: ReactNode
  variant?: "default" | "primary"
}

export const StatCard = ({
  title,
  value,
  growth,
  footerLabel,
  footerDescription,
  icon,
  variant = "default",
}: StatCardProps) => {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription
          className={
            variant === "primary" ? "text-foreground font-semibold" : ""
          }
        >
          {title}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant={variant === "primary" ? "badge" : "outline"}>
            <IconTrendingUp />
            {growth}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div
          className={`line-clamp-1 flex gap-2 font-medium ${
            variant === "primary" ? "text-blue-700 dark:text-blue-400" : ""
          }`}
        >
          {footerLabel} {icon}
        </div>
        <div className="text-muted-foreground">{footerDescription}</div>
      </CardFooter>
    </Card>
  )
}
