"use client"

import { useQuery } from "convex/react"
import {
  BarChart3,
  BookOpen,
  Database,
  Plus,
  Settings,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react"
import { useState } from "react"
import AdminProtection from "@/components/AdminProtection"
import QuestionForm from "@/components/QuestionForm"
import QuestionsList from "@/components/QuestionsList"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/convex/_generated/api"

type TabValue = "overview" | "add-question" | "manage-questions" | "settings"

const TAB_OPTIONS = [
  {
    value: "overview" as TabValue,
    label: "Vue d'ensemble",
    icon: BarChart3,
  },
  {
    value: "add-question" as TabValue,
    label: "Ajouter",
    icon: Plus,
  },
  {
    value: "manage-questions" as TabValue,
    label: "Gérer",
    icon: BookOpen,
  },
  {
    value: "settings" as TabValue,
    label: "Paramètres",
    icon: Settings,
  },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("overview")
  const questionStats = useQuery(api.questions.getQuestionStats)
  const currentUser = useQuery(api.users.getCurrentUser)

  // Trouver l'option active pour l'affichage
  const activeTabOption = TAB_OPTIONS.find(
    (option) => option.value === activeTab,
  )

  // Statistiques
  const totalQuestions = questionStats?.totalCount || 0
  const domainStatsArray = questionStats?.domainStats || []

  const domainStats = domainStatsArray.reduce(
    (acc, item) => {
      acc[item.domain] = item.count
      return acc
    },
    {} as Record<string, number>,
  )

  const topDomains = [...domainStatsArray]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <AdminProtection>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-20 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* En-tête */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="flex items-center gap-3 text-4xl font-bold text-gray-900 dark:text-white">
                  <Shield className="h-10 w-10 text-blue-600" />
                  Administration
                </h1>
                <p className="mt-2 text-xl text-gray-600 dark:text-gray-300">
                  Tableau de bord pour la gestion de NOMAQbanq
                </p>
                {currentUser && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Connecté en tant que{" "}
                    <span className="font-medium">{currentUser.name}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation hybride */}
          <div className="mb-6">
            {/* Navigation mobile - Dropdown */}
            <div className="block md:hidden">
              <Select
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as TabValue)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {activeTabOption && (
                        <>
                          <activeTabOption.icon className="h-4 w-4" />
                          {activeTabOption.label}
                        </>
                      )}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TAB_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Navigation desktop - Tabs */}
            <div className="hidden md:block">
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as TabValue)}
              >
                <TabsList className="grid w-full grid-cols-4 lg:w-fit">
                  <TabsTrigger
                    value="overview"
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Vue d&apos;ensemble
                  </TabsTrigger>
                  <TabsTrigger
                    value="add-question"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </TabsTrigger>
                  <TabsTrigger
                    value="manage-questions"
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    Gérer
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Contenu des onglets */}
          <div className="space-y-6">
            {/* Vue d'ensemble */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Statistiques principales */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Questions
                      </CardTitle>
                      <Database className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalQuestions}</div>
                      <p className="text-muted-foreground text-xs">
                        Questions disponibles
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Domaines Couverts
                      </CardTitle>
                      <BookOpen className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Object.keys(domainStats || {}).length}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Spécialités médicales
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Utilisateurs
                      </CardTitle>
                      <Users className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">-</div>
                      <p className="text-muted-foreground text-xs">
                        Fonctionnalité à venir
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Activité
                      </CardTitle>
                      <TrendingUp className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">-</div>
                      <p className="text-muted-foreground text-xs">
                        Fonctionnalité à venir
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Répartition par domaines */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 des domaines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {topDomains.map((item, index) => (
                          <div
                            key={item.domain}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium">
                                {item.domain}
                              </span>
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {item.count} question{item.count > 1 ? "s" : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Actions rapides</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Button
                          onClick={() => setActiveTab("add-question")}
                          className="w-full cursor-pointer justify-start"
                          variant="outline"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter une nouvelle question
                        </Button>
                        <Button
                          onClick={() => setActiveTab("manage-questions")}
                          className="w-full cursor-pointer justify-start"
                          variant="outline"
                        >
                          <BookOpen className="mr-2 h-4 w-4" />
                          Gérer les questions existantes
                        </Button>
                        <Button
                          onClick={() => setActiveTab("settings")}
                          className="w-full cursor-pointer justify-start"
                          variant="outline"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Paramètres système
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Ajouter une question */}
            {activeTab === "add-question" && <QuestionForm />}

            {/* Gérer les questions */}
            {activeTab === "manage-questions" && <QuestionsList />}

            {/* Paramètres */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Paramètres système</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="py-12 text-center">
                      <Settings className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                      <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
                        Paramètres à venir
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Cette section contiendra les paramètres de configuration
                        du système.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminProtection>
  )
}
