"use client"

import { FileText, Plus, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import {
  deactivateExam,
  deleteExam,
  reactivateExam,
} from "@/features/exams/actions"
import type { AdminExamListItem } from "@/features/exams/dal"
import { currentTimeMs } from "@/lib/clock"
import { phaseOf } from "@/lib/exam-phase"
import type { ExamStatus } from "@/lib/exam-status"
import { callAction } from "@/lib/safe-action"
import { ExamCard } from "./exam-card"
import { ExamStatusFilter } from "./exam-status-filter"

interface ExamsListProps {
  exams: AdminExamListItem[]
  now: number
  onExamSelect?: (examId: string) => void
}

export function ExamsList({ exams, now, onExamSelect }: ExamsListProps) {
  const router = useRouter()

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [selectedExam, setSelectedExam] = useState<AdminExamListItem | null>(
    null,
  )
  const [selectedStatuses, setSelectedStatuses] = useState<ExamStatus[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const filteredExams = useMemo(() => {
    let result = exams

    if (selectedStatuses.length > 0) {
      result = result.filter((exam) =>
        selectedStatuses.includes(phaseOf(exam, now)),
      )
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (exam) =>
          exam.title.toLowerCase().includes(query) ||
          exam.description?.toLowerCase().includes(query),
      )
    }

    return result
  }, [exams, now, selectedStatuses, searchQuery])

  // Les gardes d'édition et de désactivation lisent l'horloge AU CLIC : le
  // `now` de rendu (tick de 60 s) sert à l'affichage, pas à une confirmation.
  const handleDeactivate = async (exam: AdminExamListItem) => {
    if (phaseOf(exam, currentTimeMs()) === "active") {
      setSelectedExam(exam)
      setShowDeactivateDialog(true)
    } else {
      await performDeactivate(exam.id)
    }
  }

  const performDeactivate = async (examId: string) => {
    const res = await callAction(() => deactivateExam({ examId }))
    if (!res.success) {
      toast.error(res.error ?? "Erreur lors de la désactivation")
      return false
    }
    toast.success("Examen désactivé avec succès")
    router.refresh()
  }

  const handleReactivate = async (examId: string) => {
    const res = await callAction(() => reactivateExam({ examId }))
    if (res.success) {
      toast.success("Examen réactivé avec succès")
      router.refresh()
    } else {
      toast.error(res.error ?? "Erreur lors de la réactivation")
    }
  }

  const handleEdit = (exam: AdminExamListItem) => {
    if (phaseOf(exam, currentTimeMs()) === "active") {
      setSelectedExam(exam)
      setShowEditDialog(true)
    } else {
      router.push(`/admin/examens/modifier/${exam.id}`)
    }
  }

  const handleDelete = (exam: AdminExamListItem) => {
    setSelectedExam(exam)
    setShowDeleteDialog(true)
  }

  const performDelete = async (examId: string) => {
    const res = await callAction(() => deleteExam({ examId }))
    if (!res.success) {
      toast.error(res.error ?? "Erreur lors de la suppression")
      return false
    }
    toast.success("Examen supprimé avec succès")
    router.refresh()
  }

  if (exams.length === 0) {
    return (
      <EmptyState
        className="max-w-full bg-white dark:bg-gray-900"
        title="Aucun examen"
        description="Aucun examen n'a été créé pour le moment."
        icons={[FileText]}
        iconClassName="bg-white dark:bg-gray-900"
        action={{
          label: "Créer un examen",
          onClick: () => router.push("/admin/examens/creer"),
        }}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-blue-600">Liste des examens</CardTitle>
            <CardDescription>
              Gérez tous vos examens depuis cette interface
            </CardDescription>
          </div>
          <Button onClick={() => router.push("/admin/examens/creer")}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un examen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtres */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par titre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ExamStatusFilter
            selectedStatuses={selectedStatuses}
            onStatusChange={setSelectedStatuses}
          />
        </div>

        {/* Grille de cards */}
        {filteredExams.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Aucun examen ne correspond à vos critères de recherche.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filteredExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                now={now}
                onView={onExamSelect}
                onDeactivate={handleDeactivate}
                onReactivate={handleReactivate}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Compteur de résultats */}
        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {filteredExams.length} examen{filteredExams.length > 1 ? "s" : ""}{" "}
          affiché{filteredExams.length > 1 ? "s" : ""}
          {selectedStatuses.length > 0 || searchQuery
            ? ` sur ${exams.length}`
            : ""}
        </div>
      </CardContent>

      <ConfirmDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        title="Désactiver l'examen en cours"
        description={
          <>
            Des étudiants pourraient déjà être en train de passer cet examen. La
            désactivation interrompra immédiatement l&apos;accès à l&apos;examen
            pour tous les utilisateurs. Désactiver{" "}
            <strong>&quot;{selectedExam?.title}&quot;</strong> ?
          </>
        }
        confirmLabel="Désactiver l'examen"
        pendingLabel="Désactivation..."
        variant="destructive"
        onConfirm={() => selectedExam && performDeactivate(selectedExam.id)}
      />

      <ConfirmDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="Modifier l'examen en cours"
        description={
          <>
            Des étudiants pourraient déjà être en train de passer cet examen. Le
            modifier pendant qu&apos;il est en cours peut affecter
            l&apos;expérience des utilisateurs. Modifier{" "}
            <strong>&quot;{selectedExam?.title}&quot;</strong> ?
          </>
        }
        confirmLabel="Continuer la modification"
        onConfirm={() => {
          if (selectedExam) {
            router.push(`/admin/examens/modifier/${selectedExam.id}`)
          }
        }}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Supprimer l'examen"
        description={
          <>
            L&apos;examen &quot;{selectedExam?.title}&quot; et toutes ses
            données (participants, résultats, etc.) seront définitivement
            supprimés. Cette action est irréversible.
          </>
        }
        confirmLabel="Supprimer définitivement"
        pendingLabel="Suppression..."
        variant="destructive"
        onConfirm={() => selectedExam && performDelete(selectedExam.id)}
      />
    </Card>
  )
}
