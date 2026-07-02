"use client"

import { CheckCircle2, Clock, Flag, ListChecks } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConfirmationClientProps {
  examTitle: string
  answeredCount: number
  flaggedCount: number
  endDateFormatted: string
  isAutoSubmitted: boolean
}

export function ConfirmationClient({
  examTitle,
  answeredCount,
  flaggedCount,
  endDateFormatted,
  isAutoSubmitted,
}: ConfirmationClientProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-gray-50 via-white to-blue-50/30 px-4 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md space-y-6"
      >
        {/* Icon + title */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-green-500 to-emerald-600 shadow-lg"
          >
            <CheckCircle2 className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Examen soumis
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{examTitle}</p>
          {isAutoSubmitted && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Soumis automatiquement à l&apos;expiration du temps.
            </p>
          )}
        </div>

        {/* Recap card */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Récapitulatif
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <ListChecks className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Questions répondues</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {answeredCount}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Flag className="h-4 w-4 text-amber-500" />
                <span className="text-sm">Questions marquées</span>
              </div>
              <span
                className={cn(
                  "font-semibold",
                  flaggedCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-gray-900 dark:text-white",
                )}
              >
                {flaggedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Results availability */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-900/20">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Résultats disponibles le {endDateFormatted}
            </p>
            <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
              Les résultats seront accessibles à la clôture de l&apos;examen.
            </p>
          </div>
        </div>

        {/* Back to exam list */}
        <Button
          asChild
          size="lg"
          className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <Link href="/tableau-de-bord/examen-blanc">
            Retour à la liste des examens
          </Link>
        </Button>
      </motion.div>
    </div>
  )
}
