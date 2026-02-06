"use client"

import { useState, useCallback, useTransition } from "react"
import { useQuery } from "convex/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { IconListCheck } from "@tabler/icons-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  QuestionBrowser,
  defaultFilters,
  type QuestionFilters,
} from "@/components/admin/question-browser"
import { QuestionsStatsRow } from "./_components/questions-stats-row"
import { QuestionSidePanel } from "./_components/question-side-panel"
import { ExportQuestionsButton } from "./_components/export-questions-button"

export default function AdminQuestionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize selected question from URL params
  const initialQuestionId = searchParams.get("question") as Id<"questions"> | null

  // State for panel - synced with URL
  const [selectedQuestionId, setSelectedQuestionId] = useState<Id<"questions"> | null>(
    initialQuestionId
  )

  // State for filters (used by export button)
  const [currentFilters, setCurrentFilters] = useState<QuestionFilters>(defaultFilters)

  // Transition for non-blocking panel updates
  const [, startTransition] = useTransition()

  // Stats query
  const stats = useQuery(api.questions.getQuestionStatsEnriched)

  // Handle preview change (sync with URL)
  const handlePreviewChange = useCallback(
    (id: Id<"questions"> | null) => {
      startTransition(() => {
        setSelectedQuestionId(id)
        const url = new URL(window.location.href)
        if (id) {
          url.searchParams.set("question", id)
        } else {
          url.searchParams.delete("question")
        }
        router.replace(url.pathname + url.search, { scroll: false })
      })
    },
    [router, startTransition]
  )

  // Handle question deleted
  const handleQuestionDeleted = useCallback(() => {
    setSelectedQuestionId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete("question")
    router.replace(url.pathname + url.search, { scroll: false })
  }, [router])

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <AdminPageHeader
        icon={IconListCheck}
        title="Gestion des Questions"
        subtitle="Gérez votre banque de questions QCM pour les examens EACMC"
        colorScheme="emerald"
        actions={
          <>
            <ExportQuestionsButton
              searchQuery={currentFilters.searchQuery}
              domain={currentFilters.domain}
              hasImages={
                currentFilters.hasImages === "all"
                  ? undefined
                  : currentFilters.hasImages === "with"
                    ? true
                    : false
              }
            />
            <Link href="/admin/questions/nouvelle">
              <Button className="gap-2 bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-500/30">
                <Plus className="h-4 w-4" />
                Nouvelle question
              </Button>
            </Link>
          </>
        }
      />

      {/* Stats Row */}
      <QuestionsStatsRow stats={stats ?? null} isLoading={stats === undefined} />

      {/* Questions Browser */}
      <QuestionBrowser
        mode="browse"
        previewQuestionId={selectedQuestionId}
        onPreviewChange={handlePreviewChange}
        onFiltersChange={setCurrentFilters}
        renderPanel={({ questionId, onClose }) => (
          <QuestionSidePanel
            questionId={questionId}
            open={!!questionId}
            onOpenChange={(open) => !open && onClose()}
            onDeleted={handleQuestionDeleted}
          />
        )}
      />
    </div>
  )
}
