"use client"

import { ArrowLeft, CheckCircle, Clock, Trophy, User } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ExamParticipantUser } from "@/features/exams/dal"
import { getInitials } from "@/lib/utils"

interface ParticipantResultsErrorProps {
  error: "NO_PARTICIPATION" | "NOT_COMPLETED"
  message: string
  status?: string
  examTitle: string
  examId: string
  participantUser: ExamParticipantUser
}

/**
 * État admin-only quand le participant n'a pas (encore) de résultats consultables :
 * aucune participation, ou examen non terminé. Affiché par la page de résultats
 * admin lorsque `getParticipantExamResults` renvoie une union d'erreur.
 */
export function ParticipantResultsError({
  error,
  message,
  status,
  examTitle,
  examId,
  participantUser,
}: ParticipantResultsErrorProps) {
  const initials = getInitials(participantUser?.name)

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 shadow-lg"
              >
                <Clock className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Résultats non disponibles
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {examTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link
                  href={`/admin/exams/${examId}`}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Retour au classement</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Participant Info Card */}
          {participantUser && (
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-800">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={participantUser.image || undefined}
                  alt={participantUser.name || "Avatar"}
                />
                <AvatarFallback className="bg-blue-100 text-xl text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {participantUser.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {participantUser.username
                    ? `@${participantUser.username} · `
                    : ""}
                  {participantUser.email}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                Participant
              </Badge>
            </div>
          )}

          {/* Error Message Card */}
          <div className="rounded-2xl border border-amber-200/80 bg-linear-to-br from-amber-50 to-orange-50 p-8 shadow-lg dark:border-amber-700/50 dark:from-amber-900/20 dark:to-orange-900/20">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                {error === "NO_PARTICIPATION" ? (
                  <User className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
                  {error === "NO_PARTICIPATION"
                    ? "Aucune participation"
                    : "Examen en cours"}
                </h3>
                <p className="text-amber-800 dark:text-amber-200">{message}</p>
                {error === "NOT_COMPLETED" && status && (
                  <div className="mt-4">
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                    >
                      Statut: {status}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-800">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Que faire ?
            </h3>
            <ul className="space-y-3 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Retournez au classement pour voir les autres participants
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Les résultats seront disponibles une fois que le participant
                  aura terminé l&apos;examen
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Vérifiez la liste des participants pour voir qui a déjà
                  complété l&apos;examen
                </span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
