"use client"

import { Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEDICAL_DOMAINS } from "@/constants"
import { cn } from "@/lib/utils"
import { useQuestionBrowser } from "./question-browser-context"
import { ImageFilter, QuestionBrowserToolbarProps } from "./types"

export function QuestionBrowserToolbar({
  className,
}: QuestionBrowserToolbarProps) {
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    isSearching,
  } = useQuestionBrowser()

  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-gray-900",
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
          ) : (
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          )}
          <Input
            type="text"
            placeholder="Rechercher dans les questions ou objectifs CMC..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter("searchQuery", e.target.value)}
            className="h-10 pl-10 pr-4"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Domain filter */}
          <Select
            value={filters.domain}
            onValueChange={(value) => updateFilter("domain", value)}
          >
            <SelectTrigger className="h-10 w-50">
              <SelectValue placeholder="Domaine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les domaines</SelectItem>
              {MEDICAL_DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Image filter */}
          <Select
            value={filters.hasImages}
            onValueChange={(v) => updateFilter("hasImages", v as ImageFilter)}
          >
            <SelectTrigger className="h-10 w-40">
              <SelectValue placeholder="Images" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les questions</SelectItem>
              <SelectItem value="with">Avec images</SelectItem>
              <SelectItem value="without">Sans images</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-10 gap-1.5 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              Effacer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
