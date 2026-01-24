"use client"

import { useState, useCallback, useEffect } from "react"
import { useQuery, usePaginatedQuery } from "convex/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { IconListCheck } from "@tabler/icons-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { QuestionsStatsRow } from "./_components/questions-stats-row"
import {
  QuestionsFilterBar,
  type ImageFilter,
} from "./_components/questions-filter-bar"
import {
  QuestionsTable,
  type QuestionRow,
  type SortBy,
  type SortOrder,
} from "./_components/questions-table"
import { QuestionSidePanel } from "./_components/question-side-panel"
import { ExportQuestionsButton } from "./_components/export-questions-button"

export default function AdminQuestionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize selected question from URL params
  const initialQuestionId = searchParams.get("question") as Id<"questions"> | null

  // State for filters
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [domain, setDomain] = useState<string>("all")
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("_creationTime")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  // State for panel - initialize from URL
  const [selectedQuestionId, setSelectedQuestionId] = useState<Id<"questions"> | null>(
    initialQuestionId
  )
  const [isPanelOpen, setIsPanelOpen] = useState(!!initialQuestionId)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Stats query
  const stats = useQuery(api.questions.getQuestionStatsEnriched)

  // Questions query with filters using usePaginatedQuery
  const {
    results: questions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.questions.getQuestionsWithFilters,
    {
      searchQuery: debouncedSearchQuery.trim() || undefined,
      domain: domain === "all" ? undefined : domain,
      hasImages:
        imageFilter === "all" ? undefined : imageFilter === "with" ? true : false,
      sortBy,
      sortOrder,
    },
    { initialNumItems: 50 }
  )

  // Handlers
  const handleSort = useCallback(
    (field: SortBy) => {
      if (sortBy === field) {
        // Same column - toggle order
        setSortOrder((order) => (order === "asc" ? "desc" : "asc"))
      } else {
        // Different column - set new column with default desc order
        setSortBy(field)
        setSortOrder("desc")
      }
    },
    [sortBy]
  )

  const handleQuestionSelect = useCallback(
    (question: QuestionRow) => {
      setSelectedQuestionId(question._id)
      setIsPanelOpen(true)
      // Update URL without navigation
      const url = new URL(window.location.href)
      url.searchParams.set("question", question._id)
      router.replace(url.pathname + url.search, { scroll: false })
    },
    [router]
  )

  const handlePanelClose = useCallback(
    (open: boolean) => {
      setIsPanelOpen(open)
      if (!open) {
        setSelectedQuestionId(null)
        // Remove question param from URL
        const url = new URL(window.location.href)
        url.searchParams.delete("question")
        router.replace(url.pathname + url.search, { scroll: false })
      }
    },
    [router]
  )

  const handleQuestionDeleted = useCallback(() => {
    setIsPanelOpen(false)
    setSelectedQuestionId(null)
    // Remove question param from URL
    const url = new URL(window.location.href)
    url.searchParams.delete("question")
    router.replace(url.pathname + url.search, { scroll: false })
  }, [router])

  const handleClearFilters = useCallback(() => {
    setSearchQuery("")
    setDomain("all")
    setImageFilter("all")
    setSortBy("_creationTime")
    setSortOrder("desc")
  }, [])

  const hasActiveFilters =
    searchQuery !== "" || domain !== "all" || imageFilter !== "all"

  const isLoading = status === "LoadingFirstPage"
  const canLoadMore = status === "CanLoadMore"
  const isLoadingMore = status === "LoadingMore"

  const handleLoadMore = useCallback(() => {
    if (canLoadMore) {
      loadMore(50)
    }
  }, [canLoadMore, loadMore])

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
              searchQuery={debouncedSearchQuery}
              domain={domain}
              hasImages={
                imageFilter === "all"
                  ? undefined
                  : imageFilter === "with"
                    ? true
                    : false
              }
            />
            <Link href="/admin/questions/nouvelle">
              <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-500/30">
                <Plus className="h-4 w-4" />
                Nouvelle question
              </Button>
            </Link>
          </>
        }
      />

      {/* Stats Row */}
      <QuestionsStatsRow stats={stats ?? null} isLoading={stats === undefined} />

      {/* Filter Bar */}
      <QuestionsFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        domain={domain}
        onDomainChange={setDomain}
        imageFilter={imageFilter}
        onImageFilterChange={setImageFilter}
        isSearching={isLoading && debouncedSearchQuery !== ""}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Questions Table */}
      <QuestionsTable
        questions={questions as QuestionRow[]}
        selectedQuestionId={selectedQuestionId}
        onQuestionSelect={handleQuestionSelect}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        canLoadMore={canLoadMore}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />

      {/* Side Panel */}
      <QuestionSidePanel
        questionId={selectedQuestionId}
        open={isPanelOpen}
        onOpenChange={handlePanelClose}
        onDeleted={handleQuestionDeleted}
      />
    </div>
  )
}
