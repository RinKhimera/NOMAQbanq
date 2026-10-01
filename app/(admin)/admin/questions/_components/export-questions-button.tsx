"use client"

import { Download, FileBraces, FileSpreadsheet, FileText } from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"
import { loadQuestionsForExport } from "@/features/questions/actions"
import type {
  QuestionExportRow as ExportQuestion,
  QuestionSelection,
} from "@/features/questions/dal"
import {
  downloadBlob,
  downloadCsv,
  exportRowsToXlsx,
  timestampedFilename,
} from "@/lib/export"
import { formatShortDate } from "@/lib/format"
import { questionsCsvLines } from "./questions-csv"

interface ExportQuestionsButtonProps {
  selection: QuestionSelection
  questionCount?: number
}

export function ExportQuestionsButton({
  selection,
  questionCount,
}: ExportQuestionsButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const fetchAndExport = async (format: "csv" | "json" | "xlsx") => {
    setIsExporting(true)
    try {
      const questions = await loadQuestionsForExport(selection)

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
    downloadCsv(
      questionsCsvLines(questions),
      timestampedFilename("questions-export", "csv"),
    )
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
      "Clé de réponse": q.correctAnswer,
      Explication: q.explanation,
      Domaine: q.domain,
      "Objectif CMC": q.objectifCMC,
      Références: q.references.join("; "),
      "Avec images": q.hasImages ? "Oui" : "Non",
      "Nombre d'images": q.imagesCount,
      "Date de création": formatShortDate(q.createdAt),
      "Réussite (%)": q.successRate ?? "",
      Réponses: q.answerCount,
    }))

    exportRowsToXlsx(data, {
      sheetName: "Questions",
      filename: timestampedFilename("questions-export", "xlsx"),
      colWidths: [
        30, 50, 30, 30, 30, 30, 30, 30, 50, 20, 15, 40, 12, 15, 18, 12, 10,
      ],
    })
    toast.success(`${questions.length} questions exportées en Excel`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? <Spinner size="sm" /> : <Download aria-hidden />}
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
          <FileSpreadsheet aria-hidden className="text-ink-3 size-4" />
          <div className="flex flex-col">
            <span className="font-medium">Excel (XLSX)</span>
            <span className="text-ink-3 text-xs">
              {questionCount ?? "…"} question
              {(questionCount ?? 0) > 1 ? "s" : ""} selon les filtres
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => fetchAndExport("csv")}
          className="gap-2"
        >
          <FileText aria-hidden className="text-ink-3 size-4" />
          <div className="flex flex-col">
            <span className="font-medium">CSV</span>
            <span className="text-ink-3 text-xs">Compatible tous tableurs</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => fetchAndExport("json")}
          className="gap-2"
        >
          <FileBraces aria-hidden className="text-ink-3 size-4" />
          <div className="flex flex-col">
            <span className="font-medium">JSON</span>
            <span className="text-ink-3 text-xs">Format structuré</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
