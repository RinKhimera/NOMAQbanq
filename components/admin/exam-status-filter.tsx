"use client"

import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EXAM_STATUS_CONFIG, ExamStatus } from "@/lib/exam-status"

interface ExamStatusFilterProps {
  selectedStatuses: ExamStatus[]
  onStatusChange: (statuses: ExamStatus[]) => void
}

export function ExamStatusFilter({
  selectedStatuses,
  onStatusChange,
}: ExamStatusFilterProps) {
  const handleStatusToggle = (status: ExamStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const handleSelectAll = () => {
    onStatusChange(Object.keys(EXAM_STATUS_CONFIG) as ExamStatus[])
  }

  const handleClearAll = () => {
    onStatusChange([])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="text-muted-foreground justify-start gap-2 hover:text-blue-700 max-md:w-full dark:hover:text-white"
        >
          <Filter className="h-4 w-4" />
          Filtrer par statut
          {selectedStatuses.length > 0 && (
            <div className="ml-1 flex items-center gap-1">
              {selectedStatuses.map((status) => {
                const cfg = EXAM_STATUS_CONFIG[status]
                // Derive a color from className config
                let bg = "#3b82f6" // default blue
                if (cfg.className.includes("bg-green")) bg = "#10b981"
                else if (cfg.className.includes("bg-gray")) bg = "#6b7280"
                else if (cfg.className.includes("bg-red")) bg = "#ef4444"
                return (
                  <span
                    key={status}
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: bg }}
                  />
                )
              })}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-card w-full">
        <div className="flex items-center justify-between p-2">
          <span className="text-sm font-medium">Filtrer par statut</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 px-2 text-xs hover:text-blue-700"
            >
              Tout
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs hover:text-blue-700"
            >
              Aucun
            </Button>
          </div>
        </div>
        {Object.entries(EXAM_STATUS_CONFIG).map(([status, config]) => {
          const isSelected = selectedStatuses.includes(status as ExamStatus)
          return (
            <DropdownMenuCheckboxItem
              key={status}
              checked={isSelected}
              onCheckedChange={() => handleStatusToggle(status as ExamStatus)}
              className="text-muted-foreground flex items-center gap-2 focus:hover:bg-blue-500/25 focus:hover:text-blue-700 dark:text-white dark:hover:bg-blue-500/20 dark:hover:text-white"
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: config.className.includes("bg-green")
                    ? "#10b981"
                    : config.className.includes("bg-blue")
                      ? "#3b82f6"
                      : config.className.includes("bg-gray")
                        ? "#6b7280"
                        : "#ef4444",
                }}
              />
              {config.label}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
