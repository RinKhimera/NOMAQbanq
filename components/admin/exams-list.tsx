"use client"

import { FileText, Plus, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ExamDeactivateModal } from "@/components/admin/modals/exam-deactivate-modal"
import { ExamDeleteModal } from "@/components/admin/modals/exam-delete-modal"
import { ExamEditModal } from "@/components/admin/modals/exam-edit-modal"
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
import { ExamStatus, getExamStatus } from "@/lib/exam-status"
import { ExamCard } from "./exam-card"
import { ExamStatusFilter } from "./exam-status-filter"

interface ExamsListProps {
  exams: AdminExamListItem[]
  onExamSelect?: (examId: string) => void
}

export function ExamsList({ exams, onExamSelect }: ExamsListProps) {
  const router = useRouter()

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [selectedExam, setSelectedExam] = useState<AdminExamListItem | null>(
    null,
  )
  const [selectedStatuses, setSelectedStatuses] = useState<ExamStatus[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isPending, setIsPending] = useState(false)

  const filteredExams = useMemo(() => {
    let result = exams

    if (selectedStatuses.length > 0) {
      result = result.filter((exam) =>
        selectedStatuses.includes(getExamStatus(exam)),
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
  }, [exams, selectedStatuses, searchQuery])

  const handleDeactivate = async (exam: AdminExamListItem) => {
    if (getExamStatus(exam) === "active") {
      setSelectedExam(exam)
      setShowDeactivateDialog(true)
    } else {
      await performDeactivate(exam.id)
    }
  }

  const performDeactivate = async (examId: string) => {
    setIsPending(true)
    const res = await deactivateExam({ examId })
    setIsPending(false)
    if (res.success) {
      toast.success("Examen désactivé avec succès")
      setShowDeactivateDialog(false)
      setSelectedExam(null)
      router.refresh()
    } else {
      toast.error(res.error ?? "Erreur lors de la désactivation")
    }
  }

  const handleReactivate = async (examId: string) => {
    const res = await reactivateExam({ examId })
    if (res.success) {
      toast.success("Examen réactivé avec succès")
      router.refresh()
    } else {
      toast.error(res.error ?? "Erreur lors de la réactivation")
    }
  }

  const handleEdit = (exam: AdminExamListItem) => {
    if (getExamStatus(exam) === "active") {
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
    setIsPending(true)
    const res = await deleteExam({ examId })
    setIsPending(false)
    if (res.success) {
      toast.success("Examen supprimé avec succès")
      setShowDeleteDialog(false)
      setSelectedExam(null)
      router.refresh()
    } else {
      toast.error(res.error ?? "Erreur lors de la suppression")
    }
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

      {/* Modales */}
      <ExamDeactivateModal
        exam={selectedExam}
        isOpen={showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(false)}
        onConfirm={() => selectedExam && performDeactivate(selectedExam.id)}
        isLoading={isPending}
      />

      <ExamEditModal
        exam={selectedExam}
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onConfirm={() => {
          if (selectedExam) {
            router.push(`/admin/examens/modifier/${selectedExam.id}`)
          }
        }}
      />

      <ExamDeleteModal
        exam={selectedExam}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => selectedExam && performDelete(selectedExam.id)}
        isLoading={isPending}
      />
    </Card>
  )
}
