"use client"

import { useCallback } from "react"
import { useConvexAuth, useQuery } from "convex/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import { IconPlus, IconClipboardList } from "@tabler/icons-react"
import { ExamsList } from "@/components/admin/exams-list"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { ExamsStatsRow } from "./_components/exams-stats-row"
import { ExamSidePanel } from "./_components/exam-side-panel"

const AdminExamsPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useConvexAuth()

  // Derive panel state directly from URL - URL is the source of truth
  // See: https://react.dev/learn/you-might-not-need-an-effect
  const selectedExamId = searchParams.get("exam") as Id<"exams"> | null
  const isPanelOpen = !!selectedExamId

  // Stats query
  const stats = useQuery(
    api.exams.getExamsStats,
    isAuthenticated ? undefined : "skip",
  )

  // Handle panel close - updates URL which derives panel state
  const handlePanelOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Remove exam param from URL - this will close the panel
        const params = new URLSearchParams(searchParams.toString())
        params.delete("exam")
        const newUrl = params.toString()
          ? `?${params.toString()}`
          : "/admin/exams"
        router.push(newUrl, { scroll: false })
      }
    },
    [router, searchParams],
  )

  // Handle exam selection - updates URL which opens panel
  const handleExamSelect = useCallback(
    (examId: Id<"exams">) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("exam", examId)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <AdminPageHeader
        icon={IconClipboardList}
        title="Gestion des Examens"
        subtitle="Créez, modifiez et gérez les sessions d'évaluation"
        colorScheme="blue"
        actions={
          <Button
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30"
            asChild
          >
            <Link href="/admin/exams/create">
              <IconPlus className="mr-2 h-5 w-5" />
              Créer un examen
            </Link>
          </Button>
        }
      />

      {/* Stats Row */}
      <ExamsStatsRow stats={stats ?? null} isLoading={stats === undefined} />

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-xl shadow-gray-200/50 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-none"
      >
        {/* Exams List */}
        <ExamsList onExamSelect={handleExamSelect} />
      </motion.div>

      {/* Side Panel */}
      <ExamSidePanel
        examId={selectedExamId}
        open={isPanelOpen}
        onOpenChange={handlePanelOpenChange}
      />
    </div>
  )
}

export default AdminExamsPage
