"use client"

import { motion } from "motion/react"
import Link from "next/link"
import {
  Play,
  BookOpen,
  Target,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Exam {
  _id: string
  title: string
  questionIds: string[]
  completionTime: number
}

interface NextActionsPanelProps {
  completedExamsCount: number
  averageScore: number
  availableExams: Exam[]
  learningBankCount: number
}

interface ActionItem {
  id: string
  title: string
  description: string
  icon: typeof Play
  href: string
  priority: "high" | "medium" | "low"
  color: "blue" | "emerald" | "amber" | "purple"
}

const priorityStyles = {
  high: "border-l-4 border-l-blue-500",
  medium: "border-l-4 border-l-emerald-500",
  low: "border-l-4 border-l-gray-300 dark:border-l-gray-600",
}

const colorStyles = {
  blue: {
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-500",
    button: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  emerald: {
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-500",
    button: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
  amber: {
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-500",
    button: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  purple: {
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-500",
    button: "bg-purple-500 hover:bg-purple-600 text-white",
  },
}

const getActions = ({
  completedExamsCount,
  averageScore,
  availableExams,
  learningBankCount,
}: NextActionsPanelProps): ActionItem[] => {
  const actions: ActionItem[] = []

  // Priority 1: First exam if never completed any
  if (completedExamsCount === 0 && availableExams.length > 0) {
    actions.push({
      id: "first-exam",
      title: "Passez votre premier examen",
      description:
        "Évaluez vos connaissances avec un examen blanc complet",
      icon: Play,
      href: "/dashboard/mock-exam",
      priority: "high",
      color: "blue",
    })
  }

  // Priority 2: Available exams to take
  if (completedExamsCount > 0 && availableExams.length > 0) {
    actions.push({
      id: "take-exam",
      title: `${availableExams.length} examen${availableExams.length > 1 ? "s" : ""} disponible${availableExams.length > 1 ? "s" : ""}`,
      description: "Continuez votre préparation avec un nouvel examen",
      icon: Target,
      href: "/dashboard/mock-exam",
      priority: "high",
      color: "blue",
    })
  }

  // Priority 3: Review if score is low
  if (completedExamsCount > 0 && averageScore < 60) {
    actions.push({
      id: "review",
      title: "Révisez les domaines faibles",
      description: "Améliorez votre score en ciblant vos lacunes",
      icon: TrendingUp,
      href: "/dashboard/learning",
      priority: "high",
      color: "amber",
    })
  }

  // Priority 4: Learning bank practice
  if (learningBankCount > 0) {
    actions.push({
      id: "learning",
      title: "Continuez l'entraînement",
      description: `${learningBankCount} questions disponibles dans la banque`,
      icon: BookOpen,
      href: "/dashboard/learning",
      priority: completedExamsCount === 0 ? "medium" : "medium",
      color: "emerald",
    })
  }

  // Priority 5: Keep going if doing well
  if (completedExamsCount > 0 && averageScore >= 60) {
    actions.push({
      id: "keep-going",
      title: "Maintenez votre niveau",
      description: "Excellent travail ! Continuez à vous entraîner",
      icon: Sparkles,
      href: "/dashboard/learning",
      priority: "medium",
      color: "purple",
    })
  }

  return actions.slice(0, 3)
}

export const NextActionsPanel = (props: NextActionsPanelProps) => {
  const actions = getActions(props)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
          <Target className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Prochaines actions
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actions recommandées pour vous
          </p>
        </div>
      </div>

      {/* Actions list */}
      <div className="space-y-3">
        {actions.map((action, index) => {
          const colors = colorStyles[action.color]

          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
            >
              <Link href={action.href}>
                <div
                  className={cn(
                    "group flex items-center justify-between rounded-xl border border-gray-200/50 bg-white/80 p-4 backdrop-blur-sm transition-all duration-300",
                    "hover:border-gray-300 hover:shadow-md dark:border-gray-700/50 dark:bg-gray-900/80 dark:hover:border-gray-600",
                    priorityStyles[action.priority]
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                        colors.iconBg
                      )}
                    >
                      <action.icon className={cn("h-6 w-6", colors.iconColor)} />
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {action.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {action.description}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className={cn(
                      "opacity-0 transition-all duration-300 group-hover:opacity-100",
                      colors.button
                    )}
                  >
                    <span className="mr-1">Commencer</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </Link>
            </motion.div>
          )
        })}

        {actions.length === 0 && (
          <div className="rounded-xl border border-gray-200/50 bg-white/80 p-6 text-center backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              Aucune action prioritaire pour le moment
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
