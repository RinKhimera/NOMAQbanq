"use client"

import { Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Spinner } from "@/components/ui/spinner"
import { loadUsersForExport } from "@/features/users/actions"
import type { ExportUser, UsersFilters } from "@/features/users/dal"
import { formatFileTimestamp, formatMediumDate } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import type { UserListState } from "./user-params"

const COLUMNS = [
  "Nom",
  "Nom d'utilisateur",
  "Courriel",
  "Rôle",
  "Inscrit le",
  "Accès Examens (expire le)",
  "Accès Entraînement (expire le)",
  "Suspendu",
] as const

const SEGMENT_LABEL = {
  active: "accès actif",
  expiring: "expire bientôt",
  expired: "expiré",
  never: "jamais eu d'accès",
} as const

/** Plafond de `getUsersForExport` (lecture bornée). */
const EXPORT_MAX = 1000

/**
 * Cellule CSV sûre : un nom saisi par un étudiant qui commence par = + - @
 * serait évalué comme formule par un tableur ; `;`, `"` et un saut de ligne
 * casseraient la ligne.
 */
export const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Filtres appliqués, en toutes lettres, pour le résumé du dialogue. */
export const describeFilters = (s: UserListState): string[] =>
  [
    s.segment !== "all" && SEGMENT_LABEL[s.segment],
    s.role !== "all" && (s.role === "admin" ? "administrateurs" : "étudiants"),
    s.suspended && "suspendus",
    s.period !== "all" && "période d'inscription",
    s.q && `« ${s.q} »`,
  ].filter((v): v is string => Boolean(v))

export const exportRow = (
  u: ExportUser,
): Record<(typeof COLUMNS)[number], string> => ({
  Nom: u.name,
  "Nom d'utilisateur": u.username ?? "",
  Courriel: u.email,
  Rôle: u.role === "admin" ? "Administrateur" : "Étudiant",
  "Inscrit le": formatMediumDate(u.createdAt),
  "Accès Examens (expire le)": u.examExpiresAt
    ? formatMediumDate(u.examExpiresAt)
    : "",
  "Accès Entraînement (expire le)": u.trainingExpiresAt
    ? formatMediumDate(u.trainingExpiresAt)
    : "",
  Suspendu: u.banned ? "Oui" : "Non",
})

/** Export XLSX ou CSV des utilisateurs, selon les filtres courants de la liste. */
export const ExportUsersDialog = ({
  open,
  onOpenChange,
  count,
  state,
  filters,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  state: UserListState
  filters: UsersFilters
}) => {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx")
  const [pending, setPending] = useState(false)
  const applied = describeFilters(state)
  const noun = `utilisateur${count > 1 ? "s" : ""}`

  const exportNow = async () => {
    setPending(true)
    const res = await callAction(async () => ({
      success: true as const,
      users: await loadUsersForExport(filters),
    }))
    if (!res.success) {
      setPending(false)
      toast.error("Export impossible. Réessayez.")
      return
    }
    const { downloadCsv, exportRowsToXlsx } = await import("@/lib/export")
    const rows = res.users.map(exportRow)
    const stamp = formatFileTimestamp(new Date())
    if (format === "xlsx") {
      exportRowsToXlsx(rows, {
        sheetName: "Utilisateurs",
        filename: `utilisateurs_${stamp}.xlsx`,
        colWidths: [25, 20, 30, 15, 16, 22, 24, 10],
      })
    } else {
      downloadCsv(
        [
          COLUMNS.join(";"),
          ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(";")),
        ],
        `utilisateurs_${stamp}.csv`,
      )
    }
    setPending(false)
    onOpenChange(false)
    toast.success(`${rows.length} lignes exportées · ${format.toUpperCase()}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>
            Exporter {count} {noun}
          </DialogTitle>
          <DialogDescription>
            {applied.length
              ? `Selon les filtres courants : ${applied.join(", ")}.`
              : "Aucun filtre : toute la base est exportée."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Format</span>
            <SegmentedControl
              label="Format"
              value={format}
              onValueChange={setFormat}
              options={[
                { value: "xlsx", label: "XLSX" },
                { value: "csv", label: "CSV" },
              ]}
            />
          </div>
          {count > EXPORT_MAX && (
            <p className="text-warning-ink text-[0.8125rem]">
              L&apos;export est limité aux {EXPORT_MAX.toLocaleString("fr-CA")}{" "}
              premiers comptes par nom ; affinez les filtres pour le reste.
            </p>
          )}
          <div className="flex flex-col gap-1 text-sm">
            <span className="type-label">Colonnes</span>
            <span className="text-ink-2 text-[0.8125rem] leading-relaxed">
              {COLUMNS.join(", ")}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={count === 0 || pending}
            onClick={exportNow}
          >
            {pending ? <Spinner size="sm" /> : <Download aria-hidden="true" />}
            Exporter en {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
