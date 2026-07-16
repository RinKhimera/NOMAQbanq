"use client"

import { Download, FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExportUser } from "@/features/users/dal"
import { csvQuote, downloadCsv, exportRowsToXlsx } from "@/lib/export"
import { formatShortDate } from "@/lib/format"

interface ExportUsersButtonProps {
  users: ExportUser[]
}

export const ExportUsersButton = ({ users }: ExportUsersButtonProps) => {
  const formatDateTime = () => {
    const now = new Date()
    return now
      .toLocaleString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/[/:]/g, "-")
      .replace(", ", "_")
  }

  const prepareExportData = () => {
    return users.map((user) => ({
      Nom: user.name,
      "Nom d'utilisateur": user.username || "N/A",
      Email: user.email,
      Rôle: user.role === "admin" ? "Administrateur" : "Étudiant",
      "Date d'inscription": formatShortDate(user.createdAt),
      Bio: user.bio || "",
    }))
  }

  const exportToExcel = () => {
    try {
      const data = prepareExportData()
      exportRowsToXlsx(data, {
        sheetName: "Utilisateurs",
        filename: `utilisateurs_${formatDateTime()}.xlsx`,
        colWidths: [25, 20, 30, 15, 18, 40], // Nom, Nom d'utilisateur, Email, Rôle, Date d'inscription, Bio
      })
    } catch (error) {
      console.error("Erreur lors de l'export Excel:", error)
    }
  }

  const exportToCSV = () => {
    try {
      const data = prepareExportData()

      const headers = Object.keys(data[0])
      const lines = [
        headers.join(";"),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              // Échapper les guillemets et entourer de guillemets si nécessaire
              return typeof value === "string" && value.includes(";")
                ? csvQuote(value)
                : value
            })
            .join(";"),
        ),
      ]

      downloadCsv(lines, `utilisateurs_${formatDateTime()}.csv`)
    } catch (error) {
      console.error("Erreur lors de l'export CSV:", error)
    }
  }

  if (!users || users.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Format d&apos;export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <div className="flex flex-col">
            <span className="font-medium">Excel (XLSX)</span>
            <span className="text-muted-foreground text-xs">
              {users.length} utilisateur{users.length > 1 ? "s" : ""}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV} className="gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium">CSV</span>
            <span className="text-muted-foreground text-xs">
              Compatible tous tableurs
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
