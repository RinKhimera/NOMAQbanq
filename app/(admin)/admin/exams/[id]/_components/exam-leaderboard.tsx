"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Eye } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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
import { getInitials } from "@/lib/utils"

interface ExamLeaderboardProps {
  examId: Id<"exams">
  isAdmin?: boolean
  currentUserId?: Id<"users">
}

export function ExamLeaderboard({
  examId,
  isAdmin = false,
  currentUserId,
}: ExamLeaderboardProps) {
  const leaderboard = useQuery(api.exams.getExamLeaderboard, { examId })

  if (!leaderboard || leaderboard.length === 0) return null

  return (
    <Card className="@container">
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
          {leaderboard.map((entry, index) => {
            const initials = getInitials(entry.user?.name)
            return (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white dark:bg-blue-500">
                    {index + 1}
                  </div>
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage
                      src={entry.user?.image}
                      alt={entry.user?.name || "Avatar"}
                    />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.user?.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      @{entry.user?.username}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">{entry.score}%</p>
                    <p className="text-muted-foreground hidden text-sm @md:block">
                      {format(new Date(entry.completedAt), "Pp", {
                        locale: fr,
                      })}
                    </p>
                  </div>
                  {entry.user &&
                    (isAdmin || entry.user._id === currentUserId) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link
                          href={
                            isAdmin
                              ? `/admin/exams/${examId}/results/${entry.user._id}`
                              : `/dashboard/mock-exam/${examId}/results/${entry.user._id}`
                          }
                          title={`Voir les résultats de ${entry.user.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
