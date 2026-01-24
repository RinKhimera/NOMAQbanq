"use client"

import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowDown, ArrowUp, ArrowUpDown, ImageIcon, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { QuestionsTableSkeleton } from "./questions-table-skeleton"

export type SortBy = "_creationTime" | "question" | "domain" | "objectifCMC"
export type SortOrder = "asc" | "desc"

export interface QuestionRow {
  _id: Id<"questions">
  _creationTime: number
  question: string
  domain: string
  objectifCMC: string
  options: string[]
  images?: Array<{
    url: string
    storagePath: string
    order: number
  }>
}

interface QuestionsTableProps {
  questions: QuestionRow[]
  selectedQuestionId: Id<"questions"> | null
  onQuestionSelect: (question: QuestionRow) => void
  sortBy: SortBy
  sortOrder: SortOrder
  onSort: (field: SortBy) => void
  isLoading?: boolean
  canLoadMore: boolean
  onLoadMore: () => void
  isLoadingMore?: boolean
}

// Color mapping for domains
const domainColors: Record<string, string> = {
  "Cardiologie": "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  "Neurologie": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "Pédiatrie": "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  "Chirurgie": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "Psychiatrie": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  "Gynécologie obstétrique": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "Gastro-entérologie": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Gastroentérologie": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Pneumologie": "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  "Néphrologie": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  "Endocrinologie": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "Infectiologie": "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  "Hémato-oncologie": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "Rhumatologie": "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "Dermatologie": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Ophtalmologie": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "ORL": "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  "Urologie": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Orthopédie": "bg-stone-100 text-stone-800 dark:bg-stone-900/40 dark:text-stone-300",
  "Anesthésie-Réanimation": "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  "Médecine interne": "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300",
  "Santé publique et médecine préventive": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Autres": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

function getDomainColor(domain: string): string {
  return domainColors[domain] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + "..."
}

export function QuestionsTable({
  questions,
  selectedQuestionId,
  onQuestionSelect,
  sortBy,
  sortOrder,
  onSort,
  isLoading,
  canLoadMore,
  onLoadMore,
  isLoadingMore,
}: QuestionsTableProps) {
  const getSortIcon = (field: SortBy) => {
    if (sortBy !== field)
      return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
    return sortOrder === "asc" ? (
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

  if (isLoading) {
    return <QuestionsTableSkeleton />
  }

  if (questions.length === 0) {
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

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[50px] pl-4">#</TableHead>
            <TableHead className="min-w-[300px]">
              <Button
                variant="ghost"
                onClick={() => onSort("question")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Question
                {getSortIcon("question")}
              </Button>
            </TableHead>
            <TableHead className="w-[150px]">
              <Button
                variant="ghost"
                onClick={() => onSort("domain")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Domaine
                {getSortIcon("domain")}
              </Button>
            </TableHead>
            <TableHead className="hidden w-[180px] md:table-cell">
              <Button
                variant="ghost"
                onClick={() => onSort("objectifCMC")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Objectif CMC
                {getSortIcon("objectifCMC")}
              </Button>
            </TableHead>
            <TableHead className="w-[80px] text-center">Images</TableHead>
            <TableHead className="hidden w-[120px] lg:table-cell">
              <Button
                variant="ghost"
                onClick={() => onSort("_creationTime")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Créée
                {getSortIcon("_creationTime")}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((question, index) => {
            const hasImages = question.images && question.images.length > 0
            const imagesCount = question.images?.length || 0

            return (
              <TableRow
                key={question._id}
                onClick={() => onQuestionSelect(question)}
                className={cn(
                  "cursor-pointer transition-all duration-150",
                  selectedQuestionId === question._id
                    ? "border-l-2 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                )}
              >
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
            onClick={onLoadMore}
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
