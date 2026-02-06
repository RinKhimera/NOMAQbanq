"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Brain, GraduationCap, User, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const quickActions = [
  {
    title: "Entraînement",
    description: "Pratiquez avec des sessions personnalisées de 5 à 20 questions",
    href: "/dashboard/entrainement",
    icon: Brain,
    gradient: "from-emerald-500 to-teal-600",
    bgGlow: "bg-emerald-500/20",
    iconBg: "bg-emerald-500/10",
    hoverBorder: "hover:border-emerald-500/30",
  },
  {
    title: "Examens blancs",
    description: "Testez vos connaissances en conditions réelles",
    href: "/dashboard/examen-blanc",
    icon: GraduationCap,
    gradient: "from-purple-500 to-purple-600",
    bgGlow: "bg-purple-500/20",
    iconBg: "bg-purple-500/10",
    hoverBorder: "hover:border-purple-500/30",
  },
  {
    title: "Mon profil",
    description: "Gérez vos informations personnelles",
    href: "/dashboard/profil",
    icon: User,
    gradient: "from-slate-500 to-slate-600",
    bgGlow: "bg-slate-500/20",
    iconBg: "bg-slate-500/10",
    hoverBorder: "hover:border-slate-500/30",
  },
]

export const QuickAccessGrid = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="space-y-4"
    >
      {/* Header */}
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Accès rapides
      </h3>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 20, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.7 + index * 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="perspective-1000"
          >
            <Link href={action.href}>
              <div
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-6 backdrop-blur-sm transition-all duration-500",
                  "dark:border-gray-700/50 dark:bg-gray-900/80",
                  action.hoverBorder,
                  "hover:-translate-y-2 hover:shadow-xl"
                )}
                style={{
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Glow effect on hover */}
                <div
                  className={cn(
                    "absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
                    action.bgGlow
                  )}
                />

                {/* Icon */}
                <div
                  className={cn(
                    "mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110",
                    action.iconBg
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br",
                      action.gradient
                    )}
                  >
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                </div>

                {/* Content */}
                <h4 className="mb-2 font-display text-lg font-semibold text-gray-900 dark:text-white">
                  {action.title}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {action.description}
                </p>

                {/* Arrow */}
                <div className="mt-4 flex items-center text-sm font-medium text-gray-400 transition-all duration-300 group-hover:translate-x-2 group-hover:text-gray-900 dark:group-hover:text-white">
                  <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    Accéder
                  </span>
                  <ChevronRight className="ml-1 h-4 w-4" />
                </div>

                {/* Bottom gradient line */}
                <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full w-0 bg-linear-to-r transition-all duration-500 group-hover:w-full",
                      action.gradient
                    )}
                  />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
