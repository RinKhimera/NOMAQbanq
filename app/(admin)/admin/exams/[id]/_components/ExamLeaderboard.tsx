"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

export function ExamLeaderboard({ examId }: { examId: Id<"exams"> }) {
  const leaderboard = useQuery(api.exams.getExamLeaderboard, { examId })

  if (!leaderboard || leaderboard.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-blue-600 dark:text-white">
              Classement
            </CardTitle>
            <CardDescription>
              Les participants classés par score décroissant
            </CardDescription>
          </div>
          <Input
            placeholder="Rechercher un participant..."
            className="w-full md:w-72"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leaderboard.map((entry, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">
                    {entry.user?.username && (
                      <span className="text-muted-foreground ml-2 text-sm">
                        @{entry.user.username}
                      </span>
                    )}
                    {entry.user?.name}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">{entry.score}%</p>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(entry.completedAt), "PPP", { locale: fr })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
