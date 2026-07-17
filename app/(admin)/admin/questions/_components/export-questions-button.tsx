"use client"

import {
  Download,
  FileBraces,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { loadQuestionsForExport } from "@/features/questions/actions"
import type { QuestionExportRow as ExportQuestion } from "@/features/questions/dal"
import {
  csvQuote,
  downloadBlob,
  downloadCsv,
  exportRowsToXlsx,
  timestampedFilename,
} from "@/lib/export"
import { formatShortDate } from "@/lib/format"

interface ExportQuestionsButtonProps {
  searchQuery?: string
  domain?: string
  hasImages?: boolean
  questionCount?: number
}

export function ExportQuestionsButton({
  searchQuery,
  domain,
  hasImages,
  questionCount,
}: ExportQuestionsButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const fetchAndExport = async (format: "csv" | "json" | "xlsx") => {
    setIsExporting(true)
    try {
      const questions = await loadQuestionsForExport({
        search: searchQuery || undefined,
        domain: domain === "all" ? undefined : domain,
        hasImages,
      })

      if (questions.length === 0) {
        toast.error("Aucune question à exporter")
        return
      }

      switch (format) {
        case "csv":
          exportAsCSV(questions)
          break
        case "json":
          exportAsJSON(questions)
          break
        case "xlsx":
          exportAsXLSX(questions)
          break
      }
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erreur lors de l'export")
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsCSV = (questions: ExportQuestion[]) => {
    const headers = [
      "ID",
      "Question",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Option E",
      "Réponse correcte",
      "Explication",
      "Domaine",
      "Objectif CMC",
      "Références",
      "Avec images",
      "Nombre d'images",
      "Date de création",
    ]

    const rows = questions.map((q) => [
      q.id,
      csvQuote(q.question),
      q.options[0] ? csvQuote(q.options[0]) : "",
      q.options[1] ? csvQuote(q.options[1]) : "",
      q.options[2] ? csvQuote(q.options[2]) : "",
      q.options[3] ? csvQuote(q.options[3]) : "",
      q.options[4] ? csvQuote(q.options[4]) : "",
      csvQuote(q.correctAnswer),
      csvQuote(q.explanation),
      q.domain,
      q.objectifCMC,
      csvQuote(q.references.join("; ")),
      q.hasImages ? "Oui" : "Non",
      q.imagesCount,
      new Date(q.createdAt).toISOString(),
    ])

    const lines = [headers.join(","), ...rows.map((row) => row.join(","))]

    downloadCsv(lines, timestampedFilename("questions-export", "csv"))
    toast.success(`${questions.length} questions exportées en CSV`)
  }

  const exportAsJSON = (questions: ExportQuestion[]) => {
    const jsonContent = JSON.stringify(questions, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json" })

    downloadBlob(blob, timestampedFilename("questions-export", "json"))
    toast.success(`${questions.length} questions exportées en JSON`)
  }

  const exportAsXLSX = (questions: ExportQuestion[]) => {
    const data = questions.map((q) => ({
      ID: q.id,
      Question: q.question,
      "Option A": q.options[0] || "",
      "Option B": q.options[1] || "",
      "Option C": q.options[2] || "",
      "Option D": q.options[3] || "",
      "Option E": q.options[4] || "",
      "Réponse correcte": q.correctAnswer,
      Explication: q.explanation,
      Domaine: q.domain,
      "Objectif CMC": q.objectifCMC,
      Références: q.references.join("; "),
      "Avec images": q.hasImages ? "Oui" : "Non",
      "Nombre d'images": q.imagesCount,
      "Date de création": formatShortDate(q.createdAt),
    }))

    exportRowsToXlsx(data, {
      sheetName: "Questions",
      filename: timestampedFilename("questions-export", "xlsx"),
      colWidths: [30, 50, 30, 30, 30, 30, 30, 30, 50, 20, 15, 40, 12, 15, 18],
    })
    toast.success(`${questions.length} questions exportées en Excel`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isExporting}>
          {isExporting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Format d&apos;export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => fetchAndExport("xlsx")}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <div className="flex flex-col">
            <span className="font-medium">Excel (XLSX)</span>
            <span className="text-muted-foreground text-xs">
              {questionCount ?? "..."} question
              {(questionCount ?? 0) > 1 ? "s" : ""}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => fetchAndExport("csv")}
          className="gap-2"
        >
          <FileText className="h-4 w-4 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium">CSV</span>
            <span className="text-muted-foreground text-xs">
              Compatible tous tableurs
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => fetchAndExport("json")}
          className="gap-2"
        >
          <FileBraces className="h-4 w-4 text-amber-600" />
          <div className="flex flex-col">
            <span className="font-medium">JSON</span>
            <span className="text-muted-foreground text-xs">
              Format structuré
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
