import { StatusPill } from "@/components/shared/status-pill"
import { EXAM_STATUS_CONFIG, ExamStatus } from "@/lib/exam-status"

export default function ExamStatusBadge({
  status,
  className,
}: {
  status: ExamStatus
  className?: string
}) {
  const { label, tone, icon } = EXAM_STATUS_CONFIG[status]
  return (
    <StatusPill tone={tone} icon={icon} className={className}>
      {label}
    </StatusPill>
  )
}
