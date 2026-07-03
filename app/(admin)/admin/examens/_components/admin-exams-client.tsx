"use client"

import { IconClipboardList, IconPlus } from "@tabler/icons-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ExamsList } from "@/components/admin/exams-list"
import { Button } from "@/components/ui/button"
import type { AdminExamListItem, ExamsStats } from "@/features/exams/dal"
import { ExamSidePanel } from "./exam-side-panel"
import { ExamsStatsRow } from "./exams-stats-row"

interface AdminExamsClientProps {
  stats: ExamsStats
  exams: AdminExamListItem[]
  eligibleCount: number
}

export function AdminExamsClient({
  stats,
  exams,
  eligibleCount,
}: AdminExamsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // L'URL est la source de vérité du panneau (deep-link `?exam=<id>`).
  const selectedExamId = searchParams.get("exam")
  const selectedExam = selectedExamId
    ? (exams.find((e) => e.id === selectedExamId) ?? null)
    : null
  const isPanelOpen = !!selectedExam

  const handlePanelOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("exam")
        const next = params.toString()
        router.push(next ? `?${next}` : "/admin/examens", { scroll: false })
      }
    },
    [router, searchParams],
  )

  const handleExamSelect = useCallback(
    (examId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("exam", examId)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      <AdminPageHeader
        icon={IconClipboardList}
        title="Gestion des Examens"
        subtitle="Créez, modifiez et gérez les sessions d'évaluation"
        colorScheme="blue"
        actions={
          <Button
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30"
            asChild
          >
            <Link href="/admin/examens/creer">
              <IconPlus className="mr-2 h-5 w-5" />
              Créer un examen
            </Link>
          </Button>
        }
      />

      <ExamsStatsRow stats={stats} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-xl shadow-gray-200/50 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-none"
      >
        <ExamsList exams={exams} onExamSelect={handleExamSelect} />
      </motion.div>

      <ExamSidePanel
        exam={selectedExam}
        eligibleCount={eligibleCount}
        open={isPanelOpen}
        onOpenChange={handlePanelOpenChange}
      />
    </div>
  )
}
