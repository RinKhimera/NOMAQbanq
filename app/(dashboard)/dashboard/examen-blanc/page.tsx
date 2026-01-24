"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Hourglass,
  PlayCircle,
  Trophy,
} from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

// Loading skeleton component
const ExamPageSkeleton = () => (
  <div className="min-h-screen">
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-10 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="mb-8 flex gap-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
)

// Exam card component
interface ExamCardProps {
  exam: {
    _id: Id<"exams">
    title: string
    description?: string
    startDate: number
    endDate: number
    questionIds: string[]
    completionTime: number
    userHasTaken: boolean
    userParticipation?: {
      score: number
      completedAt: number
    } | null
  }
  variant: "active" | "upcoming" | "past"
  isEligible: boolean
  onStart: (examId: Id<"exams">) => void
  onViewResults: (examId: Id<"exams">) => void
  index: number
}

const ExamCard = ({
  exam,
  variant,
  isEligible,
  onStart,
  onViewResults,
  index,
}: ExamCardProps) => {
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "PPP 'à' HH:mm", { locale: fr })
  }

  const formatDateShort = (timestamp: number) => {
    return format(new Date(timestamp), "dd MMM yyyy", { locale: fr })
  }

  const variantStyles = {
    active: {
      gradient: "from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/30",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
      hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700",
      iconBg: "bg-emerald-500",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
      badgeText: "text-emerald-700 dark:text-emerald-300",
      badgeBorder: "border-emerald-200 dark:border-emerald-700",
      infoBg: "bg-white/60 dark:bg-gray-800/60",
      titleHover: "group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
    },
    upcoming: {
      gradient: "from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/30",
      border: "border-blue-200/60 dark:border-blue-800/40",
      hoverBorder: "hover:border-blue-300 dark:hover:border-blue-700",
      iconBg: "bg-blue-500",
      iconColor: "text-blue-600 dark:text-blue-400",
      badgeBg: "bg-blue-100 dark:bg-blue-900/50",
      badgeText: "text-blue-700 dark:text-blue-300",
      badgeBorder: "border-blue-200 dark:border-blue-700",
      infoBg: "bg-white/60 dark:bg-gray-800/60",
      titleHover: "group-hover:text-blue-700 dark:group-hover:text-blue-400",
    },
    past: {
      gradient: "from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/40 dark:via-gray-950/30 dark:to-zinc-950/30",
      border: "border-gray-200/60 dark:border-gray-700/40",
      hoverBorder: "hover:border-gray-300 dark:hover:border-gray-600",
      iconBg: "bg-gray-500",
      iconColor: "text-gray-500 dark:text-gray-400",
      badgeBg: "bg-gray-100 dark:bg-gray-800/50",
      badgeText: "text-gray-600 dark:text-gray-400",
      badgeBorder: "border-gray-200 dark:border-gray-600",
      infoBg: "bg-white/50 dark:bg-gray-800/50",
      titleHover: "group-hover:text-gray-700 dark:group-hover:text-gray-300",
    },
  }

  const styles = variantStyles[variant]
  const userTaken = exam.userHasTaken
  const userResult = exam.userParticipation

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.1 + index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div
        className={cn(
          "group relative h-full overflow-hidden rounded-2xl border bg-gradient-to-br p-6 shadow-sm backdrop-blur-sm transition-all duration-300",
          styles.gradient,
          styles.border,
          styles.hoverBorder,
          "hover:-translate-y-1 hover:shadow-lg"
        )}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3
            className={cn(
              "font-display text-lg font-bold text-gray-900 transition-colors dark:text-white",
              styles.titleHover
            )}
          >
            {exam.title}
          </h3>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-xs font-medium",
              styles.badgeBg,
              styles.badgeText,
              styles.badgeBorder
            )}
          >
            {variant === "active" && (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Ouvert
              </>
            )}
            {variant === "upcoming" && (
              <>
                <Hourglass className="mr-1 h-3 w-3" />
                Bientôt
              </>
            )}
            {variant === "past" && "Terminé"}
          </Badge>
        </div>

        {/* Description */}
        {exam.description && (
          <p className="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {exam.description}
          </p>
        )}

        {/* Info items */}
        <div className="mb-6 space-y-2">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg p-2.5",
              styles.infoBg
            )}
          >
            <CalendarDays className={cn("h-4 w-4", styles.iconColor)} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {variant === "active" && `Jusqu'au ${formatDate(exam.endDate)}`}
              {variant === "upcoming" &&
                `Ouverture le ${formatDate(exam.startDate)}`}
              {variant === "past" && `Terminé le ${formatDate(exam.endDate)}`}
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg p-2.5",
              styles.infoBg
            )}
          >
            <Clock className={cn("h-4 w-4", styles.iconColor)} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {exam.questionIds.length} questions •{" "}
              {Math.floor(exam.completionTime / 60)} min
            </span>
          </div>
        </div>

        {/* Score for past exams */}
        {variant === "past" && userResult && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-800/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Votre score
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {userResult.score}%
                </p>
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  userResult.score >= 60
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "bg-amber-100 dark:bg-amber-900/30"
                )}
              >
                {userResult.score >= 60 ? (
                  <Trophy className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Passé le {formatDate(userResult.completedAt)}
            </p>
          </div>
        )}

        {/* Action button */}
        <div className="mt-auto">
          {variant === "active" && (
            <>
              {userTaken ? (
                <Button
                  disabled
                  className="w-full cursor-not-allowed bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Déjà passé
                </Button>
              ) : !isEligible ? (
                <div className="space-y-2">
                  <Button
                    disabled
                    className="w-full cursor-not-allowed bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    Non éligible
                  </Button>
                  <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                    Vous n&apos;êtes pas autorisé à passer cet examen
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => onStart(exam._id)}
                  className="w-full cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md transition-all duration-200 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Commencer l&apos;examen
                </Button>
              )}
            </>
          )}

          {variant === "upcoming" && (
            <Button
              disabled
              className="w-full cursor-not-allowed bg-blue-100 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Disponible le {formatDateShort(exam.startDate)}
            </Button>
          )}

          {variant === "past" && (
            <>
              {userTaken ? (
                <Button
                  onClick={() => onViewResults(exam._id)}
                  variant="outline"
                  className="w-full cursor-pointer"
                >
                  Consulter les résultats
                </Button>
              ) : (
                <Button
                  disabled
                  variant="outline"
                  className="w-full cursor-not-allowed"
                >
                  Examen fermé
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Section header component
interface SectionHeaderProps {
  title: string
  subtitle?: string
  variant: "active" | "upcoming" | "past"
  count: number
}

const SectionHeader = ({
  title,
  subtitle,
  variant,
  count,
}: SectionHeaderProps) => {
  const variantStyles = {
    active: {
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-500",
      titleColor: "text-emerald-700 dark:text-emerald-400",
      Icon: CheckCircle2,
    },
    upcoming: {
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-500",
      titleColor: "text-blue-700 dark:text-blue-400",
      Icon: CalendarClock,
    },
    past: {
      iconBg: "bg-gray-100 dark:bg-gray-800",
      iconColor: "text-gray-500",
      titleColor: "text-gray-600 dark:text-gray-400",
      Icon: Clock,
    },
  }

  const styles = variantStyles[variant]
  const IconComponent = styles.Icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 flex items-center gap-3"
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          styles.iconBg
        )}
      >
        <IconComponent className={cn("h-5 w-5", styles.iconColor)} />
      </div>
      <div>
        <h2
          className={cn(
            "font-display text-xl font-bold",
            styles.titleColor
          )}
        >
          {title}
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({count})
          </span>
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
    </motion.div>
  )
}

// Main page component
const ExamenBlancPage = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const [selectedExam, setSelectedExam] = useState<Id<"exams"> | null>(null)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const router = useRouter()

  // Skip queries until authenticated to avoid race condition on page reload
  const allExams = useQuery(
    api.exams.getAllExamsWithUserParticipation,
    isAuthenticated ? undefined : "skip"
  )
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? undefined : "skip"
  )
  const userAccess = useQuery(
    api.users.getMyAccess,
    isAuthenticated ? { accessType: "exam" as const } : "skip"
  )

  // Update timestamp periodically for active exams
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Separate exams by status
  const { activeExams, upcomingExams, pastExams } = useMemo(() => {
    if (!allExams) return { activeExams: [], upcomingExams: [], pastExams: [] }

    return {
      activeExams: allExams.filter(
        (exam) => exam.isActive && now >= exam.startDate && now <= exam.endDate
      ),
      upcomingExams: allExams.filter(
        (exam) => exam.isActive && now < exam.startDate
      ),
      pastExams: allExams.filter((exam) => exam.isActive && now > exam.endDate),
    }
  }, [allExams, now])

  // Calculate user stats
  const userStats = useMemo(() => {
    if (!allExams) return null

    const completedExams = allExams.filter((exam) => exam.userParticipation)
    const totalCompleted = completedExams.length
    const passedExams = completedExams.filter(
      (exam) => (exam.userParticipation?.score ?? 0) >= 60
    ).length
    const averageScore =
      totalCompleted > 0
        ? Math.round(
            completedExams.reduce(
              (sum, exam) => sum + (exam.userParticipation?.score ?? 0),
              0
            ) / totalCompleted
          )
        : 0

    return {
      total: allExams.length,
      completed: totalCompleted,
      passed: passedExams,
      averageScore,
    }
  }, [allExams])

  // Check user eligibility - based on active exam access
  const isUserEligible = (): boolean => {
    if (!currentUser) return false
    if (currentUser.role === "admin") return true
    return !!(userAccess && userAccess.expiresAt > now)
  }

  const handleStartExam = (examId: Id<"exams">) => {
    setSelectedExam(examId)
    setConfirmationOpen(true)
  }

  const confirmStartExam = () => {
    if (selectedExam) {
      router.push(`/dashboard/examen-blanc/${selectedExam}/evaluation`)
    }
    setConfirmationOpen(false)
  }

  const handleViewResults = (examId: Id<"exams">) => {
    router.push(`/dashboard/examen-blanc/${examId}`)
  }

  const getSelectedExamData = () => {
    if (!selectedExam || !allExams) return null
    return allExams.find((exam) => exam._id === selectedExam)
  }

  // Loading state
  if (isAuthLoading || allExams === undefined) {
    return <ExamPageSkeleton />
  }

  return (
    <div className="min-h-screen">
      {/* Background gradient mesh */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-100/40 to-indigo-100/40 blur-3xl dark:from-blue-900/20 dark:to-indigo-900/20" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-violet-100/30 to-blue-100/30 blur-3xl dark:from-violet-900/15 dark:to-blue-900/15" />
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 shadow-md"
              >
                <Trophy className="h-3.5 w-3.5 text-amber-900" />
              </motion.div>
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
                Examens Blancs
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Testez vos connaissances dans les conditions réelles de l&apos;EACMC
              </p>
            </div>
          </div>

          {/* Stats summary */}
          {userStats && userStats.completed > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mt-6 flex flex-wrap gap-6"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {userStats.completed}
                  </span>{" "}
                  examen{userStats.completed > 1 ? "s" : ""} passé
                  {userStats.completed > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {userStats.passed}
                  </span>{" "}
                  réussi{userStats.passed > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Score moyen :{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {userStats.averageScore}%
                  </span>
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Active exams section */}
        {activeExams.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <SectionHeader
              title="Examens disponibles maintenant"
              subtitle="Commencez dès maintenant"
              variant="active"
              count={activeExams.length}
            />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {activeExams.map((exam, index) => (
                <ExamCard
                  key={exam._id}
                  exam={exam}
                  variant="active"
                  isEligible={isUserEligible()}
                  onStart={handleStartExam}
                  onViewResults={handleViewResults}
                  index={index}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Upcoming exams section */}
        {upcomingExams.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <SectionHeader
              title="Examens à venir"
              subtitle="Préparez-vous pour les prochains examens"
              variant="upcoming"
              count={upcomingExams.length}
            />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {upcomingExams.map((exam, index) => (
                <ExamCard
                  key={exam._id}
                  exam={exam}
                  variant="upcoming"
                  isEligible={isUserEligible()}
                  onStart={handleStartExam}
                  onViewResults={handleViewResults}
                  index={index}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Past exams section */}
        {pastExams.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <SectionHeader
              title="Examens terminés"
              subtitle="Consultez vos résultats"
              variant="past"
              count={pastExams.length}
            />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pastExams.map((exam, index) => (
                <ExamCard
                  key={exam._id}
                  exam={exam}
                  variant="past"
                  isEligible={isUserEligible()}
                  onStart={handleStartExam}
                  onViewResults={handleViewResults}
                  index={index}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Empty state */}
        {allExams.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center py-16"
          >
            <EmptyState
              title="Aucun examen disponible"
              description="Les examens blancs seront bientôt disponibles.&#10;Revenez plus tard !"
              icons={[CalendarDays, GraduationCap, Clock]}
            />
          </motion.div>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent className="overflow-hidden border-0 bg-white/95 shadow-2xl backdrop-blur-xl sm:max-w-lg dark:bg-gray-900/95">
          <DialogHeader className="space-y-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30"
              >
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </motion.div>
              Confirmer le début de l&apos;examen
            </DialogTitle>
            <div className="space-y-4 pt-2">
              <p className="text-gray-700 dark:text-gray-300">
                Vous êtes sur le point de commencer un examen blanc. Voici les
                conditions :
              </p>
              <div className="space-y-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/30 dark:to-orange-950/30">
                {[
                  {
                    text: `${getSelectedExamData()?.questionIds.length || 0} questions`,
                    detail: "à répondre",
                  },
                  {
                    text: `${Math.floor((getSelectedExamData()?.completionTime || 0) / 60)} minutes`,
                    detail: "pour compléter l'examen",
                  },
                  {
                    text: "Impossible d'interrompre",
                    detail: "une fois commencé",
                  },
                  { text: "Un seul essai", detail: "autorisé" },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm">
                      <strong className="text-gray-900 dark:text-white">
                        {item.text}
                      </strong>{" "}
                      <span className="text-gray-600 dark:text-gray-400">
                        {item.detail}
                      </span>
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="rounded-lg bg-amber-100/50 p-3 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Assurez-vous d&apos;avoir suffisamment de temps avant de
                  commencer.
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => setConfirmationOpen(false)}
              className="font-medium"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmStartExam}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Commencer l&apos;examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ExamenBlancPage
