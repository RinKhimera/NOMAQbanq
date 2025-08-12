"use client"

import { Circle, Filter } from "lucide-react"
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
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          FIltrer par statut
          {selectedStatuses.length > 0 && (
            <Circle className="h-2 w-2 fill-current" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <div className="flex items-center justify-between p-2">
          <span className="text-sm font-medium">Filtrer par statut</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 px-2 text-xs"
            >
              Tout
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs"
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
              className="flex items-center gap-2"
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
