"use client"

import { IconBell, IconMoon, IconSettings, IconSun } from "@tabler/icons-react"
import { Monitor } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// useSyncExternalStore pour détecter le montage côté client sans setState dans useEffect
const emptySubscribe = () => () => {}

const PreferenceItem = ({
  icon: Icon,
  iconColorClass,
  iconBgClass,
  label,
  description,
  children,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColorClass: string
  iconBgClass: string
  label: string
  description: string
  children: React.ReactNode
  disabled?: boolean
}) => {
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl p-4 transition-colors",
        disabled && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          iconBgClass,
        )}
      >
        <Icon className={cn("h-5 w-5", iconColorClass)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {disabled && (
            <Badge
              variant="secondary"
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800"
            >
              Bientôt
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const ThemeOption = ({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  selected: boolean
  onClick: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-16 flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all",
        selected
          ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/30"
          : "border-transparent bg-gray-50 hover:border-gray-200 dark:bg-gray-800/50 dark:hover:border-gray-700",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5",
          selected
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-600 dark:text-gray-400",
        )}
      />
      <span
        className={cn(
          "text-xs",
          selected
            ? "font-medium text-amber-600 dark:text-amber-400"
            : "text-gray-600 dark:text-gray-400",
        )}
      >
        {label}
      </span>
    </button>
  )
}

export const ProfilePreferences = () => {
  const prefersReducedMotion = useReducedMotion()
  const { theme, setTheme } = useTheme()

  // Detect client-side mounting to avoid hydration mismatch
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] as const },
      }

  // Current theme (default to "system" if not mounted yet)
  const currentTheme = mounted ? theme : "system"

  return (
    <motion.div {...motionProps}>
      <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
        <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 shadow-lg shadow-gray-500/20">
              <IconSettings className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-semibold text-gray-900 dark:text-white">
              Préférences
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="divide-y divide-gray-100 p-0 dark:divide-gray-800">
          {/* Email notifications - disabled */}
          <PreferenceItem
            icon={IconBell}
            iconColorClass="text-rose-600 dark:text-rose-400"
            iconBgClass="bg-rose-100 dark:bg-rose-900/30"
            label="Notifications par email"
            description="Recevez des rappels et mises à jour par email"
            disabled
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch disabled checked={false} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bientôt disponible</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </PreferenceItem>

          {/* Theme preference - working */}
          <PreferenceItem
            icon={IconSun}
            iconColorClass="text-amber-600 dark:text-amber-400"
            iconBgClass="bg-amber-100 dark:bg-amber-900/30"
            label="Thème de l'interface"
            description="Choisissez l'apparence de l'application"
          >
            <div className="flex gap-2">
              <ThemeOption
                icon={IconSun}
                label="Clair"
                selected={currentTheme === "light"}
                onClick={() => setTheme("light")}
              />
              <ThemeOption
                icon={IconMoon}
                label="Sombre"
                selected={currentTheme === "dark"}
                onClick={() => setTheme("dark")}
              />
              <ThemeOption
                icon={Monitor}
                label="Auto"
                selected={currentTheme === "system"}
                onClick={() => setTheme("system")}
              />
            </div>
          </PreferenceItem>
        </CardContent>
      </Card>
    </motion.div>
  )
}
