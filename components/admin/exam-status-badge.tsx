import { EXAM_STATUS_CONFIG, ExamStatus } from "@/lib/exam-status"
import { cn } from "@/lib/utils"
import { Badge } from "../ui/badge"

export default function ExamStatusBadge({
  status,
  className,
}: {
  status: ExamStatus
  className?: string
}) {
  const config = EXAM_STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}
