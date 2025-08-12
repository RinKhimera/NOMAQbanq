"use client"

import { useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Calendar,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"

export function ExamsList() {
  const router = useRouter()
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Doc<"exams"> | null>(null)

  const exams = useQuery(api.exams.getAllExams)
  const deactivateExam = useMutation(api.exams.deactivateExam)
  const reactivateExam = useMutation(api.exams.reactivateExam)
  const deleteExam = useMutation(api.exams.deleteExam)

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
    } catch {
      toast.error("Erreur lors de la désactivation")
    }
  }

  const handleReactivate = async (examId: Id<"exams">) => {
    try {
      await reactivateExam({ examId })
      toast.success("Examen réactivé avec succès")
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
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  const getExamStatus = (exam: {
    isActive: boolean
    startDate: number
    endDate: number
  }) => {
    const now = Date.now()
    if (!exam.isActive) return "inactive"
    if (now < exam.startDate) return "upcoming"
    if (now > exam.endDate) return "completed"
    return "active"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">En cours</Badge>
      case "upcoming":
        return <Badge className="bg-blue-500">À venir</Badge>
      case "completed":
        return <Badge className="bg-gray-500">Terminé</Badge>
      case "inactive":
        return <Badge variant="destructive">Désactivé</Badge>
      default:
        return <Badge variant="secondary">Inconnu</Badge>
    }
  }

  if (!exams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chargement...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (exams.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucun examen</CardTitle>
          <CardDescription>
            Aucun examen n&apos;a été créé pour le moment.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="bg-sidebar">
      <CardHeader>
        <CardTitle className="text-blue-600 dark:text-white">
          Liste des examens
        </CardTitle>
        <CardDescription>
          Gérez tous vos examens depuis cette interface
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Titre</TableHead>
              <TableHead className="font-semibold">Date de début</TableHead>
              <TableHead className="font-semibold">Date de fin</TableHead>
              <TableHead className="font-semibold">Questions</TableHead>
              <TableHead className="font-semibold">Participants</TableHead>
              <TableHead className="font-semibold">Statut</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((exam) => {
              const status = getExamStatus(exam)
              return (
                <TableRow key={exam._id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{exam.title}</p>
                      {exam.description && (
                        <p className="text-muted-foreground text-sm">
                          {exam.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(exam.startDate), "PPP", { locale: fr })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(exam.endDate), "PPP", { locale: fr })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {exam.questionIds.length}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {exam.participants.length}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/exams/${exam._id}`}>
                            Voir les détails
                          </Link>
                        </DropdownMenuItem>
                        {exam.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(exam)}
                          >
                            Désactiver
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleReactivate(exam._id)}
                          >
                            Réactiver
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEdit(exam)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(exam)}
                          variant="destructive"
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Dialog de confirmation pour désactiver un examen en cours */}
      <Dialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver l&apos;examen en cours</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                ⚠️ <strong>Attention :</strong> Cet examen est actuellement en
                cours.
              </p>
              <p>
                Des étudiants pourraient déjà être en train de passer cet
                examen. La désactivation interrompra immédiatement l&apos;accès
                à l&apos;examen pour tous les utilisateurs.
              </p>
              <p>
                Êtes-vous sûr de vouloir désactiver{" "}
                <strong>&quot;{selectedExam?.title}&quot;</strong> ?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowDeactivateDialog(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() =>
                selectedExam && performDeactivate(selectedExam._id)
              }
            >
              Désactiver l&apos;examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation pour modifier un examen en cours */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;examen en cours</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                ⚠️ <strong>Attention :</strong> Cet examen est actuellement en
                cours.
              </p>
              <p>
                Des étudiants pourraient déjà être en train de passer cet
                examen. Modifier l&apos;examen pendant qu&apos;il est en cours
                peut affecter l&apos;expérience des utilisateurs.
              </p>
              <p>
                Êtes-vous sûr de vouloir modifier{" "}
                <strong>&quot;{selectedExam?.title}&quot;</strong> ?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowEditDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (selectedExam) {
                  router.push(`/admin/exams/edit/${selectedExam._id}`)
                }
              }}
              className="cursor-pointer"
            >
              Continuer la modification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation pour supprimer un examen */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;examen</DialogTitle>
          </DialogHeader>
          <DialogDescription className="space-y-2">
            <p>
              ⚠️ <strong>Attention :</strong> Cette action est irréversible.
            </p>
            <p>
              L&apos;examen &quot;{selectedExam?.title}&quot; et toutes ses
              données (participants, résultats, etc.) seront définitivement
              supprimés.
            </p>
            <p>Êtes-vous absolument sûr de vouloir supprimer cet examen ?</p>
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowDeleteDialog(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => selectedExam && performDelete(selectedExam._id)}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
