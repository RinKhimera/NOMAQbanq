"use client"

import { useQuery } from "convex/react"
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Target,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { useCurrentUser } from "@/hooks/useCurrentUser"

const DashboardPage = () => {
  const { currentUser, isLoading: userLoading } = useCurrentUser()
  const stats = useQuery(api.exams.getMyDashboardStats)
  const availableExams = useQuery(api.exams.getMyAvailableExams)
  const recentExams = useQuery(api.exams.getMyRecentExams)

  const quickActions = [
    {
      title: "Banque d'apprentissage",
      href: "/dashboard/learning",
      icon: BookOpen,
      description: "Révisez les questions essentielles",
      color: "text-blue-600",
    },
    {
      title: "Examens blancs",
      href: "/dashboard/mock-exam",
      icon: GraduationCap,
      description: "Testez vos connaissances",
      color: "text-purple-600",
    },
    {
      title: "Mon profil",
      href: "/dashboard/profil",
      icon: Award,
      description: "Gérer mes informations",
      color: "text-green-600",
    },
  ]

  if (userLoading || !stats) {
    return (
      <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* En-tête */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-blue-600">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Bienvenue {currentUser?.name}, suivez votre progression pour
          l&apos;EACMC Part I
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Examens disponibles
            </CardTitle>
            <Calendar className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.availableExamsCount}
            </div>
            <p className="text-muted-foreground text-xs">
              Examens blancs accessibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Examens complétés
            </CardTitle>
            <CheckCircle2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.completedExamsCount}
            </div>
            {stats.availableExamsCount > 0 && (
              <Progress
                value={
                  (stats.completedExamsCount / stats.availableExamsCount) * 100
                }
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score moyen</CardTitle>
            <Target className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.completedExamsCount > 0 ? `${stats.averageScore}%` : "—"}
            </div>
            <p className="text-muted-foreground text-xs">
              {stats.completedExamsCount > 0
                ? "Sur vos examens terminés"
                : "Aucun examen complété"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Banque d&apos;apprentissage
            </CardTitle>
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.learningBankQuestionsCount}
            </div>
            <p className="text-muted-foreground text-xs">
              Questions disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>
            Accédez rapidement aux fonctionnalités principales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href}>
                <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    <action.icon className={`h-8 w-8 ${action.color}`} />
                    <div>
                      <h3 className="font-semibold">{action.title}</h3>
                      <p className="text-muted-foreground text-sm">
                        {action.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Examens disponibles */}
      {availableExams && availableExams.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Examens actifs</CardTitle>
              <CardDescription>
                Examens blancs actuellement disponibles
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/mock-exam">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableExams.slice(0, 3).map((exam) => (
                <div
                  key={exam._id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="text-muted-foreground h-5 w-5" />
                    <div>
                      <h4 className="font-medium">{exam.title}</h4>
                      <p className="text-muted-foreground text-sm">
                        {exam.questionIds.length} questions •{" "}
                        {Math.round(exam.completionTime / 60)} min
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/dashboard/mock-exam/${exam._id}`}>
                      Commencer
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activité récente */}
      {recentExams && recentExams.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>Vos derniers examens</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/account">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExams.map((exam) => (
                <div
                  key={exam._id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="text-muted-foreground h-5 w-5" />
                    <div>
                      <h4 className="font-medium">{exam.title}</h4>
                      <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3" />
                        {exam.completedAt
                          ? new Date(exam.completedAt).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )
                          : `Disponible jusqu'au ${new Date(exam.endDate).toLocaleDateString("fr-FR")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.isCompleted ? (
                      <>
                        <Badge
                          variant={
                            exam.score && exam.score >= 60
                              ? "default"
                              : "destructive"
                          }
                        >
                          {exam.score}%
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Terminé
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Disponible
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message si aucun examen disponible */}
      {availableExams && availableExams.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">
              Aucun examen disponible
            </h3>
            <p className="text-muted-foreground mb-4 text-center">
              Les examens blancs seront bientôt disponibles. En attendant,
              révisez avec la banque d&apos;apprentissage !
            </p>
            <Button asChild>
              <Link href="/dashboard/learning">
                <BookOpen className="mr-2 h-4 w-4" />
                Accéder à la banque d&apos;apprentissage
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default DashboardPage
