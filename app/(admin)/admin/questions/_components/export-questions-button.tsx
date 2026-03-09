"use client"

import { useAction } from "convex/react"
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { utils, writeFile } from "xlsx"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api } from "@/convex/_generated/api"

type ExportQuestion = {
  _id: string
  _creationTime: number
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  references: string[]
  objectifCMC: string
  domain: string
  hasImages: boolean
  imagesCount: number
}

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

  const exportQuestions = useAction(api.questions.getAllQuestionsForExport)

  const fetchAndExport = async (format: "csv" | "json" | "xlsx") => {
    setIsExporting(true)
    try {
      const questions = (await exportQuestions({
        searchQuery: searchQuery || undefined,
        domain: domain === "all" ? undefined : domain,
        hasImages,
      })) as ExportQuestion[]

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
      q._id,
      `"${q.question.replace(/"/g, '""')}"`,
      q.options[0] ? `"${q.options[0].replace(/"/g, '""')}"` : "",
      q.options[1] ? `"${q.options[1].replace(/"/g, '""')}"` : "",
      q.options[2] ? `"${q.options[2].replace(/"/g, '""')}"` : "",
      q.options[3] ? `"${q.options[3].replace(/"/g, '""')}"` : "",
      q.options[4] ? `"${q.options[4].replace(/"/g, '""')}"` : "",
      `"${q.correctAnswer.replace(/"/g, '""')}"`,
      `"${q.explanation.replace(/"/g, '""')}"`,
      q.domain,
      q.objectifCMC,
      `"${q.references.join("; ").replace(/"/g, '""')}"`,
      q.hasImages ? "Oui" : "Non",
      q.imagesCount,
      new Date(q._creationTime).toISOString(),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    })

    downloadBlob(blob, `questions-export-${today()}.csv`)
    toast.success(`${questions.length} questions exportées en CSV`)
  }

  const exportAsJSON = (questions: ExportQuestion[]) => {
    const jsonContent = JSON.stringify(questions, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json" })

    downloadBlob(blob, `questions-export-${today()}.json`)
    toast.success(`${questions.length} questions exportées en JSON`)
  }

  const exportAsXLSX = (questions: ExportQuestion[]) => {
    const data = questions.map((q) => ({
      ID: q._id,
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
      "Date de création": new Date(q._creationTime).toLocaleDateString(
        "fr-FR",
        { day: "2-digit", month: "2-digit", year: "numeric" },
      ),
    }))

    const worksheet = utils.json_to_sheet(data)

    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 50 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 50 },
      { wch: 20 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
    ]

    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, "Questions")

    writeFile(workbook, `questions-export-${today()}.xlsx`)
    toast.success(`${questions.length} questions exportées en Excel`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
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
          <FileJson className="h-4 w-4 text-amber-600" />
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

function today() {
  return new Date().toISOString().split("T")[0]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
