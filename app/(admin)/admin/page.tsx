"use client"

import { useQuery } from "convex/react"
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Settings,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { SectionCards } from "@/components/admin/section-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"

const AdminDashboardPage = () => {
  const [showAllDomains, setShowAllDomains] = useState(false)
  const questionStats = useQuery(api.questions.getQuestionStats)
  const adminStats = useQuery(api.users.getAdminStats)
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
    .slice(0, showAllDomains ? undefined : 5)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards
        totalQuestions={questionStats?.totalCount}
        domainStats={domainStats}
        adminStats={adminStats}
      />

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
              {topDomains.map((item, index) => (
                <div
                  key={item.domain}
                  className="flex items-center justify-between px-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                      {index + 1}
                    </div>
                    <span className="truncate text-sm font-semibold text-blue-700 dark:text-white">
                      {item.domain}
                    </span>
                  </div>
                  <div className="text-muted-foreground ml-2 flex-shrink-0 text-sm">
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
            <div className="flex flex-col gap-3">
              <Link href="/admin/questions">
                <Button
                  className="w-full cursor-pointer justify-start"
                  variant="btn_modern_outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une nouvelle question
                </Button>
              </Link>
              <Link href="/admin/exams/create">
                <Button
                  variant="btn_modern_outline"
                  className="w-full cursor-pointer justify-start"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Ajouter un examen
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button
                  className="w-full cursor-pointer justify-start"
                  variant="btn_modern_outline"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Gestion des utilisateurs
                </Button>
              </Link>
              <Link href="/admin/account">
                <Button
                  className="w-full cursor-pointer justify-start"
                  variant="btn_modern_outline"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres du compte
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminDashboardPage
