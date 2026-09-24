"use client"

import { Eye, Image as ImageIcon } from "lucide-react"
import { TablePagination } from "@/components/admin/table-pagination"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { RelativeTime } from "@/components/shared/relative-time"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatLongDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useQuestionBrowser } from "./question-browser-context"
import { QuestionBrowserTableProps, QuestionRow, SortBy } from "./types"
import { getDomainColor, truncateText } from "./utils"

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

function ImagesCell({ count }: { count: number }) {
  if (count === 0)
    return <span className="text-gray-300 dark:text-gray-600">—</span>
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-100 px-2 py-1 dark:bg-blue-900/40">
            <ImageIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {count}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {count} image{count > 1 ? "s" : ""}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SuccessRateCell({ question }: { question: QuestionRow }) {
  if (question.successRate === null) {
    return (
      <span
        className="text-gray-400 dark:text-gray-500"
        title={`${question.answerCount} réponse${question.answerCount > 1 ? "s" : ""}`}
      >
        Données insuffisantes
      </span>
    )
  }
  return (
    <span className="flex flex-col items-center">
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        {question.successRate} %
      </span>
      <span className="text-gray-500">{question.answerCount} rép.</span>
    </span>
  )
}

function PreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Prévisualiser la question"
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Prévisualiser</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function QuestionBrowserTable({ className }: QuestionBrowserTableProps) {
  const {
    questions,
    isLoading,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
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
  // Sous « À vérifier » sans tri par réussite, la DAL trie par nombre de
  // réponses : la date n'est plus un tri disponible.
  const sortedByAnswerCount =
    filters.toVerify && filters.sortBy !== "successRate"

  const sortOf = (field: SortBy, disabledReason?: string) => ({
    direction: filters.sortBy === field ? filters.sortOrder : null,
    onToggle: () => handleSort(field),
    disabledReason,
  })

  const isRowDisabled = (question: QuestionRow) =>
    !isSelected(question._id) && isQuotaReached

  const selectColumn: DataTableColumn<QuestionRow> = {
    id: "select",
    label: "Sélection",
    header: <span className="sr-only">Sélection</span>,
    required: true,
    className: "w-12.5 pl-4",
    cell: (question) => (
      <Checkbox
        checked={isSelected(question._id)}
        disabled={isRowDisabled(question)}
        onCheckedChange={() => toggleSelection(question._id)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Sélectionner la question"
        className="cursor-pointer"
      />
    ),
  }

  // Seules la date et la réussite sont triables côté DAL — pas d'indicateur
  // trompeur sur les autres colonnes.
  const columns: DataTableColumn<QuestionRow>[] = [
    ...(isSelectMode ? [selectColumn] : []),
    {
      id: "question",
      label: "Question",
      required: true,
      className: cn("whitespace-normal", !isSelectMode && "pl-4"),
      cell: (question) => (
        <p className="line-clamp-2 max-w-105 min-w-28 font-medium wrap-anywhere hyphens-auto text-gray-900 dark:text-white">
          {question.question}
        </p>
      ),
    },
    {
      id: "domain",
      label: "Domaine",
      visibleFrom: "medium",
      cell: (question) => (
        <Badge
          variant="secondary"
          className={cn("font-medium", getDomainColor(question.domain))}
        >
          {truncateText(question.domain, 20)}
        </Badge>
      ),
    },
    {
      id: "objectifCMC",
      label: "Objectif CMC",
      visibleFrom: isSelectMode ? "never" : "wide",
      className: "whitespace-normal",
      cellClassName: "text-gray-600 dark:text-gray-400",
      cell: (question) => (
        <span className="line-clamp-2 max-w-60 min-w-32">
          {question.objectifCMC}
        </span>
      ),
    },
    {
      id: "images",
      label: "Images",
      visibleFrom: "wide",
      className: "text-center",
      cell: (question) => <ImagesCell count={question.imageCount} />,
    },
    {
      id: "usage",
      label: "Utilisée",
      visibleFrom: "medium",
      className: "text-center",
      cell: (question) =>
        question.usageCount > 0 ? (
          <Badge
            variant="secondary"
            className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          >
            {question.usageCount} examen{question.usageCount > 1 ? "s" : ""}
          </Badge>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        ),
    },
    {
      id: "successRate",
      label: "Réussite",
      className: "text-center whitespace-normal",
      cellClassName: "text-xs",
      sort: sortOf("successRate"),
      cell: (question) => (
        <div data-testid="success-rate">
          <SuccessRateCell question={question} />
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Créée",
      visibleFrom: isSelectMode ? "never" : "wide",
      cellClassName: "text-gray-500",
      sort: sortOf(
        "createdAt",
        sortedByAnswerCount
          ? "Sous « À vérifier », triées par nombre de réponses"
          : undefined,
      ),
      cell: (question) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <RelativeTime timestamp={question._creationTime} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{formatLongDateTime(question._creationTime)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
  ]

  return (
    <DataTable
      className={className}
      columns={columns}
      rows={questions}
      getRowId={(question) => question._id}
      preferencesKey={`question-browser:${mode}`}
      isLoading={isLoading}
      empty={<EmptyState />}
      onRowClick={(question) =>
        isSelectMode
          ? toggleSelection(question._id)
          : setPreviewQuestionId(question._id)
      }
      rowTone={(question) => {
        if (isSelectMode && isSelected(question._id)) return "selected"
        if (previewQuestionId === question._id) return "active"
        return undefined
      }}
      isRowDisabled={isRowDisabled}
      action={{
        label: "Prévisualiser",
        cell: (question) => (
          <PreviewButton onClick={() => setPreviewQuestionId(question._id)} />
        ),
      }}
      footer={
        total > 0 && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isLoading={isLoading}
            itemNoun={{ one: "question", many: "questions" }}
          />
        )
      }
    />
  )
}
