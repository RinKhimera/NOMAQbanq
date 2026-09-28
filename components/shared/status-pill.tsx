import { type LucideIcon, ShieldOff } from "lucide-react"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export type StatusTone =
  "success" | "warning" | "danger" | "info" | "accent" | "admin" | "neutral"

const toneClass: Record<StatusTone, string> = {
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accent:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
}

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
      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      toneClass[tone],
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="h-3.5 w-3.5" />}
    {children}
  </span>
)

export const RolePill = ({
  role,
  className,
}: {
  role: string | null | undefined
  className?: string
}) =>
  role === "admin" ? (
    <StatusPill tone="admin" className={className}>
      Administrateur
    </StatusPill>
  ) : (
    <StatusPill tone="neutral" className={className}>
      Utilisateur
    </StatusPill>
  )

export const BannedPill = () => (
  <StatusPill tone="danger" icon={ShieldOff} data-testid="ban-badge">
    Suspendu
  </StatusPill>
)
