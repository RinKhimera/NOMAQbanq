"use client"

import { EllipsisVertical, Eye, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { SCORE_WITHHELD_MESSAGE } from "@/components/quiz/runner/types"
import { UserAvatar } from "@/components/shared/user-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { deleteParticipation } from "@/features/exams/actions"
import type { LeaderboardEntry } from "@/features/exams/dal"
import { formatCompactDateTime } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { formatScore } from "@/lib/score"
import { cn } from "@/lib/utils"

const foldForSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

const matchesSearch = (entry: LeaderboardEntry, query: string) =>
  [entry.user?.name, entry.user?.username].some(
    (field) => field && foldForSearch(field).includes(query),
  )

interface ParticipantToDelete {
  participationId: string
  userName: string
  score: number | null
}

interface ExamLeaderboardProps {
  examId: string
  leaderboard: LeaderboardEntry[]
  isAdmin?: boolean
  currentUserId?: string
}

export function ExamLeaderboard({
  examId,
  leaderboard,
  isAdmin = false,
  currentUserId,
}: ExamLeaderboardProps) {
  const router = useRouter()

  const [participantToDelete, setParticipantToDelete] =
    useState<ParticipantToDelete | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [search, setSearch] = useState("")

  const query = foldForSearch(search.trim())
  // Le rang se calcule sur le classement complet : filtrer ne le change pas.
  const rankedEntries = leaderboard
    .map((entry, index) => ({ entry, rank: index + 1 }))
    .filter(({ entry }) => query === "" || matchesSearch(entry, query))

  const handleDeleteClick = (participant: ParticipantToDelete) => {
    setParticipantToDelete(participant)
  }

  const handleConfirmDelete = async () => {
    if (!participantToDelete) return

    setIsDeleting(true)
    const res = await callAction(() =>
      deleteParticipation({
        participationId: participantToDelete.participationId,
      }),
    )
    setIsDeleting(false)
    if (res.success) {
      toast.success("Participation supprimée avec succès")
      setParticipantToDelete(null)
      router.refresh()
    } else {
      toast.error(
        res.error ?? "Erreur lors de la suppression de la participation",
      )
    }
  }

  if (leaderboard.length === 0) return null

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
            type="search"
            placeholder="Rechercher un participant..."
            aria-label="Rechercher un participant"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full md:w-72"
          />
        </div>
      </CardHeader>
      <CardContent>
        {rankedEntries.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Aucun participant ne correspond à « {search.trim()} ».
          </p>
        )}
        <ul className="space-y-3">
          {rankedEntries.map(({ entry, rank }) => {
            return (
              <li
                key={entry.participationId}
                className="flex items-center gap-2 rounded-lg border p-3 @sm:gap-3"
              >
                {/* Left side: Rank + Avatar + Name */}
                <div className="flex min-w-0 flex-1 items-center gap-2 @sm:gap-3">
                  <div
                    title={
                      entry.score === null ? SCORE_WITHHELD_MESSAGE : undefined
                    }
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold text-white @sm:h-8 @sm:w-8",
                      entry.score === null
                        ? "bg-gray-400 dark:bg-gray-600"
                        : "bg-blue-600 dark:bg-blue-500",
                    )}
                  >
                    {entry.score === null ? "—" : rank}
                  </div>
                  <UserAvatar
                    name={entry.user?.name}
                    image={entry.user?.image}
                    className="size-9 shrink-0 @sm:size-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium @sm:text-base">
                      {entry.user?.name}
                    </p>
                    {entry.user?.username && (
                      <p className="text-muted-foreground truncate text-xs @sm:text-sm">
                        @{entry.user.username}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Score + Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-bold @sm:text-base">
                      {formatScore(entry.score)}
                    </p>
                    <p className="text-muted-foreground hidden text-xs @md:block">
                      {entry.completedAt &&
                        formatCompactDateTime(entry.completedAt)}
                    </p>
                  </div>

                  {/* Desktop: Separate buttons */}
                  {entry.user && (
                    <>
                      <div className="hidden items-center gap-1 @md:flex">
                        {(isAdmin || entry.user.id === currentUserId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="h-8 w-8"
                          >
                            <Link
                              href={
                                isAdmin
                                  ? `/admin/examens/${examId}/resultats/${entry.user.id}`
                                  : `/tableau-de-bord/examen-blanc/${examId}/resultats`
                              }
                              title={`Voir les résultats de ${entry.user.name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20"
                            onClick={() =>
                              handleDeleteClick({
                                participationId: entry.participationId,
                                userName: entry.user?.name || "ce participant",
                                score: entry.score,
                              })
                            }
                            title={`Supprimer la participation de ${entry.user.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Mobile: Dropdown menu */}
                      <div className="@md:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <EllipsisVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(isAdmin || entry.user.id === currentUserId) && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={
                                    isAdmin
                                      ? `/admin/examens/${examId}/resultats/${entry.user.id}`
                                      : `/tableau-de-bord/examen-blanc/${examId}/resultats`
                                  }
                                  className="flex items-center gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  Voir les résultats
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <>
                                {(isAdmin ||
                                  entry.user.id === currentUserId) && (
                                  <DropdownMenuSeparator />
                                )}
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeleteClick({
                                      participationId: entry.participationId,
                                      userName:
                                        entry.user?.name || "ce participant",
                                      score: entry.score,
                                    })
                                  }
                                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>

      {/* AlertDialog de confirmation de suppression */}
      <AlertDialog
        open={participantToDelete !== null}
        onOpenChange={(open) => !open && setParticipantToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la participation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Êtes-vous sûr de vouloir supprimer la participation de{" "}
                  <strong>{participantToDelete?.userName}</strong> ?
                </p>
                <p>
                  Score obtenu :{" "}
                  <strong>
                    {formatScore(participantToDelete?.score ?? null)}
                  </strong>
                </p>
                <p className="text-red-600 dark:text-red-400">
                  ⚠️ Cette action est irréversible. Toutes les réponses de ce
                  participant seront définitivement supprimées.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
