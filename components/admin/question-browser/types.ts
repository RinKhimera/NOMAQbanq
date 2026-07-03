import { ReactNode } from "react"
import type { ExamPickerOption } from "@/features/exams/dal"

// Filter types
export type ImageFilter = "all" | "with" | "without"
export type UsageFilter = "all" | "used" | "unused"
export type SortBy = "_creationTime" | "question" | "domain" | "objectifCMC"
export type SortOrder = "asc" | "desc"

export interface QuestionFilters {
  searchQuery: string
  domain: string // "all" or domain name
  hasImages: ImageFilter
  usageFilter: UsageFilter
  /** Restreint aux questions utilisées dans cet examen (exclusif de usageFilter). */
  usedInExamId: string | null
  sortBy: SortBy
  sortOrder: SortOrder
}

export const defaultFilters: QuestionFilters = {
  searchQuery: "",
  domain: "all",
  hasImages: "all",
  usageFilter: "all",
  usedInExamId: null,
  sortBy: "_creationTime",
  sortOrder: "desc",
}

// Question data types
export interface QuestionImage {
  url: string
  storagePath: string
  order: number
}

export interface QuestionRow {
  _id: string
  _creationTime: number
  question: string
  domain: string
  objectifCMC: string
  options: string[]
  /** Nombre d'images (la liste n'a plus besoin des URLs — cf. DAL `imageCount`). */
  imageCount: number
  /** Nombre d'examens référençant cette question. */
  usageCount: number
}

// Component mode
export type QuestionBrowserMode = "browse" | "select"

// Panel render props
export interface PanelRenderProps {
  questionId: string | null
  onClose: () => void
}

// Main component props
export interface QuestionBrowserProps {
  // Mode
  mode: QuestionBrowserMode

  // Mode select props
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  maxSelection?: number

  // Mode browse - controlled preview state (pour URL sync)
  previewQuestionId?: string | null
  onPreviewChange?: (id: string | null) => void

  // Callback pour exposer les filtres (pour export)
  onFiltersChange?: (filters: QuestionFilters) => void

  // Options du combobox « examen précis » (filtre usage). Vide/absent = masqué.
  examOptions?: ExamPickerOption[]

  // Panel integration
  renderPanel?: (props: PanelRenderProps) => ReactNode

  // Options
  className?: string
}

// Context state
export interface QuestionBrowserContextState {
  // Filters
  filters: QuestionFilters
  setFilters: (filters: QuestionFilters) => void
  updateFilter: <K extends keyof QuestionFilters>(
    key: K,
    value: QuestionFilters[K],
  ) => void
  clearFilters: () => void
  hasActiveFilters: boolean

  // Sorting
  handleSort: (field: SortBy) => void

  // Selection (only in select mode)
  selectedIds: string[]
  toggleSelection: (id: string) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
  isQuotaReached: boolean
  maxSelection: number

  // Preview panel
  previewQuestionId: string | null
  setPreviewQuestionId: (id: string | null) => void

  // Mode
  mode: QuestionBrowserMode

  // Data + pagination offset numérotée
  questions: QuestionRow[]
  isLoading: boolean
  page: number
  pageSize: number
  total: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  isSearching: boolean
  /** Recharge la page courante des filtres courants (après une suppression). */
  reload: () => void
  /** Applique atomiquement l'exclusion mutuelle usage/examen + reset page. */
  setUsage: (
    next: { usageFilter: UsageFilter } | { usedInExamId: string | null },
  ) => void
  examOptions: ExamPickerOption[]
}

// Sub-component props
export interface QuestionBrowserToolbarProps {
  className?: string
}

export interface QuestionBrowserTableProps {
  className?: string
}

export interface QuestionBrowserSelectionBarProps {
  onAutoComplete?: () => void
  className?: string
}
