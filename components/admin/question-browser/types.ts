import { ReactNode } from "react"

// Filter types
export type ImageFilter = "all" | "with" | "without"
export type SortBy = "_creationTime" | "question" | "domain" | "objectifCMC"
export type SortOrder = "asc" | "desc"

export interface QuestionFilters {
  searchQuery: string
  domain: string // "all" or domain name
  hasImages: ImageFilter
  sortBy: SortBy
  sortOrder: SortOrder
}

export const defaultFilters: QuestionFilters = {
  searchQuery: "",
  domain: "all",
  hasImages: "all",
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

  // Data
  questions: QuestionRow[]
  isLoading: boolean
  canLoadMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
  isSearching: boolean
  /** Recharge la 1re page des filtres courants (après une suppression). */
  reload: () => void
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
