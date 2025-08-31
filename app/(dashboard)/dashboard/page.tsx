"use client"

import { Award, BookOpen, Clock, Target, TrendingUp, Users } from "lucide-react"
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

const DashboardPage = () => {
  // Données mockées - à remplacer par des vraies données
  const stats = {
    totalExams: 24,
    completedExams: 18,
    averageScore: 78,
    timeSpent: "45h 30m",
    rank: 15,
    totalUsers: 1250,
  }

  const recentExams = [
    {
      id: 1,
      title: "Examen QCM - Cardiologie",
      score: 85,
      date: "2024-01-15",
      status: "completed",
    },
    {
      id: 2,
      title: "Test de Neurologie",
      score: 72,
      date: "2024-01-14",
      status: "completed",
    },
    {
      id: 3,
      title: "QCM Pneumologie",
      score: null,
      date: "2024-01-13",
      status: "in-progress",
    },
  ]

  const quickActions = [
    {
      title: "Nouvel examen",
      href: "/dashboard/mock-exam",
      icon: BookOpen,
      description: "Commencer un nouveau test",
    },
    {
      title: "Mon profil",
      href: "/dashboard/profil",
      icon: Users,
      description: "Gérer mes informations",
    },
    {
      title: "Mes résultats",
      href: "/dashboard/account",
      icon: Award,
      description: "Voir mes performances",
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* En-tête */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-blue-600">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Bienvenue sur votre espace d&apos;apprentissage NOMAQbank
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Examens complétés
            </CardTitle>
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.completedExams}/{stats.totalExams}
            </div>
            <Progress
              value={(stats.completedExams / stats.totalExams) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score moyen</CardTitle>
            <Target className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <p className="text-muted-foreground text-xs">
              +2.5% par rapport au mois dernier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Temps d&apos;étude
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.timeSpent}</div>
            <p className="text-muted-foreground text-xs">Ce mois-ci</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classement</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{stats.rank}</div>
            <p className="text-muted-foreground text-xs">
              Sur {stats.totalUsers} utilisateurs
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
                    <action.icon className="text-primary h-8 w-8" />
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

      {/* Activité récente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>Vos derniers examens et résultats</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/account">Voir tout</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentExams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="text-muted-foreground h-5 w-5" />
                  <div>
                    <h4 className="font-medium">{exam.title}</h4>
                    <p className="text-muted-foreground text-sm">
                      {new Date(exam.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {exam.status === "completed" ? (
                    <>
                      <Badge variant="secondary">{exam.score}%</Badge>
                      <Badge variant="outline">Terminé</Badge>
                    </>
                  ) : (
                    <Badge variant="outline">En cours</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
