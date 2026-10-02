"use client"

import Link from "next/link"
import { useState } from "react"
import {
  countLabel,
  formatCount,
} from "@/components/admin/question-detail/labels"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { SearchInput } from "@/components/shared/search-input"
import { StatusPill, type StatusTone } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { examCopyHref } from "@/constants/exam-routes"
import type { LeaderboardEntry, LeaderboardFlag } from "@/features/exams/dal"
import { formatScore, scoreTextClass } from "@/lib/score"
import { foldForSearch } from "@/lib/search"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { populationRanks } from "./exam-detail-model"

/** Lignes montrées avant « Afficher tout ». */
export const LEADERBOARD_PREVIEW = 10

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
  /** Examen encore ouvert : le classement peut encore bouger. */
  provisional?: boolean
}

/**
 * Classement admin d'un examen : toutes les copies soumises, rang sur la
 * population du classement (une recherche ne le change pas), « 10 premiers »
 * puis « Afficher tout », et la copie de chacun.
 */
export function ExamLeaderboard({
  examId,
  leaderboard,
  provisional = false,
}: ExamLeaderboardProps) {
  const [search, setSearch] = useState("")
  const [showAll, setShowAll] = useState(false)

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

  const copyHref = (entry: LeaderboardEntry) =>
    entry.user ? examCopyHref(examId, entry.user.id) : null

  const columns: DataTableColumn<RankedEntry>[] = [
    {
      id: "rank",
      label: "Rang",
      className: "w-16",
      cellClassName: "font-mono text-ink-2 tabular-nums",
      cell: ({ rank }) =>
        rank === null ? (
          <span title="Hors classement : compte admin ou supprimé">—</span>
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
    {
      id: "submission",
      label: "Soumission",
      visibleFrom: "medium",
      cell: ({ entry }) =>
        entry.status === "auto_submitted" ? (
          <StatusPill tone="warning">Automatique</StatusPill>
        ) : (
          <span className="text-ink-3">Manuelle</span>
        ),
    },
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
              Provisoire : l&apos;examen est encore ouvert
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
            label: "Voir la copie",
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
                    Voir la copie
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
              ? `${LEADERBOARD_PREVIEW} premiers sur ${formatCount(leaderboard.length)}.`
              : `${countLabel(leaderboard.length, "copie soumise", "copies soumises")}.`}
            {
              " Supprimer une participation, depuis sa copie, permet à l'étudiant de repasser l'examen."
            }
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
