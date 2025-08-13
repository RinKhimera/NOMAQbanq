"use client"

import { useMutation, useQuery } from "convex/react"
import { FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ExamBulkDeleteModal } from "@/components/admin/modals/exam-bulk-delete-modal"
import { ExamDeactivateModal } from "@/components/admin/modals/exam-deactivate-modal"
import { ExamDeleteModal } from "@/components/admin/modals/exam-delete-modal"
import { ExamEditModal } from "@/components/admin/modals/exam-edit-modal"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ExamStatus, getExamStatus } from "@/lib/exam-status"
import { ExamBulkActions } from "./exam-bulk-actions"
import { createExamColumns } from "./exam-columns"
import { ExamStatusFilter } from "./exam-status-filter"

export function ExamsList() {
  const router = useRouter()
  const isMobile = useMediaQuery("(max-width: 768px)")

  // États des modales
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)

  // États des données
  const [selectedExam, setSelectedExam] = useState<Doc<"exams"> | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<ExamStatus[]>([])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  // Convex queries et mutations
  const exams = useQuery(api.exams.getAllExams)
  const deactivateExam = useMutation(api.exams.deactivateExam)
  const reactivateExam = useMutation(api.exams.reactivateExam)
  const deleteExam = useMutation(api.exams.deleteExam)

  // Filtrage des examens par statut
  const filteredExams = useMemo(() => {
    if (!exams) return []
    if (selectedStatuses.length === 0) return exams

    return exams.filter((exam) => {
      const status = getExamStatus(exam)
      return selectedStatuses.includes(status)
    })
  }, [exams, selectedStatuses])

  // Gestion des examens sélectionnés
  const selectedExams = useMemo(() => {
    return filteredExams.filter((_, index) => rowSelection[index.toString()])
  }, [filteredExams, rowSelection])

  // Handlers pour les actions
  const handleDeactivate = async (exam: Doc<"exams">) => {
    const status = getExamStatus(exam)
    if (status === "active") {
      setSelectedExam(exam)
      setShowDeactivateDialog(true)
    } else {
      await performDeactivate(exam._id)
    }
  }

  const performDeactivate = async (examId: Id<"exams">) => {
    try {
      await deactivateExam({ examId })
      toast.success("Examen désactivé avec succès")
      setShowDeactivateDialog(false)
      setSelectedExam(null)
      setRowSelection({})
    } catch {
      toast.error("Erreur lors de la désactivation")
    }
  }

  const handleReactivate = async (examId: Id<"exams">) => {
    try {
      await reactivateExam({ examId })
      toast.success("Examen réactivé avec succès")
      setRowSelection({})
    } catch {
      toast.error("Erreur lors de la réactivation")
    }
  }

  const handleEdit = (exam: Doc<"exams">) => {
    const status = getExamStatus(exam)
    if (status === "active") {
      setSelectedExam(exam)
      setShowEditDialog(true)
    } else {
      router.push(`/admin/exams/edit/${exam._id}`)
    }
  }

  const handleDelete = (exam: Doc<"exams">) => {
    setSelectedExam(exam)
    setShowDeleteDialog(true)
  }

  const performDelete = async (examId: Id<"exams">) => {
    try {
      await deleteExam({ examId })
      toast.success("Examen supprimé avec succès")
      setShowDeleteDialog(false)
      setSelectedExam(null)
      setRowSelection({})
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true)
  }

  const performBulkDelete = async () => {
    try {
      // Ici, vous devrez implémenter la logique de suppression en masse
      // Pour l'instant, on supprime un par un
      for (const exam of selectedExams) {
        await deleteExam({ examId: exam._id })
      }
      toast.success(`${selectedExams.length} examen(s) supprimé(s) avec succès`)
      setShowBulkDeleteDialog(false)
      setRowSelection({})
    } catch {
      toast.error("Erreur lors de la suppression en masse")
    }
  }

  // Création des colonnes
  const columns = createExamColumns(
    handleDeactivate,
    handleReactivate,
    handleEdit,
    handleDelete,
    isMobile,
  )

  // États de chargement
  if (!exams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chargement...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  // État vide
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
          onClick: () => router.push("/admin/exams/create"),
        }}
      />
    )
  }

  return (
    <Card className="bg-white dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-blue-600 dark:text-white">
          Liste des examens
        </CardTitle>
        <CardDescription>
          Gérez tous vos examens depuis cette interface
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={filteredExams}
          searchPlaceholder="Rechercher par titre..."
          searchKey="title"
          showColumnToggle={!isMobile}
          showPagination={true}
          pageSize={10}
          isMobile={isMobile}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        >
          <ExamStatusFilter
            selectedStatuses={selectedStatuses}
            onStatusChange={setSelectedStatuses}
          />
          <ExamBulkActions
            selectedExams={selectedExams}
            onBulkDelete={handleBulkDelete}
            isVisible={selectedExams.length > 1}
          />
        </DataTable>
      </CardContent>

      {/* Modales */}
      <ExamDeactivateModal
        exam={selectedExam}
        isOpen={showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(false)}
        onConfirm={() => selectedExam && performDeactivate(selectedExam._id)}
        isLoading={false}
      />

      <ExamEditModal
        exam={selectedExam}
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onConfirm={() => {
          if (selectedExam) {
            router.push(`/admin/exams/edit/${selectedExam._id}`)
          }
        }}
      />

      <ExamDeleteModal
        exam={selectedExam}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => selectedExam && performDelete(selectedExam._id)}
        isLoading={false}
      />

      <ExamBulkDeleteModal
        exams={selectedExams}
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={performBulkDelete}
        isLoading={false}
      />
    </Card>
  )
}
