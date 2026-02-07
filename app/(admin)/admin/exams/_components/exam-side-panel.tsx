"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import {
  IconCalendarEvent,
  IconClipboardCheck,
  IconClock,
  IconEdit,
  IconExternalLink,
  IconQuestionMark,
  IconUsers,
  IconX,
  IconPlayerPause,
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getExamStatus, EXAM_STATUS_CONFIG } from "@/lib/exam-status"

interface ExamSidePanelProps {
  examId: Id<"exams"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExamSidePanel({
  examId,
  open,
  onOpenChange,
}: ExamSidePanelProps) {
  const exam = useQuery(
    api.exams.getExamWithQuestions,
    examId ? { examId } : "skip",
  )

  const eligibleCount = useQuery(api.users.getActiveExamAccessCount)

  const isLoading = examId && exam === undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto border-l-0 bg-linear-to-b from-slate-50 via-white to-slate-50/50 p-0 shadow-2xl sm:max-w-120 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950"
        side="right"
        hideCloseButton
      >
        {/* Accessible title for loading/empty states */}
        {!exam && (
          <VisuallyHidden.Root>
            <SheetHeader>
              <SheetTitle>Détails de l&apos;examen</SheetTitle>
              <SheetDescription>
                Panel de détails pour un examen sélectionné
              </SheetDescription>
            </SheetHeader>
          </VisuallyHidden.Root>
        )}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <PanelSkeleton key="skeleton" />
          ) : exam ? (
            <PanelContent
              key={exam._id}
              exam={exam}
              eligibleCount={eligibleCount ?? 0}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <EmptyState key="empty" />
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}

function PanelSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6 p-6"
    >
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center p-6 text-center"
    >
      <div className="mb-4 rounded-2xl bg-gray-100 p-4 dark:bg-gray-800">
        <IconClipboardCheck className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">Sélectionnez un examen</p>
    </motion.div>
  )
}

interface PanelContentProps {
  exam: {
    _id: Id<"exams">
    title: string
    description?: string
    startDate: number
    endDate: number
    questionIds: Id<"questions">[]
    isActive: boolean
    enablePause?: boolean
    pauseDurationMinutes?: number
    completionTime: number
  }
  eligibleCount: number
  onClose: () => void
}

function PanelContent({ exam, eligibleCount, onClose }: PanelContentProps) {
  const status = getExamStatus({
    startDate: exam.startDate,
    endDate: exam.endDate,
    isActive: exam.isActive,
  })
  const statusConfig = EXAM_STATUS_CONFIG[status]
  const StatusIcon = statusConfig.icon

  const durationMinutes = Math.ceil(exam.completionTime / 60)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col"
    >
      {/* Header avec gradient dynamique */}
      <div
        className={cn(
          "relative overflow-hidden px-6 pb-6 pt-5",
          status === "active" &&
            "bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-transparent",
          status === "upcoming" &&
            "bg-linear-to-br from-blue-500/10 via-indigo-500/5 to-transparent",
          status === "completed" &&
            "bg-linear-to-br from-gray-500/10 via-slate-500/5 to-transparent",
          status === "inactive" &&
            "bg-linear-to-br from-amber-500/10 via-orange-500/5 to-transparent",
        )}
      >
        {/* Pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <SheetHeader className="relative">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg",
                  "bg-linear-to-br",
                  status === "active" && "from-emerald-500 to-teal-600",
                  status === "upcoming" && "from-blue-500 to-indigo-600",
                  status === "completed" && "from-gray-400 to-slate-500",
                  status === "inactive" && "from-amber-500 to-orange-600",
                )}
              >
                <StatusIcon className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="line-clamp-2 text-left text-lg font-bold leading-tight text-gray-900 dark:text-white">
                  {exam.title}
                </SheetTitle>
                <VisuallyHidden.Root>
                  <SheetDescription>
                    Détails et statistiques de l&apos;examen
                  </SheetDescription>
                </VisuallyHidden.Root>
                <Badge
                  variant="secondary"
                  className={cn("mt-2 font-medium", statusConfig.className)}
                >
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fermer le panneau"
              onClick={onClose}
              className="shrink-0 rounded-full hover:bg-white/50 dark:hover:bg-gray-800/50"
            >
              <IconX className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>
      </div>

      {/* Corps du panel */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {/* Description */}
        {exam.description && (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {exam.description}
          </p>
        )}

        {/* Stats rapides */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<IconQuestionMark className="h-4 w-4" />}
            label="Questions"
            value={exam.questionIds.length.toString()}
            color="violet"
          />
          <StatCard
            icon={<IconClock className="h-4 w-4" />}
            label="Durée"
            value={`${durationMinutes} min`}
            color="blue"
          />
          <StatCard
            icon={<IconUsers className="h-4 w-4" />}
            label="Éligibles"
            value={eligibleCount.toString()}
            color="teal"
          />
          <StatCard
            icon={<IconPlayerPause className="h-4 w-4" />}
            label="Pause"
            value={
              exam.enablePause ? `${exam.pauseDurationMinutes ?? 15} min` : "Non"
            }
            color="amber"
          />
        </div>

        <Separator className="bg-gray-200/60 dark:bg-gray-700/60" />

        {/* Dates */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <IconCalendarEvent className="h-4 w-4" />
            Période de disponibilité
          </h3>
          <div className="rounded-xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Début</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {format(new Date(exam.startDate), "d MMM yyyy", {
                    locale: fr,
                  })}
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(exam.startDate), "HH:mm", { locale: fr })}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <span className="text-xs font-bold text-gray-500">→</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Fin</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {format(new Date(exam.endDate), "d MMM yyyy", { locale: fr })}
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(exam.endDate), "HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className="border-t border-gray-200/60 bg-white/80 p-4 backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/admin/exams/${exam._id}`}>
              <IconExternalLink className="mr-2 h-4 w-4" />
              Voir détails
            </Link>
          </Button>
          <Button
            className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
            asChild
          >
            <Link href={`/admin/exams/edit/${exam._id}`}>
              <IconEdit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: "violet" | "blue" | "teal" | "amber"
}

const colorConfig = {
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    icon: "text-violet-600 dark:text-violet-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    icon: "text-blue-600 dark:text-blue-400",
  },
  teal: {
    bg: "bg-teal-50 dark:bg-teal-900/20",
    icon: "text-teal-600 dark:text-teal-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    icon: "text-amber-600 dark:text-amber-400",
  },
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const config = colorConfig[color]

  return (
    <div
      className={cn(
        "rounded-xl p-3 transition-all hover:scale-[1.02]",
        config.bg,
      )}
    >
      <div className={cn("mb-1", config.icon)}>{icon}</div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
