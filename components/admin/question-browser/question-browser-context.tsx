"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import type { ExamPickerOption } from "@/features/exams/dal"
import { loadQuestionsPage } from "@/features/questions/actions"
import type { QuestionListItem } from "@/features/questions/dal"
import {
  QuestionBrowserContextState,
  QuestionBrowserMode,
  QuestionFilters,
  QuestionRow,
  SortBy,
  UsageFilter,
  defaultFilters,
} from "./types"
import { nextUsageFilters } from "./utils"

const QuestionBrowserContext =
  createContext<QuestionBrowserContextState | null>(null)

// Pur (aucune capture) → scope module : le callback de fetch partagé peut ne
// dépendre que de (queryArgs, page, pageSize) sans se recréer à chaque rendu.
const toRow = (q: QuestionListItem): QuestionRow => ({
  _id: q.id,
  _creationTime: q.createdAt,
  question: q.question,
  domain: q.domain,
  objectifCMC: q.objectifCMC,
  options: q.options,
  imageCount: q.imageCount,
  usageCount: q.usageCount,
})

interface QuestionBrowserProviderProps {
  children: React.ReactNode
  mode: QuestionBrowserMode
  // Selection (mode select)
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  maxSelection?: number
  // Preview (mode browse - controlled)
  externalPreviewId?: string | null
  onPreviewChange?: (id: string | null) => void
  // Filters callback
  onFiltersChange?: (filters: QuestionFilters) => void
  // Options du combobox « examen précis » (filtre usage)
  examOptions?: ExamPickerOption[]
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
  examOptions,
}: QuestionBrowserProviderProps) {
  // Filters state
  const [filters, setFilters] = useState<QuestionFilters>(defaultFilters)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

  // Pagination offset numérotée
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(50)
  const [total, setTotal] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [, startFetch] = useTransition()

  // Debounce search ; le reset page se fait ICI (callback async → ESLint OK),
  // pas dans updateFilter — sinon fetch superflu avec l'ancien terme.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(filters.searchQuery)
      setPageState(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.searchQuery])

  // Preview panel state (internal, used when not controlled)
  const [internalPreviewId, setInternalPreviewId] = useState<string | null>(
    null,
  )

  // Use external or internal preview based on props (controlled/uncontrolled)
  const previewQuestionId =
    externalPreviewId !== undefined ? externalPreviewId : internalPreviewId
  const setPreviewQuestionId = onPreviewChange ?? setInternalPreviewId

  // Internal selection state (used when not controlled externally)
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([])

  // Use external or internal selection based on mode and props
  const selectedIds = externalSelectedIds ?? internalSelectedIds
  const setSelectedIds = onSelectionChange ?? setInternalSelectedIds

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])

  const queryArgs = useMemo(
    () => ({
      search: debouncedSearchQuery || undefined,
      domain: filters.domain !== "all" ? filters.domain : undefined,
      hasImages:
        filters.hasImages === "all" ? undefined : filters.hasImages === "with",
      usageFilter: filters.usageFilter,
      usedInExamId: filters.usedInExamId ?? undefined,
      sortOrder: filters.sortOrder,
    }),
    [
      debouncedSearchQuery,
      filters.domain,
      filters.hasImages,
      filters.usageFilter,
      filters.usedInExamId,
      filters.sortOrder,
    ],
  )

  // Fetch de la page courante — partagé entre l'effet (filtre/page/taille) et
  // `reload()` (après une suppression) pour que le clamp hors-borne s'applique
  // aux DEUX chemins : supprimer le dernier élément de la dernière page ne doit
  // jamais laisser une page vide sans pagination visible.
  const fetchPage = useCallback(() => {
    startFetch(async () => {
      const res = await loadQuestionsPage({
        ...queryArgs,
        page,
        limit: pageSize,
      })
      setQuestions(res.items.map(toRow))
      setTotal(res.total)
      setHasLoaded(true)
      // Clamp hors-borne (callback async → ESLint OK) : page devenue vide
      // → ramène à la dernière page valide (pas de boucle : quand total > 0,
      // la dernière page a toujours des items).
      if (res.items.length === 0 && page > 1 && res.total > 0) {
        setPageState(Math.ceil(res.total / pageSize))
      }
    })
  }, [queryArgs, page, pageSize])

  useEffect(() => {
    fetchPage()
  }, [fetchPage])

  const setPage = useCallback((p: number) => setPageState(Math.max(1, p)), [])
  const setPageSize = useCallback((s: number) => {
    setPageSizeState(s)
    setPageState(1)
  }, [])

  const reload = fetchPage

  // Computed states
  const isLoading = !hasLoaded
  const isSearching =
    filters.searchQuery !== debouncedSearchQuery && !!filters.searchQuery

  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.domain !== "all" ||
    filters.hasImages !== "all" ||
    filters.usageFilter !== "all" ||
    filters.usedInExamId !== null

  const isQuotaReached = selectedIds.length >= maxSelection

  // Update a single filter (reset page 1 — sauf la recherche, gérée au debounce)
  const updateFilter = useCallback(
    <K extends keyof QuestionFilters>(key: K, value: QuestionFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
      if (key !== "searchQuery") setPageState(1)
    },
    [],
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters)
    setPageState(1)
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
    setPageState(1)
  }, [])

  // Exclusion mutuelle usage/examen (helper pur) + reset page
  const setUsage = useCallback(
    (next: { usageFilter: UsageFilter } | { usedInExamId: string | null }) => {
      setFilters((prev) => nextUsageFilters(prev, next))
      setPageState(1)
    },
    [],
  )

  // Selection helpers
  const toggleSelection = useCallback(
    (id: string) => {
      const isSelected = selectedIds.includes(id)
      if (isSelected) {
        setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
      } else if (selectedIds.length < maxSelection) {
        setSelectedIds([...selectedIds, id])
      }
    },
    [selectedIds, setSelectedIds, maxSelection],
  )

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [setSelectedIds])

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  )

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

      // Data + pagination
      questions,
      isLoading,
      page,
      pageSize,
      total,
      setPage,
      setPageSize,
      isSearching,
      reload,
      setUsage,
      examOptions: examOptions ?? [],
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
      page,
      pageSize,
      total,
      setPage,
      setPageSize,
      isSearching,
      reload,
      setUsage,
      examOptions,
    ],
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
      "useQuestionBrowser must be used within a QuestionBrowserProvider",
    )
  }
  return context
}
