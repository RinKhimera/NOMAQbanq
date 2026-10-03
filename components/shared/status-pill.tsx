import { type LucideIcon, ShieldOff } from "lucide-react"
import type { ComponentProps } from "react"
import { TONE_SOFT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

export type StatusTone = Tone

type StatusPillProps = ComponentProps<"span"> & {
  tone: StatusTone
  icon?: LucideIcon
}

export const StatusPill = ({
  tone,
  icon: Icon,
  className,
  children,
  ...props
}: StatusPillProps) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-0.5 text-xs font-medium",
      TONE_SOFT[tone],
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="size-3.5" aria-hidden="true" />}
    {children}
  </span>
)

export const BannedPill = () => (
  <StatusPill tone="danger" icon={ShieldOff} data-testid="ban-badge">
    Suspendu
  </StatusPill>
)
