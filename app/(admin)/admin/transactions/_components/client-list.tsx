"use client"

import { SearchX } from "lucide-react"
import { useRef } from "react"
import { KeysetPagination } from "@/components/shared/data-table/keyset-pagination"
import { TransactionStatusPill } from "@/components/shared/payments/transaction-status"
import { SearchInput } from "@/components/shared/search-input"
import { StatusPill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import type {
  ClientFilter,
  TransactionClientsPage,
} from "@/features/payments/dal"
import { CLIENT_PAGE_SIZE } from "@/features/payments/page-sizes"
import { formatDayMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Liste des clients : recherche, filtres exclusifs, tranches de 20. */
export const ClientList = ({
  clients,
  search,
  onSearchChange,
  isSearching,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  onPrevious,
  onNext,
  onClear,
  isPending,
}: {
  clients: TransactionClientsPage
  search: string
  onSearchChange: (value: string) => void
  isSearching: boolean
  filter: ClientFilter
  onFilterChange: (filter: ClientFilter) => void
  selectedId: string | null
  onSelect: (userId: string) => void
  onPrevious?: () => void
  onNext?: () => void
  onClear: () => void
  isPending: boolean
}) => {
  const listRef = useRef<HTMLUListElement>(null)
  const page = (go?: () => void) =>
    go &&
    (() => {
      listRef.current?.scrollTo({ top: 0 })
      go()
    })

  return (
    <aside
      aria-label="Clients"
      className="bg-surface border-line flex min-w-0 flex-col rounded-lg border lg:sticky lg:top-[calc(var(--shell-offset,0px)+1rem)] lg:max-h-[calc(100dvh-var(--shell-offset,0px)-2rem)]"
    >
      <div className="border-line flex flex-col gap-2.5 border-b p-3.5">
        <SearchInput
          value={search}
          onValueChange={onSearchChange}
          isSearching={isSearching}
          placeholder="Nom ou courriel du client"
        />
        <div className="-mx-1 overflow-x-auto px-1">
          <SegmentedControl
            label="Filtrer les clients"
            value={filter}
            onValueChange={onFilterChange}
            testIdPrefix="client-filter"
            className="pointer-coarse:h-13"
            options={[
              { value: "all", label: "Tous" },
              { value: "failed", label: "Échec", count: clients.counts.failed },
              {
                value: "dispute",
                label: "Litige",
                count: clients.counts.dispute,
              },
              {
                value: "manual",
                label: "Manuel",
                count: clients.counts.manual,
              },
            ]}
          />
        </div>
      </div>

      {clients.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-9 text-center">
          <SearchX aria-hidden="true" className="text-ink-3 size-5" />
          <p className="text-ink text-[0.9375rem] font-medium">
            Aucune transaction ne correspond
            {search.trim() ? ` à « ${search.trim()} »` : " à ces filtres"}
          </p>
          <p className="text-ink-3 max-w-sm text-[0.8125rem]">
            Vérifiez l&apos;orthographe du nom ou du courriel, ou élargissez les
            filtres.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onClear}>
            Effacer les filtres
          </Button>
        </div>
      ) : (
        <ul
          ref={listRef}
          aria-busy={isPending}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto transition-opacity",
            isPending && "pointer-events-none opacity-60",
          )}
        >
          {clients.items.map((c) => {
            const on = c.userId === selectedId
            const label = c.name.trim() || c.email
            return (
              <li
                key={c.userId}
                className="border-line border-t first:border-t-0"
              >
                <button
                  type="button"
                  aria-current={on || undefined}
                  data-testid={`client-${c.userId}`}
                  onClick={() => onSelect(c.userId)}
                  className={cn(
                    "focus-ring hover:bg-surface-2 grid w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-2.5 text-left max-lg:min-h-14 pointer-coarse:min-h-14",
                    on && "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]",
                  )}
                >
                  <UserAvatar name={label} image={c.image} className="size-7" />
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="text-ink truncate text-sm font-medium">
                      {label}
                    </span>
                    <span className="text-ink-3 truncate text-xs">
                      {c.email}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {c.openDispute ? (
                      <StatusPill tone="danger">Litige en cours</StatusPill>
                    ) : (
                      <TransactionStatusPill status={c.lastStatus} />
                    )}
                    <span className="text-ink-3 font-mono text-[0.6875rem]">
                      {formatDayMonth(c.lastActivityAt)} · {c.transactionCount}{" "}
                      tx
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {clients.items.length > 0 && (
        <KeysetPagination
          firstIndex={clients.firstIndex}
          count={clients.items.length}
          total={clients.total}
          pageSize={CLIENT_PAGE_SIZE}
          noun={{ one: "client", many: "clients" }}
          onPrevious={page(onPrevious)}
          onNext={page(onNext)}
          isPending={isPending}
        />
      )}
    </aside>
  )
}
