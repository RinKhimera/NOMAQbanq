"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { usePaginatedQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  defaultFilters,
  QuestionBrowserContextState,
  QuestionBrowserMode,
  QuestionFilters,
  QuestionRow,
  SortBy,
} from "./types"

const QuestionBrowserContext = createContext<QuestionBrowserContextState | null>(
  null
)

interface QuestionBrowserProviderProps {
  children: React.ReactNode
  mode: QuestionBrowserMode
  // Selection (mode select)
  selectedIds?: Id<"questions">[]
  onSelectionChange?: (ids: Id<"questions">[]) => void
  maxSelection?: number
  // Preview (mode browse - controlled)
  externalPreviewId?: Id<"questions"> | null
  onPreviewChange?: (id: Id<"questions"> | null) => void
  // Filters callback
  onFiltersChange?: (filters: QuestionFilters) => void
}

export function QuestionBrowserProvider({
  children,
  mode,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  maxSelection = 230,
  externalPreviewId,
  onPreviewChange,
  onFiltersChange,
}: QuestionBrowserProviderProps) {
  // Filters state
  const [filters, setFilters] = useState<QuestionFilters>(defaultFilters)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

  // Preview panel state (internal, used when not controlled)
  const [internalPreviewId, setInternalPreviewId] =
    useState<Id<"questions"> | null>(null)

  // Use external or internal preview based on props (controlled/uncontrolled)
  const previewQuestionId = externalPreviewId !== undefined ? externalPreviewId : internalPreviewId
  const setPreviewQuestionId = onPreviewChange ?? setInternalPreviewId

  // Internal selection state (used when not controlled externally)
  const [internalSelectedIds, setInternalSelectedIds] = useState<
    Id<"questions">[]
  >([])

  // Use external or internal selection based on mode and props
  const selectedIds = externalSelectedIds ?? internalSelectedIds
  const setSelectedIds = onSelectionChange ?? setInternalSelectedIds

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(filters.searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.searchQuery])

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])

  // Fetch questions with filters
  const {
    results: questions,
    status,
    loadMore: loadMoreFn,
  } = usePaginatedQuery(
    api.questions.getQuestionsWithFilters,
    {
      searchQuery: debouncedSearchQuery || undefined,
      domain: filters.domain !== "all" ? filters.domain : undefined,
      hasImages:
        filters.hasImages === "all"
          ? undefined
          : filters.hasImages === "with",
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    },
    { initialNumItems: 50 }
  )

  // Computed states
  const isLoading = status === "LoadingFirstPage"
  const canLoadMore = status === "CanLoadMore"
  const isLoadingMore = status === "LoadingMore"
  const isSearching =
    filters.searchQuery !== debouncedSearchQuery && !!filters.searchQuery

  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.domain !== "all" ||
    filters.hasImages !== "all"

  const isQuotaReached = selectedIds.length >= maxSelection

  // Update a single filter
  const updateFilter = useCallback(
    <K extends keyof QuestionFilters>(key: K, value: QuestionFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  // Handle sorting
  const handleSort = useCallback((field: SortBy) => {
    setFilters((prev) => {
      if (prev.sortBy === field) {
        return {
          ...prev,
          sortOrder: prev.sortOrder === "asc" ? "desc" : "asc",
        }
      }
      return { ...prev, sortBy: field, sortOrder: "desc" }
    })
  }, [])

  // Selection helpers
  const toggleSelection = useCallback(
    (id: Id<"questions">) => {
      const isSelected = selectedIds.includes(id)
      if (isSelected) {
        setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
      } else if (selectedIds.length < maxSelection) {
        setSelectedIds([...selectedIds, id])
      }
    },
    [selectedIds, setSelectedIds, maxSelection]
  )

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [setSelectedIds])

  const isSelected = useCallback(
    (id: Id<"questions">) => selectedIds.includes(id),
    [selectedIds]
  )

  // Load more wrapper
  const loadMore = useCallback(() => {
    if (canLoadMore) {
      loadMoreFn(50)
    }
  }, [canLoadMore, loadMoreFn])

  // Context value
  const value = useMemo<QuestionBrowserContextState>(
    () => ({
      // Filters
      filters,
      setFilters,
      updateFilter,
      clearFilters,
      hasActiveFilters,

      // Sorting
      handleSort,

      // Selection
      selectedIds,
      toggleSelection,
      clearSelection,
      isSelected,
      isQuotaReached,
      maxSelection,

      // Preview
      previewQuestionId,
      setPreviewQuestionId,

      // Mode
      mode,

      // Data
      questions: questions as QuestionRow[],
      isLoading,
      canLoadMore,
      loadMore,
      isLoadingMore,
      isSearching,
    }),
    [
      filters,
      updateFilter,
      clearFilters,
      hasActiveFilters,
      handleSort,
      selectedIds,
      toggleSelection,
      clearSelection,
      isSelected,
      isQuotaReached,
      maxSelection,
      previewQuestionId,
      setPreviewQuestionId,
      mode,
      questions,
      isLoading,
      canLoadMore,
      loadMore,
      isLoadingMore,
      isSearching,
    ]
  )

  return (
    <QuestionBrowserContext.Provider value={value}>
      {children}
    </QuestionBrowserContext.Provider>
  )
}

export function useQuestionBrowser() {
  const context = useContext(QuestionBrowserContext)
  if (!context) {
    throw new Error(
      "useQuestionBrowser must be used within a QuestionBrowserProvider"
    )
  }
  return context
}
