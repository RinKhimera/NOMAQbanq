"use client"

import { SearchX, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { TablePagination } from "@/components/shared/data-table/table-pagination"
import { PageIntro } from "@/components/shared/page-intro"
import { SearchInput } from "@/components/shared/search-input"
import { BannedPill, StatusPill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PendingRegion } from "@/components/ui/pending-region"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  StudentAccess,
  StudentProgressPage,
  StudentProgressRow,
  StudentProgressSort,
} from "@/features/analytics/dal.admin-progression"
import { toggledOrder, useUrlListState } from "@/hooks/use-url-list-state"
import { STUDENT_PROGRESS_PAGE_SIZE } from "@/lib/admin-progression"
import type { DashboardPeriod } from "@/lib/dashboard-period"
import { NBSP, formatMediumDate } from "@/lib/format"
import { formatTrend } from "@/lib/progression"
import { formatScore } from "@/lib/score"
import { cn } from "@/lib/utils"
import { userLabel } from "../../utilisateurs/_components/user-labels"
import {
  type ProgressionListState,
  cleared,
  isFiltered,
  serializeProgressionList,
  studentProgressHref,
  withChange,
} from "./progression-params"

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "tout", label: "Tout" },
]

const ACCESS_OPTIONS: {
  value: ProgressionListState["access"]
  label: string
}[] = [
  { value: "all", label: "Tous les accès" },
  { value: "active", label: "Actif" },
  { value: "expired", label: "Expiré" },
  { value: "none", label: "Aucun" },
]

const Dash = () => <span className="text-ink-3">—</span>

const fmt = (n: number) => n.toLocaleString("fr-CA")

const AccessCell = ({ access }: { access: StudentAccess }) =>
  access === "active" ? (
    <StatusPill tone="success">Actif</StatusPill>
  ) : access === "expired" ? (
    <StatusPill tone="danger">Expiré</StatusPill>
  ) : (
    <span className="text-ink-3 text-[0.8125rem]">Aucun</span>
  )

const ScoreCell = ({ row }: { row: StudentProgressRow }) =>
  row.averageScore === null ? (
    <Dash />
  ) : (
    <span className="inline-flex flex-col items-end gap-px">
      <span className="text-ink font-mono">
        {formatScore(row.averageScore)}
      </span>
      {row.averageTrend !== null && (
        <span className="text-ink-3 font-mono text-xs">
          <span className="sr-only">Tendance </span>
          {formatTrend(row.averageTrend)}
        </span>
      )}
    </span>
  )

const examsText = (row: StudentProgressRow) =>
  row.examsGraded === null
    ? null
    : `${row.examsPassed ?? 0}${NBSP}/${NBSP}${row.examsGraded}`

const Num = ({ value }: { value: number | null }) =>
  value === null ? <Dash /> : <span className="font-mono">{fmt(value)}</span>

const LastActivity = ({ at }: { at: number | null }) =>
  at === null ? (
    <Dash />
  ) : (
    <span className="text-ink-2 font-mono text-xs whitespace-nowrap">
      {formatMediumDate(at)}
    </span>
  )

const StudentCell = ({
  row,
  href,
}: {
  row: StudentProgressRow
  href: string
}) => (
  <span className="flex flex-wrap items-center gap-2">
    <Link
      href={href}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      className="focus-ring group flex items-center gap-2.5 rounded-sm"
    >
      <UserAvatar
        name={userLabel(row.name)}
        image={row.image}
        className="size-7"
      />
      <span className="flex max-w-48 min-w-0 flex-col gap-px text-[0.8125rem]">
        <span
          className={cn(
            "font-medium group-hover:underline group-hover:underline-offset-3",
            row.name.trim() ? "text-ink" : "text-ink-3 italic",
          )}
        >
          {userLabel(row.name)}
        </span>
        <span className="text-ink-3 truncate text-xs">{row.email}</span>
      </span>
    </Link>
    {row.banned && <BannedPill />}
  </span>
)

/**
 * Tableau de suivi : une ligne par étudiant, les chiffres de sa bande
 * Progression sur la période, triables ; un clic ouvre sa progression.
 */
