"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsJSON} className="gap-2">
          <FileJson className="h-4 w-4" />
          Export JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
