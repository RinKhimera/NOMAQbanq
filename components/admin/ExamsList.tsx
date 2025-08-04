"use client"

import { useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar, Clock, Eye, MoreHorizontal, Users } from "lucide-react"
import Link from "next/link"
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
import { Id } from "@/convex/_generated/dataModel"

export function ExamsList() {
  const exams = useQuery(api.exams.getAllExams)
  const deactivateExam = useMutation(api.exams.deactivateExam)

  const handleDeactivate = async (examId: Id<"exams">) => {
    try {
      await deactivateExam({ examId })
      toast.success("Examen désactivé avec succès")
    } catch {
      toast.error("Erreur lors de la désactivation")
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
    <Card>
      <CardHeader>
        <CardTitle>Liste des examens</CardTitle>
        <CardDescription>
          Gérez tous vos examens depuis cette interface
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Date de début</TableHead>
              <TableHead>Date de fin</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
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
                        {exam.isActive && (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(exam._id)}
                            className="text-red-600"
                          >
                            Désactiver
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
