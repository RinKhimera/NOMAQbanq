"use client"

import { IconListCheck } from "@tabler/icons-react"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState, useTransition } from "react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import {
  QuestionBrowser,
  type QuestionFilters,
  defaultFilters,
} from "@/components/admin/question-browser"
import { Button } from "@/components/ui/button"
import { Id } from "@/convex/_generated/dataModel"
import type { QuestionStatsEnriched } from "@/features/questions/dal"

import { ExportQuestionsButton } from "./export-questions-button"
import { QuestionSidePanel } from "./question-side-panel"
import { QuestionsStatsRow } from "./questions-stats-row"

export function QuestionsManager({ stats }: { stats: QuestionStatsEnriched }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuestionId = searchParams.get(
    "question",
  ) as Id<"questions"> | null

  const [selectedQuestionId, setSelectedQuestionId] =
    useState<Id<"questions"> | null>(initialQuestionId)
  const [currentFilters, setCurrentFilters] =
    useState<QuestionFilters>(defaultFilters)
  const [, startTransition] = useTransition()

  const handlePreviewChange = useCallback(
    (id: Id<"questions"> | null) => {
      startTransition(() => {
        setSelectedQuestionId(id)
        const url = new URL(window.location.href)
        if (id) url.searchParams.set("question", id)
        else url.searchParams.delete("question")
        router.replace(url.pathname + url.search, { scroll: false })
      })
    },
    [router],
  )

  const handleQuestionDeleted = useCallback(() => {
    setSelectedQuestionId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete("question")
    router.replace(url.pathname + url.search, { scroll: false })
    router.refresh() // rafraîchit les stats (Server Component)
  }, [router])

  return (
    <>
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
              }
              questionCount={stats.totalCount}
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

      <QuestionsStatsRow stats={stats} isLoading={false} />

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
    </>
  )
}
