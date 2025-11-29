"use client"

import { Download, FileSpreadsheet, FileText } from "lucide-react"
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
import { Doc } from "@/convex/_generated/dataModel"

interface ExportUsersButtonProps {
  users: Doc<"users">[]
}

export const ExportUsersButton = ({ users }: ExportUsersButtonProps) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

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
      "Date d'inscription": formatDate(user._creationTime),
      Bio: user.bio || "",
    }))
  }

  const exportToExcel = () => {
    try {
      const data = prepareExportData()
      const worksheet = utils.json_to_sheet(data)

      // Définir la largeur des colonnes
      const columnWidths = [
        { wch: 25 }, // Nom
        { wch: 20 }, // Nom d'utilisateur
        { wch: 30 }, // Email
        { wch: 15 }, // Rôle
        { wch: 18 }, // Date d'inscription
        { wch: 40 }, // Bio
      ]
      worksheet["!cols"] = columnWidths

      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, "Utilisateurs")

      const fileName = `utilisateurs_${formatDateTime()}.xlsx`
      writeFile(workbook, fileName)
    } catch (error) {
      console.error("Erreur lors de l'export Excel:", error)
    }
  }

  const exportToCSV = () => {
    try {
      const data = prepareExportData()

      // Créer l'en-tête CSV
      const headers = Object.keys(data[0])
      const csvContent = [
        headers.join(";"),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              // Échapper les guillemets et entourer de guillemets si nécessaire
              return typeof value === "string" && value.includes(";")
                ? `"${value.replace(/"/g, '""')}"`
                : value
            })
            .join(";"),
        ),
      ].join("\n")

      // Ajouter le BOM UTF-8 pour Excel
      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      })

      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `utilisateurs_${formatDateTime()}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
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
