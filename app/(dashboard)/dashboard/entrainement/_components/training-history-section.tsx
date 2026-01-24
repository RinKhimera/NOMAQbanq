"use client"

import { useState } from "react"
import { useConvexAuth, usePaginatedQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  History,
  ChevronRight,
  Trophy,
  Target,
  Loader2,
  MoreHorizontal,
  Eye,
  Trash2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { DeleteSessionDialog } from "./delete-session-dialog"
import { DeleteAllSessionsDialog } from "./delete-all-sessions-dialog"

interface Session {
  _id: Id<"trainingParticipations">
  questionCount: number
  score: number
  domain?: string
  completedAt?: number
  startedAt: number
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

const getScoreBg = (score: number) => {
  if (score >= 80)
    return "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800"
  if (score >= 60)
    return "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800"
  return "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800"
}

export const TrainingHistorySection = () => {
  const router = useRouter()
  const { isAuthenticated } = useConvexAuth()

  // Delete dialog state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)

  // Skip query until authenticated to avoid race condition on page reload
  const {
    results: sessions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.training.getTrainingHistory,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 5 },
  )

  const isLoading = status === "LoadingFirstPage"
  const hasMore = status === "CanLoadMore"
  const isLoadingMore = status === "LoadingMore"

  const handleDeleteSession = (session: Session) => {
    setSelectedSession(session)
    setShowDeleteDialog(true)
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200/60 px-6 py-4 dark:border-gray-700/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
              <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
                Historique
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vos sessions précédentes
              </p>
            </div>
          </div>

          {/* Delete all button */}
          {sessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteAllDialog(true)}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Tout supprimer</span>
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                <Target className="h-8 w-8 text-gray-400" />
              </div>
              <p className="font-medium text-gray-600 dark:text-gray-400">
                Aucune session terminée
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Commencez votre première session d&apos;entraînement !
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, index) => (
                <motion.div
                  key={session._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex w-full items-center gap-4 rounded-xl border border-transparent bg-gray-50/50 p-4 transition-all hover:border-gray-200 hover:bg-gray-100/80 dark:bg-gray-800/30 dark:hover:border-gray-700 dark:hover:bg-gray-800/60"
                >
                  {/* Clickable area for navigation */}
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/entrainement/${session._id}/results`,
                      )
                    }
                    className="flex flex-1 cursor-pointer items-center gap-4 text-left"
                  >
                    {/* Score badge */}
                    <div
                      className={cn(
                        "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border",
                        getScoreBg(session.score),
                      )}
                    >
                      <div className="text-center">
                        <div
                          className={cn(
                            "font-display text-lg font-bold",
                            getScoreColor(session.score),
                          )}
                        >
                          {session.score}%
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {session.questionCount} questions
                        </span>
                        {session.score >= 80 && (
                          <Trophy className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        {session.domain && (
                          <>
                            <span className="rounded bg-gray-200/60 px-1.5 py-0.5 text-xs dark:bg-gray-700/60">
                              {session.domain}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>
                          {session.completedAt &&
                            formatDistanceToNow(new Date(session.completedAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </button>

                  {/* Actions menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(
                            `/dashboard/entrainement/${session._id}/results`,
                          )
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Voir les détails
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteSession(session)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              ))}

              {/* Load more button */}
              {hasMore && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => loadMore(5)}
                    disabled={isLoadingMore}
                    className="w-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      "Voir plus"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete dialogs */}
      <DeleteSessionDialog
        session={selectedSession}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={() => setSelectedSession(null)}
      />

      <DeleteAllSessionsDialog
        open={showDeleteAllDialog}
        onOpenChange={setShowDeleteAllDialog}
      />
    </>
  )
}
