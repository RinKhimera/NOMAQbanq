import { type LucideIcon } from "lucide-react"
import { type ReactNode } from "react"

type ColorScheme =
  | "amber"
  | "blue"
  | "indigo"
  | "cyan"
  | "teal"
  | "rose"
  | "violet"
  | "emerald"
  | "gray"
  | "green"
  | "purple"
  | "orange"
  | "red"
  | "yellow"

interface LegalSectionProps {
  icon: LucideIcon
  title: string
  children: ReactNode
  colorScheme?: ColorScheme
  number?: number
}

const colorVariants: Record<
  ColorScheme,
  {
    border: string
    background: string
    iconBg: string
  }
> = {
  amber: {
    border: "border-amber-100 dark:border-amber-900/30",
    background:
      "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
    iconBg: "bg-amber-500",
  },
  blue: {
    border: "border-blue-100 dark:border-blue-900/30",
    background:
      "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    iconBg: "bg-blue-500",
  },
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/30",
    background:
      "bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30",
    iconBg: "bg-indigo-500",
  },
  cyan: {
    border: "border-cyan-100 dark:border-cyan-900/30",
    background:
      "bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30",
    iconBg: "bg-cyan-500",
  },
  teal: {
    border: "border-teal-100 dark:border-teal-900/30",
    background:
      "bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30",
    iconBg: "bg-teal-500",
  },
  rose: {
    border: "border-rose-100 dark:border-rose-900/30",
    background:
      "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30",
    iconBg: "bg-rose-500",
  },
  violet: {
    border: "border-violet-100 dark:border-violet-900/30",
    background:
      "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
    iconBg: "bg-violet-500",
  },
  emerald: {
    border: "border-emerald-100 dark:border-emerald-900/30",
    background:
      "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
    iconBg: "bg-emerald-500",
  },
  gray: {
    border: "border-gray-100 dark:border-gray-800/30",
    background:
      "bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950/30 dark:to-blue-950/30",
    iconBg: "bg-gray-500",
  },
  green: {
    border: "border-green-100 dark:border-green-900/30",
    background:
      "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30",
    iconBg: "bg-green-500",
  },
  purple: {
    border: "border-purple-100 dark:border-purple-900/30",
    background:
      "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30",
    iconBg: "bg-purple-500",
  },
  orange: {
    border: "border-orange-100 dark:border-orange-900/30",
    background:
      "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30",
    iconBg: "bg-orange-500",
  },
  red: {
    border: "border-red-100 dark:border-red-900/30",
    background:
      "bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30",
    iconBg: "bg-red-500",
  },
  yellow: {
    border: "border-yellow-100 dark:border-yellow-900/30",
    background:
      "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30",
    iconBg: "bg-yellow-500",
  },
}

export function LegalSection({
  icon: Icon,
  title,
  children,
  colorScheme = "blue",
  number,
}: LegalSectionProps) {
  const colors = colorVariants[colorScheme]

  return (
    <section
      className={`rounded-2xl border p-6 ${colors.border} ${colors.background}`}
    >
      <div className="flex items-start gap-4">
        <div className={`rounded-full p-3 text-white ${colors.iconBg}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
            {number && `${number}. `}
            {title}
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}
