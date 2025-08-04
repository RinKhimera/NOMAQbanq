"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertTriangle, CalendarDays, CheckCircle, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

const MockExamPage = () => {
  const [selectedExam, setSelectedExam] = useState<Id<"exams"> | null>(null)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const router = useRouter()

  const allExams = useQuery(api.exams.getAllExams)
  const currentUser = useQuery(api.users.getCurrentUser)

  const now = Date.now()

  // Séparer les examens par statut
  const activeExams =
    allExams?.filter(
      (exam) => exam.isActive && now >= exam.startDate && now <= exam.endDate,
    ) || []

  const upcomingExams =
    allExams?.filter((exam) => exam.isActive && now < exam.startDate) || []

  const pastExams =
    allExams?.filter((exam) => exam.isActive && now > exam.endDate) || []

  // Vérifier si l'utilisateur a déjà passé un examen
  const hasUserTakenExam = (exam: NonNullable<typeof allExams>[number]) => {
    return exam.participants.some(
      (p: { userId: Id<"users"> }) => p.userId === currentUser?._id,
    )
  }

  const handleStartExam = (examId: Id<"exams">) => {
    setSelectedExam(examId)
    setConfirmationOpen(true)
  }

  const confirmStartExam = () => {
    if (selectedExam) {
      router.push(`/dashboard/mock-exam/${selectedExam}`)
    }
    setConfirmationOpen(false)
  }

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "PPP 'à' HH:mm", { locale: fr })
  }

  const formatDateShort = (timestamp: number) => {
    return format(new Date(timestamp), "dd MMM yyyy", { locale: fr })
  }

  if (!allExams) {
    return <div className="flex justify-center p-8">Chargement...</div>
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header avec gradient moderne */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Examens Blancs</h1>
        <p className="text-muted-foreground">
          Testez vos connaissances avec nos examens blancs dans les conditions
          réelles
        </p>
      </div>

      {/* Examens actifs (en cours) */}
      {activeExams.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"></div>
            <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              Examens disponibles maintenant
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {activeExams.map((exam) => {
              const userTaken = hasUserTakenExam(exam)
              return (
                <Card
                  key={exam._id}
                  className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-50 to-green-50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-gray-900/50 dark:from-emerald-950/30 dark:to-green-950/30"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-xl font-bold text-gray-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                        {exam.title}
                      </CardTitle>
                      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        Ouvert
                      </Badge>
                    </div>
                    {exam.description && (
                      <CardDescription className="mt-2 text-gray-600 dark:text-gray-300">
                        {exam.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3 rounded-lg bg-white/60 p-3 backdrop-blur-sm dark:bg-gray-800/60">
                      <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Jusqu&apos;au {formatDate(exam.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-white/60 p-3 backdrop-blur-sm dark:bg-gray-800/60">
                      <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {exam.questionIds.length} questions • 2h30
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="relative z-10 pt-6">
                    {userTaken ? (
                      <Button
                        disabled
                        className="w-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      >
                        Déjà passé
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleStartExam(exam._id)}
                        className="w-full cursor-pointer bg-gradient-to-r from-emerald-600 to-green-600 font-semibold text-white shadow-lg transition-all duration-200 hover:from-emerald-700 hover:to-green-700 hover:shadow-xl"
                      >
                        Commencer l&apos;examen
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Examens à venir */}
      {upcomingExams.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              Examens à venir
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {upcomingExams.map((exam) => (
              <Card
                key={exam._id}
                className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-gray-900/50 dark:from-blue-950/30 dark:to-indigo-950/30"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 transition-opacity group-hover:opacity-100"></div>
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl font-bold text-gray-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                      {exam.title}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      Bientôt
                    </Badge>
                  </div>
                  {exam.description && (
                    <CardDescription className="mt-2 text-gray-600 dark:text-gray-300">
                      {exam.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3 rounded-lg bg-white/60 p-3 backdrop-blur-sm dark:bg-gray-800/60">
                    <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Ouverture le {formatDate(exam.startDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-white/60 p-3 backdrop-blur-sm dark:bg-gray-800/60">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {exam.questionIds.length} questions • 2h30
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="relative z-10 pt-6">
                  <Button
                    disabled
                    className="w-full bg-blue-100 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    Disponible le {formatDateShort(exam.startDate)}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Examens passés */}
      {pastExams.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-gray-400 to-gray-500"></div>
            <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              Examens terminés
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pastExams.map((exam) => {
              const userTaken = hasUserTakenExam(exam)
              const userResult = exam.participants.find(
                (p) => p.userId === currentUser?._id,
              )

              return (
                <Card
                  key={exam._id}
                  className="group relative overflow-hidden border-0 bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-gray-900/30 dark:from-gray-900/50 dark:to-gray-800/50"
                >
                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-xl font-bold text-gray-700 dark:text-gray-300">
                        {exam.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
                      >
                        Terminé
                      </Badge>
                    </div>
                    {exam.description && (
                      <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        {exam.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3 rounded-lg bg-white/60 p-3 backdrop-blur-sm dark:bg-gray-800/60">
                      <CalendarDays className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Terminé le {formatDate(exam.endDate)}
                      </span>
                    </div>
                    {userResult && (
                      <div className="rounded-xl border border-gray-200 bg-white/80 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Votre résultat :{" "}
                          <span className="text-blue-600 dark:text-blue-400">
                            {userResult.score}%
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Passé le {formatDate(userResult.completedAt)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="relative z-10 pt-6">
                    {userTaken ? (
                      <Button
                        onClick={() =>
                          router.push(
                            `/dashboard/mock-exam/${exam._id}/results`,
                          )
                        }
                        className="w-full cursor-pointer"
                        variant="outline"
                      >
                        Consulter les résultats
                      </Button>
                    ) : (
                      <Button disabled className="w-full" variant="outline">
                        Examen fermé
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Message si aucun examen */}
      {allExams.length === 0 && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg dark:from-gray-900/50 dark:to-gray-800/50">
          <CardContent className="py-16 text-center">
            <div className="relative z-10">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                <CalendarDays className="h-10 w-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
                Aucun examen disponible
              </h3>
              <p className="mx-auto max-w-md text-gray-600 dark:text-gray-400">
                Les examens blancs seront bientôt disponibles. Revenez plus tard
                !
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modale de confirmation */}
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent className="border-0 bg-white/95 shadow-2xl backdrop-blur-xl sm:max-w-lg dark:bg-gray-900/95">
          <DialogHeader className="space-y-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Confirmer le début de l&apos;examen
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-2 text-base">
              <p className="text-gray-700 dark:text-gray-300">
                Vous êtes sur le point de commencer un examen blanc. Voici les
                conditions :
              </p>
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/30 dark:to-orange-950/30">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span>
                      <strong className="text-gray-900 dark:text-white">
                        115 questions
                      </strong>{" "}
                      à répondre
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span>
                      <strong className="text-gray-900 dark:text-white">
                        2h30
                      </strong>{" "}
                      pour compléter l&apos;examen
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span>
                      <strong className="text-gray-900 dark:text-white">
                        Impossible d&apos;interrompre
                      </strong>{" "}
                      une fois commencé
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span>
                      <strong className="text-gray-900 dark:text-white">
                        Un seul essai
                      </strong>{" "}
                      autorisé
                    </span>
                  </li>
                </ul>
              </div>
              <p className="rounded-lg bg-amber-50 p-3 font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Assurez-vous d&apos;avoir suffisamment de temps avant de
                commencer.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => setConfirmationOpen(false)}
              className="font-medium"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmStartExam}
              className="bg-gradient-to-r from-emerald-600 to-green-600 font-semibold text-white shadow-lg hover:from-emerald-700 hover:to-green-700 hover:shadow-xl"
            >
              Commencer l&apos;examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MockExamPage
