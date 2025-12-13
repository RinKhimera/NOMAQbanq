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
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
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
  const [now] = useState(() => Date.now())

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

      {/* Examens disponibles ou message + dernier exam passé */}
      {availableExams && availableExams.length > 0 ? (
        <>
          {/* Examens disponibles */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Examens disponibles</CardTitle>
                <CardDescription>
                  Examens blancs actuellement accessibles
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/mock-exam">Voir tous</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {availableExams.map((exam) => (
                  <div
                    key={exam._id}
                    className="hover:bg-muted/50 flex h-full flex-col rounded-lg border p-3 transition-colors"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <GraduationCap className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
                      <h4 className="line-clamp-2 font-medium">{exam.title}</h4>
                    </div>
                    <p className="text-muted-foreground mb-3 flex-1 text-xs">
                      {exam.questionIds.length} questions •{" "}
                      {Math.round(exam.completionTime / 60)} min
                    </p>
                    <Link href={"/dashboard/mock-exam"}>
                      <Button size="sm" className="w-full">
                        Commencer
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dernier exam passé */}
          {recentExams &&
          recentExams.length > 0 &&
          recentExams[0].isCompleted &&
          currentUser &&
          (currentUser.role === "admin" || now >= recentExams[0].endDate) ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Dernier examen passé</CardTitle>
                  <CardDescription>Consultez vos résultats</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/account">Historique</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/dashboard/mock-exam/${recentExams[0]._id}/results/${currentUser._id}`}
                >
                  <div className="hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="text-muted-foreground h-5 w-5" />
                      <div>
                        <h4 className="font-medium">{recentExams[0].title}</h4>
                        <p className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3" />
                          {recentExams[0].completedAt
                            ? new Date(
                                recentExams[0].completedAt,
                              ).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "Date inconnue"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        recentExams[0].score && recentExams[0].score >= 60
                          ? "default"
                          : "destructive"
                      }
                    >
                      {recentExams[0].score}%
                    </Badge>
                  </div>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
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
