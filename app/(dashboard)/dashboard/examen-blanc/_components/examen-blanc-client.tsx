"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Award,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CirclePlay,
  Clock,
  GraduationCap,
  Hourglass,
  TriangleAlert,
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
import type { ExamListItem } from "@/features/exams/dal"
import { cn } from "@/lib/utils"

type ExamVariant = "active" | "upcoming" | "past"

// Exam card component
interface ExamCardProps {
  exam: ExamListItem
  variant: ExamVariant
  isEligible: boolean
  onStart: (examId: string) => void
  onViewResults: (examId: string) => void
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
  const formatDate = (timestamp: number) =>
    format(new Date(timestamp), "PPP 'à' HH:mm", { locale: fr })

  const formatDateShort = (timestamp: number) =>
    format(new Date(timestamp), "dd MMM yyyy", { locale: fr })

  const variantStyles = {
    active: {
      gradient:
        "from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/30",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
      hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700",
      iconBg: "bg-emerald-500",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
      badgeText: "text-emerald-700 dark:text-emerald-300",
      badgeBorder: "border-emerald-200 dark:border-emerald-700",
      infoBg: "bg-white/60 dark:bg-gray-800/60",
      titleHover:
        "group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
    },
    upcoming: {
      gradient:
        "from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/30",
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
      gradient:
        "from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/40 dark:via-gray-950/30 dark:to-zinc-950/30",
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
  // Score affiché seulement pour une participation réellement complétée.
  const showScore = userTaken && userResult?.completedAt != null

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
        data-testid={`exam-card-${exam.id}`}
        className={cn(
          "group relative h-full overflow-hidden rounded-2xl border bg-linear-to-br p-6 shadow-sm backdrop-blur-sm transition-all duration-300",
          styles.gradient,
          styles.border,
          styles.hoverBorder,
          "hover:-translate-y-1 hover:shadow-lg",
        )}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3
            className={cn(
              "font-display text-lg font-bold text-gray-900 transition-colors dark:text-white",
              styles.titleHover,
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
              styles.badgeBorder,
            )}
          >
            {variant === "active" && (
              <>
                <CircleCheck className="mr-1 h-3 w-3" />
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
              styles.infoBg,
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
              styles.infoBg,
            )}
          >
            <Clock className={cn("h-4 w-4", styles.iconColor)} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {exam.questionCount} questions •{" "}
              {Math.floor(exam.completionTime / 60)} min
            </span>
          </div>
        </div>

        {/* Score for past exams */}
        {variant === "past" && showScore && userResult && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-800/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
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
                    : "bg-amber-100 dark:bg-amber-900/30",
                )}
              >
                {userResult.score >= 60 ? (
                  <Trophy className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
            </div>
            {userResult.completedAt != null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Passé le {formatDate(userResult.completedAt)}
              </p>
            )}
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
                  <CircleCheck className="mr-2 h-4 w-4" />
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
                  onClick={() => onStart(exam.id)}
                  className="w-full cursor-pointer bg-linear-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md transition-all duration-200 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg"
                >
                  <CirclePlay className="mr-2 h-4 w-4" />
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
                  onClick={() => onViewResults(exam.id)}
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
  variant: ExamVariant
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
      Icon: CircleCheck,
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
          styles.iconBg,
        )}
      >
        <IconComponent className={cn("h-5 w-5", styles.iconColor)} />
      </div>
      <div>
        <h2 className={cn("font-display text-xl font-bold", styles.titleColor)}>
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

interface ExamenBlancClientProps {
  exams: ExamListItem[]
  /** Accès aux examens `subscribers` (abonnement actif, ou admin). L'éligibilité
   *  par-examen se calcule ici : un examen `restricted` est toujours éligible
   *  (sa présence dans la liste implique l'appartenance à l'audience). */
  hasExamAccess: boolean
  initialNow: number
}

export function ExamenBlancClient({
  exams,
  hasExamAccess,
  initialNow,
}: ExamenBlancClientProps) {
  const [selectedExam, setSelectedExam] = useState<string | null>(null)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [now, setNow] = useState(initialNow)
  const router = useRouter()

  // Reclasse actifs/à venir/passés en temps réel (le setState est dans le
  // callback du timer, pas dans le corps de l'effet/rendu).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const { activeExams, upcomingExams, pastExams } = useMemo(
    () => ({
      activeExams: exams.filter(
        (exam) => exam.isActive && now >= exam.startDate && now <= exam.endDate,
      ),
      upcomingExams: exams.filter(
        (exam) => exam.isActive && now < exam.startDate,
      ),
      pastExams: exams.filter((exam) => exam.isActive && now > exam.endDate),
    }),
    [exams, now],
  )

