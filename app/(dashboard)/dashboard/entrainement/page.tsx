"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { motion } from "motion/react"
import { Brain, Sparkles } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { TrainingConfigForm } from "./_components/training-config-form"
import { ResumeSessionCard } from "./_components/resume-session-card"
import { TrainingHistorySection } from "./_components/training-history-section"
import { TrainingPaywall } from "./_components/training-paywall"

export default function EntrainementPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // Skip queries until authenticated to avoid race condition on page reload
  const hasAccess = useQuery(
    api.payments.hasTrainingAccess,
    isAuthenticated ? undefined : "skip"
  )
  const activeSession = useQuery(
    api.training.getActiveTrainingSession,
    isAuthenticated ? undefined : "skip"
  )
  const domains = useQuery(api.training.getAvailableDomains)
  const objectifs = useQuery(api.training.getAvailableObjectifsCMC, {})
  const stats = useQuery(
    api.training.getTrainingStats,
    isAuthenticated ? undefined : "skip"
  )

  // Loading state (auth loading or data loading)
  if (isAuthLoading || hasAccess === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  // Paywall for users without access
  if (hasAccess === false) {
    return <TrainingPaywall />
  }

  return (
    <div className="min-h-screen">
      {/* Background gradient mesh */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-150 w-150 rounded-full bg-linear-to-br from-emerald-100/40 to-teal-100/40 blur-3xl dark:from-emerald-900/20 dark:to-teal-900/20" />
        <div className="absolute -bottom-1/4 -right-1/4 h-125 w-125 rounded-full bg-linear-to-br from-cyan-100/30 to-emerald-100/30 blur-3xl dark:from-cyan-900/15 dark:to-emerald-900/15" />
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 shadow-md"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-900" />
              </motion.div>
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
                Entraînement
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Pratiquez avec des sessions personnalisées de 5 à 20 questions
              </p>
            </div>
          </div>

          {/* Stats summary */}
          {stats && stats.totalSessions > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mt-6 flex flex-wrap gap-6"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.totalSessions}
                  </span>{" "}
                  sessions complétées
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-teal-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Score moyen :{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.averageScore}%
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyan-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.totalQuestions}
                  </span>{" "}
                  questions pratiquées
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Main content grid */}
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left column - Config + History */}
          <div className="space-y-8">
            {/* Resume session card (if active) */}
            {activeSession?.canResume && activeSession.session && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <ResumeSessionCard
                  session={activeSession.session}
                  remainingTimeMs={activeSession.remainingTimeMs}
                />
              </motion.div>
            )}

            {/* New session config */}
            {!activeSession?.canResume && domains && objectifs && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <TrainingConfigForm
                  domains={domains.domains}
                  totalQuestions={domains.totalQuestions}
                  objectifs={objectifs.objectifs}
                />
              </motion.div>
            )}

            {/* History section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <TrainingHistorySection />
            </motion.div>
          </div>

          {/* Right column - Quick stats / Tips */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="hidden lg:block"
          >
            <div className="sticky top-24 space-y-6">
              {/* Tips card */}
              <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/70">
                <h3 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-white">
                  Conseils pour réussir
                </h3>
                <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>
                      Commencez par des sessions courtes (5-10 questions) pour
                      vous échauffer
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>
                      Utilisez les marqueurs pour identifier les questions à
                      réviser
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>
                      Lisez attentivement les explications après chaque session
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>
                      Ciblez vos domaines faibles pour améliorer votre score
                      global
                    </span>
                  </li>
                </ul>
              </div>

              {/* Available questions info */}
              {domains && (
                <div className="overflow-hidden rounded-2xl border border-emerald-200/60 bg-linear-to-br from-emerald-50 to-teal-50 p-6 dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-teal-950/40">
                  <div className="mb-3 text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                    {domains.totalQuestions.toLocaleString()}
                  </div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    questions disponibles
                  </p>
                  <p className="mt-1 text-xs text-emerald-600/70 dark:text-emerald-400/70">
                    dans {domains.domains.length} domaines différents
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
