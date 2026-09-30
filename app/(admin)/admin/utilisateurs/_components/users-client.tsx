"use client"

import { Download, Info, SearchX, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
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
import { Input } from "@/components/ui/input"
import { PendingRegion } from "@/components/ui/pending-region"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  AdminUserRow,
  AdminUsersPage,
  UserSegment,
  UsersHeadline,
} from "@/features/users/dal"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatMediumDate } from "@/lib/format"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { ExportUsersDialog } from "./export-users-dialog"
import {
  accessCellText,
  accessState,
  backfillDateLabel,
  isBackfilledLogin,
  userLabel,
} from "./user-labels"
import {
  type UserListState,
  type UserPeriod,
  type UserSort,
  isFiltered,
  serializeUserList,
  toUsersFilters,
  withChange,
} from "./user-params"

const PAGE_SIZE = 20

const SEGMENTS: { value: UserSegment; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Accès actif" },
  { value: "expiring", label: "Expire bientôt" },
  { value: "expired", label: "Expiré" },
  { value: "never", label: "Jamais eu d'accès" },
]

const ACCESS_TONE = {
  active: "success",
  expiring: "warning",
  expired: "danger",
} as const satisfies Record<string, Tone>

const AccessCell = ({
  user,
  expiresAt,
  now,
}: {
  user: AdminUserRow
  expiresAt: number | null
  now: number
}) => {
  if (user.role === "admin")
    return <span className="text-ink-3 text-[0.8125rem]">Illimité</span>
  const a = accessState(expiresAt, now)
  if (a.state === "never")
    return (
      <span className="text-ink-3" aria-label="Jamais eu">
        —
      </span>
    )
  return (
    <StatusPill tone={ACCESS_TONE[a.state]} className="font-mono">
      {accessCellText(a)}
    </StatusPill>
  )
}

const RoleCell = ({ user }: { user: AdminUserRow }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5">
    {user.role === "admin" ? (
      <StatusPill tone="neutral">Administrateur</StatusPill>
    ) : (
      <span className="text-ink-3">Étudiant</span>
    )}
    {user.banned && <BannedPill />}
  </span>
)

const LoginCell = ({ at }: { at: number | null }) =>
  at === null ? (
    <span
      className="text-ink-3"
      aria-label="Jamais connecté depuis la migration"
    >
      —
    </span>
  ) : (
    <span
      className={cn(
        "font-mono text-xs whitespace-nowrap",
        isBackfilledLogin(at) ? "text-ink-3" : "text-ink-2",
      )}
    >
      {formatMediumDate(at)}
    </span>
  )

const UserCell = ({ user }: { user: AdminUserRow }) => (
  <Link
    href={`/admin/utilisateurs/${user.id}`}
    prefetch={false}
    onClick={(e) => e.stopPropagation()}
    className="focus-ring group flex items-center gap-2.5 rounded-sm"
  >
    <UserAvatar
      name={userLabel(user.name)}
      image={user.image}
      className="size-7"
    />
    <span className="flex min-w-0 flex-col gap-px text-[0.8125rem]">
      <span
        className={cn(
          "font-medium group-hover:underline group-hover:underline-offset-3",
          user.name.trim() ? "text-ink" : "text-ink-3 italic",
        )}
      >
        {userLabel(user.name)}
      </span>
      <span className="text-ink-3 truncate text-xs">
        {user.username ? `@${user.username} · ` : ""}
        {user.email}
      </span>
    </span>
  </Link>
)

/**
 * Liste des utilisateurs : « qui est ce compte et que fait-il ? ». Recherche
 * en tête, filtres sur une ligne, segments d'accès avec compteurs, 20 lignes
 * par page ; un clic ouvre la fiche.
 */