  // Stats utilisateur : basées sur les examens réellement complétés (userHasTaken).
  const userStats = useMemo(() => {
    const completedExams = exams.filter((exam) => exam.userHasTaken)
    const totalCompleted = completedExams.length
    const passedExams = completedExams.filter(
      (exam) => (exam.userParticipation?.score ?? 0) >= 60,
    ).length
    const averageScore =
      totalCompleted > 0
        ? Math.round(
            completedExams.reduce(
              (sum, exam) => sum + (exam.userParticipation?.score ?? 0),
              0,
            ) / totalCompleted,
          )
        : 0

    return {
      total: exams.length,
      completed: totalCompleted,
      passed: passedExams,
      averageScore,
    }
  }, [exams])

  const handleStartExam = (examId: string) => {
    setSelectedExam(examId)
    setConfirmationOpen(true)
  }

  const confirmStartExam = () => {
    if (selectedExam) {
      router.push(`/dashboard/examen-blanc/${selectedExam}/evaluation`)
    }
    setConfirmationOpen(false)
  }

  const handleViewResults = (examId: string) => {
    router.push(`/dashboard/examen-blanc/${examId}`)
  }

  const selectedExamData = selectedExam
    ? exams.find((exam) => exam.id === selectedExam)
    : null

  return (
    <div className="min-h-screen">
      {/* Background gradient mesh */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 h-150 w-150 rounded-full bg-linear-to-br from-blue-100/40 to-indigo-100/40 blur-3xl dark:from-blue-900/20 dark:to-indigo-900/20" />
        <div className="absolute -right-1/4 -bottom-1/4 h-125 w-125 rounded-full bg-linear-to-br from-violet-100/30 to-blue-100/30 blur-3xl dark:from-violet-900/15 dark:to-blue-900/15" />
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 shadow-md"
              >
                <Trophy className="h-3.5 w-3.5 text-amber-900" />
              </motion.div>
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
                Examens Blancs
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Testez vos connaissances dans les conditions réelles de
                l&apos;EACMC
              </p>
            </div>
          </div>

          {/* Stats summary */}
          {userStats.completed > 0 && (
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
                  key={exam.id}
                  exam={exam}
                  variant="active"
                  isEligible={
                    hasExamAccess || exam.audienceType === "restricted"
                  }
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
                  key={exam.id}
                  exam={exam}
                  variant="upcoming"
                  isEligible={
                    hasExamAccess || exam.audienceType === "restricted"
                  }
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
                  key={exam.id}
                  exam={exam}
                  variant="past"
                  isEligible={
                    hasExamAccess || exam.audienceType === "restricted"
                  }
                  onStart={handleStartExam}
                  onViewResults={handleViewResults}
                  index={index}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Empty state */}
        {exams.length === 0 && (
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
                className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30"
              >
                <TriangleAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </motion.div>
              Confirmer le début de l&apos;examen
            </DialogTitle>
            <div className="space-y-4 pt-2">
              <p className="text-gray-700 dark:text-gray-300">
                Vous êtes sur le point de commencer un examen blanc. Voici les
                conditions :
              </p>
              <div className="space-y-3 rounded-xl bg-linear-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/30 dark:to-orange-950/30">
                {[
                  {
                    text: `${selectedExamData?.questionCount ?? 0} questions`,
                    detail: "à répondre",
                  },
                  {
                    text: `${Math.floor((selectedExamData?.completionTime ?? 0) / 60)} minutes`,
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
              className="bg-linear-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl"
            >
              <CirclePlay className="mr-2 h-4 w-4" />
              Commencer l&apos;examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
