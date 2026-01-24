"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
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

interface ExportQuestionsButtonProps {
  searchQuery?: string
  domain?: string
  hasImages?: boolean
}

export function ExportQuestionsButton({
  searchQuery,
  domain,
  hasImages,
}: ExportQuestionsButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const questions = useQuery(api.questions.getAllQuestionsForExport, {
    searchQuery: searchQuery || undefined,
    domain: domain === "all" ? undefined : domain,
    hasImages,
  })

  const exportAsCSV = () => {
    if (!questions || questions.length === 0) {
      toast.error("Aucune question à exporter")
      return
    }

    setIsExporting(true)

    try {
      // CSV Headers
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

      // CSV Rows
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

      // Build CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n")

      // Add BOM for Excel UTF-8 compatibility
      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      })

      // Download
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `questions-export-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`${questions.length} questions exportées en CSV`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erreur lors de l'export")
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsJSON = () => {
    if (!questions || questions.length === 0) {
      toast.error("Aucune question à exporter")
      return
    }

    setIsExporting(true)

    try {
      const jsonContent = JSON.stringify(questions, null, 2)
      const blob = new Blob([jsonContent], { type: "application/json" })

      // Download
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `questions-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`${questions.length} questions exportées en JSON`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erreur lors de l'export")
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsXLSX = () => {
    if (!questions || questions.length === 0) {
      toast.error("Aucune question à exporter")
      return
    }

    setIsExporting(true)

    try {
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
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }
        ),
      }))

      const worksheet = utils.json_to_sheet(data)

      // Largeurs de colonnes
      worksheet["!cols"] = [
        { wch: 30 }, // ID
        { wch: 50 }, // Question
        { wch: 30 }, // Option A
        { wch: 30 }, // Option B
        { wch: 30 }, // Option C
        { wch: 30 }, // Option D
        { wch: 30 }, // Option E
        { wch: 30 }, // Réponse correcte
        { wch: 50 }, // Explication
        { wch: 20 }, // Domaine
        { wch: 15 }, // Objectif CMC
        { wch: 40 }, // Références
        { wch: 12 }, // Avec images
        { wch: 15 }, // Nombre d'images
        { wch: 18 }, // Date de création
      ]

      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, "Questions")

      const fileName = `questions-export-${new Date().toISOString().split("T")[0]}.xlsx`
      writeFile(workbook, fileName)

      toast.success(`${questions.length} questions exportées en Excel`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erreur lors de l'export")
    } finally {
      setIsExporting(false)
    }
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
        <DropdownMenuItem onClick={exportAsXLSX} className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <div className="flex flex-col">
            <span className="font-medium">Excel (XLSX)</span>
            <span className="text-muted-foreground text-xs">
              {questions?.length ?? 0} question{(questions?.length ?? 0) > 1 ? "s" : ""}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsCSV} className="gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium">CSV</span>
            <span className="text-muted-foreground text-xs">
              Compatible tous tableurs
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsJSON} className="gap-2">
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
