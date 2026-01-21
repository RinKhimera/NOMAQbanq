"use client"

import { motion } from "motion/react"
import { ProgressRing } from "./progress-ring"
import { Clock, Shield, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccessStatus {
  examAccess: { expiresAt: number; daysRemaining: number } | null
  trainingAccess: { expiresAt: number; daysRemaining: number } | null
}

interface DashboardHeroProps {
  userName?: string
  averageScore: number
  hasCompletedExams: boolean
  accessStatus?: AccessStatus | null
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Bonjour"
  if (hour < 18) return "Bon après-midi"
  return "Bonsoir"
}

const getMotivationalMessage = (score: number, hasExams: boolean) => {
  if (!hasExams) return "Commencez votre préparation pour l'EACMC Part I"
  if (score >= 80) return "Excellent travail ! Continuez sur cette lancée"
  if (score >= 60) return "Bonne progression ! Vous êtes sur la bonne voie"
  if (score >= 40) return "Persévérez, chaque examen vous rapproche du succès"
  return "Chaque erreur est une opportunité d'apprentissage"
}

const AccessBadge = ({
  type,
  daysRemaining,
}: {
  type: "exam" | "training"
  daysRemaining: number | null
}) => {
  const isActive = daysRemaining !== null && daysRemaining > 0
  const isExpiring = daysRemaining !== null && daysRemaining <= 7

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-sm transition-all",
        isActive
          ? isExpiring
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-emerald-500/30 bg-emerald-500/10"
          : "border-gray-500/30 bg-gray-500/10"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          isActive
            ? isExpiring
              ? "bg-amber-500/20"
              : "bg-emerald-500/20"
            : "bg-gray-500/20"
        )}
      >
        {type === "exam" ? (
          <Shield
            className={cn(
              "h-4 w-4",
              isActive
                ? isExpiring
                  ? "text-amber-500"
                  : "text-emerald-500"
                : "text-gray-500"
            )}
          />
        ) : (
          <Sparkles
            className={cn(
              "h-4 w-4",
              isActive
                ? isExpiring
                  ? "text-amber-500"
                  : "text-emerald-500"
                : "text-gray-500"
            )}
          />
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {type === "exam" ? "Examens" : "Entraînement"}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            isActive
              ? isExpiring
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
              : "text-gray-600 dark:text-gray-400"
          )}
        >
          {isActive ? (
            <>
              <Clock className="mr-1 inline h-3 w-3" />
              {daysRemaining}j restants
            </>
          ) : (
            "Non actif"
          )}
        </span>
      </div>
    </motion.div>
  )
}

export const DashboardHero = ({
  userName,
  averageScore,
  hasCompletedExams,
  accessStatus,
}: DashboardHeroProps) => {
  const greeting = getGreeting()
  const firstName = userName?.split(" ")[0] || "Étudiant"

  return (
    <div className="relative overflow-hidden rounded-3xl">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/50 dark:via-gray-900 dark:to-indigo-950/50" />

      {/* Decorative elements */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
          {/* Left - Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-2 text-center lg:text-left"
          >
            <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white lg:text-4xl">
              {greeting},{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {firstName}
              </span>
            </h1>
            <p className="max-w-md text-gray-600 dark:text-gray-400">
              {getMotivationalMessage(averageScore, hasCompletedExams)}
            </p>

            {/* Pulse indicator */}
            <div className="mt-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Système actif - Données en temps réel
              </span>
            </div>
          </motion.div>

          {/* Center - Score Ring */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center"
          >
            <ProgressRing
              value={hasCompletedExams ? averageScore : 0}
              size={180}
              strokeWidth={14}
            />
          </motion.div>

          {/* Right - Access Status */}
          <div className="flex flex-col gap-3">
            <AccessBadge
              type="exam"
              daysRemaining={accessStatus?.examAccess?.daysRemaining ?? null}
            />
            <AccessBadge
              type="training"
              daysRemaining={accessStatus?.trainingAccess?.daysRemaining ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