export const UsersClient = ({
  state,
  page,
  headline,
  initialNow,
}: {
  state: UserListState
  page: AdminUsersPage
  headline: UsersHeadline
  initialNow: number
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(state.q)
  const [exportOpen, setExportOpen] = useState(false)

  const go = (next: UserListState) =>
    startTransition(() => {
      const params = serializeUserList(next)
      router.replace(params.size ? `${pathname}?${params}` : pathname, {
        scroll: false,
      })
    })
  const change = (c: Partial<Omit<UserListState, "page">>) =>
    go(withChange(state, c))

  useDebouncedValue(search, 300, (value) => {
    if (value.trim() !== state.q) change({ q: value.trim() })
  })

  const sortOn = (field: UserSort) => ({
    direction: state.sort === field ? state.order : null,
    onToggle: () =>
      change({
        sort: field,
        order: state.sort === field && state.order === "desc" ? "asc" : "desc",
      }),
  })

  const clear = () => {
    setSearch("")
    go({
      ...state,
      q: "",
      role: "all",
      period: "all",
      from: "",
      to: "",
      suspended: false,
      segment: "all",
      page: 1,
    })
  }

  const now = initialNow
  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      id: "user",
      label: "Utilisateur",
      required: true,
      sort: sortOn("name"),
      cell: (u) => <UserCell user={u} />,
    },
    { id: "role", label: "Rôle", cell: (u) => <RoleCell user={u} /> },
    {
      id: "exam",
      label: "Examens",
      cell: (u) => (
        <AccessCell user={u} expiresAt={u.examExpiresAt} now={now} />
      ),
    },
    {
      id: "training",
      label: "Entraînement",
      cell: (u) => (
        <AccessCell user={u} expiresAt={u.trainingExpiresAt} now={now} />
      ),
    },
    {
      id: "createdAt",
      label: "Inscrit le",
      sort: sortOn("createdAt"),
      cell: (u) => (
        <span className="font-mono text-xs whitespace-nowrap">
          {formatMediumDate(u.createdAt)}
        </span>
      ),
    },
    {
      id: "lastLogin",
      label: "Dernière connexion",
      sort: sortOn("lastLogin"),
      cell: (u) => <LoginCell at={u.lastLoginAt} />,
    },
  ]

  const segmentOptions = SEGMENTS.map((s) => ({
    ...s,
    count: page.segmentCounts[s.value],
  }))
  const noun = `utilisateur${page.total > 1 ? "s" : ""}`

  return (
    <>
      <PageIntro
        eyebrow="Comptes"
        title="Utilisateurs"
        description={`${headline.total.toLocaleString("fr-CA")} comptes · ${headline.newLast30Days} nouveaux sur 30 jours`}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => setExportOpen(true)}
          >
            <Download aria-hidden="true" />
            Exporter {page.total.toLocaleString("fr-CA")} {noun}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          isSearching={isPending && search.trim() !== state.q}
          placeholder="Retrouver un compte : nom, courriel ou nom d'utilisateur…"
          containerClassName="flex-[1_1_260px] md:max-w-[420px]"
          className="text-[0.9375rem]"
        />
        <Select
          value={state.role}
          onValueChange={(role) =>
            change({ role: role as UserListState["role"] })
          }
        >
          <SelectTrigger
            aria-label="Rôle"
            className="w-47.5 max-md:w-[calc(50%-4px)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="user">Étudiants</SelectItem>
            <SelectItem value="admin">Administrateurs</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={state.period}
          onValueChange={(period) => change({ period: period as UserPeriod })}
        >
          <SelectTrigger
            aria-label="Période d'inscription"
            className="w-47.5 max-md:w-[calc(50%-4px)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute inscription</SelectItem>
            <SelectItem value="month">Inscrits ce mois</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
            <SelectItem value="custom">Dates au choix</SelectItem>
          </SelectContent>
        </Select>
        <label
          className={cn(
            "border-line-strong bg-surface text-ink-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap max-md:h-11 pointer-coarse:h-11",
            state.suspended && "border-ink-3 text-ink",
          )}
        >
          <Switch
            checked={state.suspended}
            onCheckedChange={(suspended) => change({ suspended })}
            data-testid="filter-suspended"
          />
          Suspendus
        </label>
        {isFiltered(state) && (
          <Button type="button" variant="ghost" onClick={clear}>
            <X aria-hidden="true" />
            Effacer
          </Button>
        )}
        {state.period === "custom" && (
          <div className="flex basis-full flex-wrap gap-2">
            {(
              [
                ["from", "Du"],
                ["to", "Au"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex w-42.5 flex-col gap-1 text-sm">
                {label}
                <Input
                  type="date"
                  value={state[key]}
                  onChange={(e) => change({ [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="max-md:hidden">
        <SegmentedControl
          label="Segments d'accès"
          value={state.segment}
          options={segmentOptions}
          onValueChange={(segment) => change({ segment })}
          testIdPrefix="segment"
          className="max-w-full overflow-x-auto pointer-coarse:h-13"
        />
      </div>
      <div className="md:hidden">
        <Select
          value={state.segment}
          onValueChange={(segment) =>
            change({ segment: segment as UserSegment })
          }
        >
          <SelectTrigger aria-label="Segments d'accès" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {segmentOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label} · {s.count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-surface border-line overflow-hidden rounded-lg border">
        {page.items.length === 0 ? (
          <PendingRegion
            isPending={isPending}
            className="flex flex-col items-center gap-2 px-5 py-9 text-center"
          >
            <SearchX aria-hidden="true" className="text-ink-3 size-5" />
            <p className="text-ink text-[0.9375rem] font-medium">
              Aucun utilisateur ne correspond
              {state.q ? ` à « ${state.q} »` : " à ces filtres"}
            </p>
            <p className="text-ink-3 max-w-md text-[0.8125rem]">
              La recherche porte sur le nom, le courriel et le nom
              d&apos;utilisateur. Un compte supprimé n&apos;apparaît dans aucune
              liste.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              Effacer les filtres
            </Button>
          </PendingRegion>
        ) : (
          <>
            <div className="max-lg:hidden">
              <DataTable
                columns={columns}
                rows={page.items}
                getRowId={(u) => u.id}
                isPending={isPending}
                onRowClick={(u) => router.push(`/admin/utilisateurs/${u.id}`)}
              />
            </div>
            <PendingRegion isPending={isPending} className="lg:hidden">
              <ul>
                {page.items.map((u) => (
                  <li
                    key={u.id}
                    className="border-line border-t first:border-t-0"
                  >
                    <Link
                      href={`/admin/utilisateurs/${u.id}`}
                      prefetch={false}
                      className="focus-ring hover:bg-surface-2 flex min-h-14 flex-col gap-2 px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          name={userLabel(u.name)}
                          image={u.image}
                          className="size-7"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span
                            className={cn(
                              "font-medium",
                              u.name.trim() ? "text-ink" : "text-ink-3 italic",
                            )}
                          >
                            {userLabel(u.name)}
                          </span>
                          <span className="text-ink-3 text-xs wrap-anywhere">
                            {u.email}
                          </span>
                        </span>
                      </span>
                      <span className="text-ink-2 flex flex-wrap gap-x-3.5 gap-y-1.5 pl-9.5 text-[0.8125rem]">
                        <RoleCell user={u} />
                        <span className="inline-flex items-center gap-1">
                          Examens :{" "}
                          <AccessCell
                            user={u}
                            expiresAt={u.examExpiresAt}
                            now={now}
                          />
                        </span>
                        <span className="inline-flex items-center gap-1">
                          Entraînement :{" "}
                          <AccessCell
                            user={u}
                            expiresAt={u.trainingExpiresAt}
                            now={now}
                          />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PendingRegion>
            <TablePagination
              page={state.page}
              pageSize={PAGE_SIZE}
              total={page.total}
              isLoading={isPending}
              itemNoun={{ one: "utilisateur", many: "utilisateurs" }}
              onPageChange={(p) => {
                go({ ...state, page: p })
                window.scrollTo({ top: 0 })
              }}
            />
          </>
        )}
      </div>

      {/* Note provisoire : à retirer quand la dernière connexion redevient
          parlante (quelques semaines après le remplissage d'office). */}
      {page.items.length > 0 && (
        <p className="text-ink-3 flex items-start gap-1.5 text-xs leading-normal">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />«
          Dernière connexion » a été remplie d&apos;office le{" "}
          {backfillDateLabel()} pour tous les comptes ; elle ne distingue
          personne avant quelques semaines.
        </p>
      )}

      <ExportUsersDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        count={page.total}
        state={state}
        filters={toUsersFilters(state, initialNow)}
      />
    </>
  )
}