export const ProgressionListClient = ({
  state,
  page,
}: {
  state: ProgressionListState
  page: StudentProgressPage
}) => {
  const router = useRouter()
  const { search, setSearch, isPending, latest, go } = useUrlListState({
    state,
    serialize: serializeProgressionList,
    withSearch: (current, q) => withChange(current, { q }),
  })
  const change = (c: Partial<Omit<ProgressionListState, "page">>) =>
    go(withChange(latest(), c))

  const sortOn = (field: StudentProgressSort) => ({
    direction: state.sort === field ? state.order : null,
    onToggle: () =>
      change({ sort: field, order: toggledOrder(latest(), field) }),
  })

  const clear = () => {
    setSearch("")
    go(cleared(latest()))
  }

  const hrefOf = (row: StudentProgressRow) => studentProgressHref(row.id, state)
  const number = "text-right"
  const columns: DataTableColumn<StudentProgressRow>[] = [
    {
      id: "student",
      label: "Étudiant",
      required: true,
      cell: (r) => <StudentCell row={r} href={hrefOf(r)} />,
    },
    {
      id: "access",
      label: "Accès",
      cell: (r) => <AccessCell access={r.access} />,
    },
    {
      id: "score",
      label: "Score moyen",
      sort: sortOn("score"),
      className: number,
      cell: (r) => <ScoreCell row={r} />,
    },
    {
      id: "passed",
      label: "Examens réussis",
      sort: sortOn("passed"),
      className: number,
      cell: (r) => {
        const text = examsText(r)
        return text === null ? (
          <Dash />
        ) : (
          <span className="font-mono">{text}</span>
        )
      },
    },
    {
      id: "questions",
      label: "Questions pratiquées",
      sort: sortOn("questions"),
      className: number,
      cell: (r) => <Num value={r.questionCount} />,
    },
    {
      id: "days",
      label: "Jours d'activité",
      sort: sortOn("days"),
      className: number,
      cell: (r) => <Num value={r.activityDays} />,
    },
    {
      id: "lastActivity",
      label: "Dernière activité",
      sort: sortOn("lastActivity"),
      className: number,
      cell: (r) => <LastActivity at={r.lastActivityAt} />,
    },
  ]

  return (
    <>
      <PageIntro
        eyebrow="Comptes"
        title="Progression"
        description="Les résultats des étudiants sur la période choisie : score moyen, examens blancs, entraînement et activité."
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          isSearching={isPending && search.trim() !== state.q}
          placeholder="Nom ou courriel…"
          containerClassName="flex-[1_1_240px] md:max-w-[360px]"
          className="text-[0.9375rem]"
        />
        <Select
          value={state.access}
          onValueChange={(access) =>
            change({ access: access as ProgressionListState["access"] })
          }
        >
          <SelectTrigger
            aria-label="Accès"
            className="w-47.5 max-md:w-[calc(50%-4px)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCESS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label
          className={cn(
            "border-line-strong bg-surface text-ink-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap max-md:h-11 max-md:w-[calc(50%-4px)] pointer-coarse:h-11",
            state.activeOnly && "border-ink-3 text-ink",
          )}
        >
          <Checkbox
            checked={state.activeOnly}
            onCheckedChange={(checked) =>
              change({ activeOnly: checked === true })
            }
            data-testid="filter-active-only"
          />
          Actifs seulement
        </label>
        <SegmentedControl
          label="Période"
          value={state.period}
          options={PERIODS}
          onValueChange={(period) => change({ period })}
          testIdPrefix="period"
        />
        {isFiltered(state) && (
          <Button type="button" variant="ghost" onClick={clear}>
            <X aria-hidden="true" />
            Effacer
          </Button>
        )}
      </div>

      <div className="bg-surface border-line overflow-hidden rounded-lg border">
        {page.items.length === 0 ? (
          <PendingRegion
            isPending={isPending}
            className="flex flex-col items-center gap-2 px-5 py-9 text-center"
          >
            <SearchX aria-hidden="true" className="text-ink-3 size-5" />
            <p className="text-ink text-[0.9375rem] font-medium">
              Aucun étudiant ne correspond
              {state.q ? ` à «${NBSP}${state.q}${NBSP}»` : " à ces filtres"}
            </p>
            <p className="text-ink-3 max-w-md text-[0.8125rem]">
              La recherche porte sur le nom et le courriel. «{NBSP}Actifs
              seulement{NBSP}» retient les étudiants actifs sur la période
              choisie.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              Effacer les filtres
            </Button>
          </PendingRegion>
        ) : (
          <>
            <div className="max-lg:hidden" data-testid="progression-table">
              <DataTable
                columns={columns}
                rows={page.items}
                getRowId={(r) => r.id}
                isPending={isPending}
                onRowClick={(r) => router.push(hrefOf(r))}
              />
            </div>
            <PendingRegion isPending={isPending} className="lg:hidden">
              <ul>
                {page.items.map((r) => (
                  <li
                    key={r.id}
                    className="border-line border-t first:border-t-0"
                  >
                    <Link
                      href={hrefOf(r)}
                      prefetch={false}
                      className="focus-ring hover:bg-surface-2 flex min-h-14 flex-col gap-2 px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          name={userLabel(r.name)}
                          image={r.image}
                          className="size-7"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "font-medium",
                                r.name.trim()
                                  ? "text-ink"
                                  : "text-ink-3 italic",
                              )}
                            >
                              {userLabel(r.name)}
                            </span>
                            {r.banned && <BannedPill />}
                          </span>
                          <span className="text-ink-3 text-xs wrap-anywhere">
                            {r.email}
                          </span>
                        </span>
                      </span>
                      <span className="text-ink-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pl-9.5 text-[0.8125rem]">
                        <AccessCell access={r.access} />
                        <span>
                          Score{NBSP}:{" "}
                          {r.averageScore === null ? (
                            "—"
                          ) : (
                            <span className="text-ink font-mono">
                              {formatScore(r.averageScore)}
                            </span>
                          )}
                        </span>
                        <span>
                          Examens{NBSP}:{" "}
                          <span className="font-mono">
                            {examsText(r) ?? "—"}
                          </span>
                        </span>
                        <span>
                          Dernière activité{NBSP}:{" "}
                          {r.lastActivityAt === null ? (
                            "—"
                          ) : (
                            <span className="font-mono">
                              {formatMediumDate(r.lastActivityAt)}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PendingRegion>
            <TablePagination
              page={state.page}
              pageSize={STUDENT_PROGRESS_PAGE_SIZE}
              total={page.total}
              isLoading={isPending}
              itemNoun={{ one: "étudiant", many: "étudiants" }}
              onPageChange={(p) => {
                go({ ...latest(), page: p })
                window.scrollTo({ top: 0 })
              }}
            />
          </>
        )}
      </div>
    </>
  )
}
