"use client"

import Link from "next/link"
import { useState } from "react"
import { SCORE_WITHHELD_MESSAGE } from "@/components/quiz/runner/types"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { SearchInput } from "@/components/shared/search-input"
import { StatusPill, type StatusTone } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import type { LeaderboardEntry, LeaderboardFlag } from "@/features/exams/dal"
import { formatScore, scoreTextClass } from "@/lib/score"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { populationRanks } from "./exam-detail-model"

/** Lignes montrées avant « Afficher tout ». */
export const LEADERBOARD_PREVIEW = 10

const foldForSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

const matchesSearch = (entry: LeaderboardEntry, query: string) =>
  [entry.user?.name, entry.user?.username].some(
    (field) => field && foldForSearch(field).includes(query),
  )

const FLAG_PILLS: Record<LeaderboardFlag, { label: string; tone: StatusTone }> =
  {
    admin: { label: "Admin", tone: "admin" },
    deleted: { label: "Supprimé", tone: "neutral" },
  }

type RankedEntry = { entry: LeaderboardEntry; rank: number | null }

interface ExamLeaderboardProps {
  examId: string
  leaderboard: LeaderboardEntry[]
  /** Admin : toutes les copies, colonne « Soumission » et « Voir la copie ». */
  isAdmin?: boolean
  currentUserId?: string
  /** Examen encore ouvert : le classement peut encore bouger. */
  provisional?: boolean
}

/**
 * Classement d'un examen : rang sur le classement complet (une recherche ne le
 * change pas), « 10 premiers » puis « Afficher tout ». L'admin ouvre chaque
 * copie ; un étudiant n'ouvre que la sienne.
 */
export function ExamLeaderboard({
  examId,
  leaderboard,
  isAdmin = false,
  currentUserId,
  provisional = false,
}: ExamLeaderboardProps) {
  const [search, setSearch] = useState("")
  const [showAll, setShowAll] = useState(false)

  if (leaderboard.length === 0 && !isAdmin) return null

  const query = foldForSearch(search.trim())
  const ranks = populationRanks(leaderboard)
  const ranked: RankedEntry[] = leaderboard.map((entry, index) => ({
    entry,
    rank: ranks[index],
  }))
  const matches =
    query === ""
      ? ranked
      : ranked.filter(({ entry }) => matchesSearch(entry, query))
  const truncated =
    query === "" && !showAll && matches.length > LEADERBOARD_PREVIEW
  const rows = truncated ? matches.slice(0, LEADERBOARD_PREVIEW) : matches

  const copyHref = (entry: LeaderboardEntry) => {
    if (!entry.user) return null
    if (isAdmin) return `/admin/examens/${examId}/resultats/${entry.user.id}`
    return entry.user.id === currentUserId
      ? `/tableau-de-bord/examen-blanc/${examId}/resultats`
      : null
  }

  const columns: DataTableColumn<RankedEntry>[] = [
    {
      id: "rank",
      label: "Rang",
      className: "w-16",
      cellClassName: "font-mono text-ink-2 tabular-nums",
      cell: ({ entry, rank }) =>
        entry.score === null ? (
          <span title={SCORE_WITHHELD_MESSAGE}>—</span>
        ) : rank === null ? (
          <span title="Hors classement : compte admin ou supprimé">—</span>
        ) : (
          rank
        ),
    },
    {
      id: "participant",
      label: "Participant",
      cell: ({ entry }) => (
        <div
          data-testid={`leaderboard-row-${entry.participationId}`}
          className="flex min-w-0 items-center gap-3"
        >
          <UserAvatar
            name={entry.user?.name}
            image={entry.user?.image}
            className="size-8 shrink-0"
          />
          <div className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-ink truncate font-medium">
                {entry.user?.name ?? "Compte introuvable"}
              </span>
              {entry.user?.flag && (
                <StatusPill tone={FLAG_PILLS[entry.user.flag].tone}>
                  {FLAG_PILLS[entry.user.flag].label}
                </StatusPill>
              )}
            </span>
            {entry.user?.username && (
              <span className="text-ink-3 truncate text-xs">
                @{entry.user.username}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "score",
      label: "Score",
      className: "text-right",
      cellClassName: "font-mono tabular-nums",
      cell: ({ entry }) => (
        <span className={scoreTextClass(entry.score)}>
          {formatScore(entry.score)}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: "submission",
            label: "Soumission",
            visibleFrom: "medium",
            cell: ({ entry }: RankedEntry) =>
              entry.status === "auto_submitted" ? (
                <StatusPill tone="warning">Automatique</StatusPill>
              ) : (
                <span className="text-ink-3">Manuelle</span>
              ),
          } satisfies DataTableColumn<RankedEntry>,
        ]
      : []),
  ]

  return (
    <section
      data-testid="exam-leaderboard"
      aria-labelledby="leaderboard-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto flex flex-wrap items-center gap-2.5">
          <h2 id="leaderboard-title" className="type-label">
            Classement
          </h2>
          {provisional && (
            <StatusPill tone="warning" data-testid="leaderboard-provisional">
              Provisoire : l&apos;examen est encore ouvert
            </StatusPill>
          )}
        </span>
        {leaderboard.length > 0 && (
          <SearchInput
            placeholder="Rechercher un participant…"
            aria-label="Rechercher un participant"
            value={search}
            onValueChange={setSearch}
            containerClassName="w-full sm:w-70"
            data-testid="leaderboard-search"
          />
        )}
      </div>

      {leaderboard.length === 0 ? (
        <p
          data-testid="leaderboard-empty"
          className="bg-surface border-line text-ink-3 rounded-lg border px-5 py-6 text-sm"
        >
          Aucune participation pour l&apos;instant.
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={({ entry }) => entry.participationId}
          action={{
            label: isAdmin ? "Voir la copie" : "Voir mes résultats",
            cell: ({ entry }) => {
              const href = copyHref(entry)
              if (!href) return null
              return (
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className={cn("whitespace-nowrap", TOUCH_HEIGHT)}
                >
                  <Link
                    href={href}
                    data-testid={`btn-view-copy-${entry.participationId}`}
                  >
                    {isAdmin ? "Voir la copie" : "Voir mes résultats"}
                  </Link>
                </Button>
              )
            },
          }}
          empty={
            <p className="bg-surface border-line text-ink-3 rounded-lg border px-5 py-6 text-sm">
              Aucun participant ne correspond à « {search.trim()} ».
            </p>
          }
        />
      )}

      {leaderboard.length > 0 && query === "" && (
        <div className="text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
          <span data-testid="leaderboard-summary">
            {truncated
              ? `${LEADERBOARD_PREVIEW} premiers sur ${leaderboard.length.toLocaleString("fr-CA")}.`
              : `${leaderboard.length.toLocaleString("fr-CA")} ${leaderboard.length > 1 ? "copies soumises" : "copie soumise"}.`}
            {isAdmin &&
              " Supprimer une participation, depuis sa copie, permet à l'étudiant de repasser l'examen."}
          </span>
          {truncated && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOUCH_HEIGHT}
              onClick={() => setShowAll(true)}
              data-testid="btn-leaderboard-show-all"
            >
              Afficher tout
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
