"use client"

import { useQuery } from "convex/react"
import { BookOpen, ChevronDown, ChevronUp, Plus, Settings } from "lucide-react"
import { useState } from "react"
import { SectionCards } from "@/components/admin/section-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"

const AdminDashboardPage = () => {
  const [showAllDomains, setShowAllDomains] = useState(false)
  const allQuestions = useQuery(api.questions.getAllQuestions)
  const domainStats = allQuestions?.reduce(
    (acc, question) => {
      acc[question.domain] = (acc[question.domain] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const topDomains = Object.entries(domainStats || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, showAllDomains ? undefined : 5)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards allQuestions={allQuestions} domainStats={domainStats} />

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card className="flex h-[360px] flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle>
                {showAllDomains ? "Tous les domaines" : "Top 5 des domaines"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllDomains(!showAllDomains)}
                className="text-xs"
              >
                {showAllDomains ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Voir moins
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Voir tout
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <div className="h-full space-y-4 overflow-y-auto pr-2">
              {topDomains.map(([domain, count], index) => (
                <div key={domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                      {index + 1}
                    </div>
                    <span className="truncate text-sm font-medium">
                      {domain}
                    </span>
                  </div>
                  <div className="text-muted-foreground ml-2 flex-shrink-0 text-sm">
                    {count} question{count > 1 ? "s" : ""}
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
                className="w-full cursor-pointer justify-start"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une nouvelle question
              </Button>
              <Button
                className="w-full cursor-pointer justify-start"
                variant="outline"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Gérer les questions existantes
              </Button>
              <Button
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
  )
}

export default AdminDashboardPage
