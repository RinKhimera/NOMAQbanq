"use client"

import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  ImageIcon,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useQuestionBrowser } from "./question-browser-context"
import { QuestionBrowserTableProps, QuestionRow, SortBy } from "./types"
import { getDomainColor, truncateText } from "./utils"

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
      <div className="p-4">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800"
          >
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          Aucune question trouvée
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Essayez de modifier vos filtres ou ajoutez une nouvelle question.
        </p>
      </div>
    </div>
  )
}

export function QuestionBrowserTable({ className }: QuestionBrowserTableProps) {
  const {
    questions,
    isLoading,
    canLoadMore,
    loadMore,
    isLoadingMore,
    filters,
    handleSort,
    mode,
    toggleSelection,
    isSelected,
    isQuotaReached,
    previewQuestionId,
    setPreviewQuestionId,
  } = useQuestionBrowser()

  const isSelectMode = mode === "select"

  const getSortIcon = (field: SortBy) => {
    if (filters.sortBy !== field)
      return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
    return filters.sortOrder === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
    )
  }

  const formatRelativeDate = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: fr,
    })
  }

  const handleRowClick = (question: QuestionRow) => {
    if (isSelectMode) {
      // In select mode, clicking toggles selection
      toggleSelection(question._id)
    } else {
      // In browse mode, clicking opens preview
      setPreviewQuestionId(question._id)
    }
  }

  const handlePreviewClick = (
    e: React.MouseEvent,
    questionId: QuestionRow["_id"]
  ) => {
    e.stopPropagation()
    setPreviewQuestionId(questionId)
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  if (isLoading) {
    return <TableSkeleton />
  }

  if (questions.length === 0) {
    return <EmptyState />
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900",
        className
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {/* Checkbox column for select mode */}
            {isSelectMode && <TableHead className="w-12.5 pl-4" />}
            <TableHead className="w-12.5 pl-4">#</TableHead>
            <TableHead className="min-w-75">
              <Button
                variant="ghost"
                onClick={() => handleSort("question")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Question
                {getSortIcon("question")}
              </Button>
            </TableHead>
            <TableHead className="w-37.5">
              <Button
                variant="ghost"
                onClick={() => handleSort("domain")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Domaine
                {getSortIcon("domain")}
              </Button>
            </TableHead>
            <TableHead className="hidden w-45 md:table-cell">
              <Button
                variant="ghost"
                onClick={() => handleSort("objectifCMC")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Objectif CMC
                {getSortIcon("objectifCMC")}
              </Button>
            </TableHead>
            <TableHead className="w-20 text-center">Images</TableHead>
            <TableHead className="hidden w-30 lg:table-cell">
              <Button
                variant="ghost"
                onClick={() => handleSort("_creationTime")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Créée
                {getSortIcon("_creationTime")}
              </Button>
            </TableHead>
            {/* Preview button column */}
            <TableHead className="w-12.5" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((question, index) => {
            const hasImages = question.images && question.images.length > 0
            const imagesCount = question.images?.length || 0
            const questionIsSelected = isSelected(question._id)
            const isDisabled = !questionIsSelected && isQuotaReached
            const isHighlighted =
              previewQuestionId === question._id ||
              (mode === "browse" && previewQuestionId === question._id)

            return (
              <TableRow
                key={question._id}
                onClick={() => handleRowClick(question)}
                className={cn(
                  "cursor-pointer transition-all duration-150",
                  isSelectMode && questionIsSelected
                    ? "bg-violet-50/50 shadow-[inset_3px_0_0_0_rgb(139,92,246)] dark:bg-violet-900/20"
                    : isHighlighted
                      ? "bg-blue-50/50 shadow-[inset_3px_0_0_0_rgb(59,130,246)] dark:bg-blue-900/20"
                      : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30",
                  isDisabled && "opacity-50"
                )}
              >
                {/* Checkbox for select mode */}
                {isSelectMode && (
                  <TableCell className="pl-4" onClick={handleCheckboxClick}>
                    <Checkbox
                      checked={questionIsSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => toggleSelection(question._id)}
                      className="cursor-pointer"
                    />
                  </TableCell>
                )}
                <TableCell className="pl-4 font-medium text-gray-500">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <p className="line-clamp-2 font-medium text-gray-900 dark:text-white">
                    {truncateText(question.question, 100)}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("font-medium", getDomainColor(question.domain))}
                  >
                    {truncateText(question.domain, 20)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-gray-600 dark:text-gray-400 md:table-cell">
                  <span className="line-clamp-1">
                    {truncateText(question.objectifCMC, 40)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {hasImages ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-100 px-2 py-1 dark:bg-blue-900/40">
                            <ImageIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {imagesCount}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {imagesCount} image{imagesCount > 1 ? "s" : ""}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-gray-500 lg:table-cell">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          {formatRelativeDate(question._creationTime)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {new Date(question._creationTime).toLocaleDateString(
                            "fr-CA",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                {/* Preview button */}
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-gray-600"
                          onClick={(e) => handlePreviewClick(e, question._id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Prévisualiser</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Load More */}
      {canLoadMore && (
        <div className="flex justify-center border-t border-gray-100 p-4 dark:border-gray-800">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Charger plus de questions
          </Button>
        </div>
      )}
    </div>
  )
}
