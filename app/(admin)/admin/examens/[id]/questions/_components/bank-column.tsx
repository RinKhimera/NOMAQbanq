"use client"

import { ListPlus, Plus, SearchX } from "lucide-react"
import { NotUsedSinceField } from "@/components/admin/not-used-since-field"
import {
  countLabel,
  isSignificant,
} from "@/components/admin/question-detail/labels"
import { TablePagination } from "@/components/shared/data-table/table-pagination"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import { PendingRegion } from "@/components/ui/pending-region"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { MEDICAL_DOMAINS } from "@/constants"
import type { BankQuestion } from "@/features/questions/dal"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { NOT_USED_SINCE_MAX } from "../../../../questions/_components/question-params"
import { lastUseLabel, rangeLabel } from "./composer-model"
import {
  type BankSort,
  type ComposerState,
  SORT_LABEL,
} from "./composer-params"
import { ComposerRow, LastUseTag } from "./composer-row"

const SORTS: BankSort[] = ["lastUse", "domain", "successRate"]

export const BankColumn = ({
  state,
  bank,
  pageSize,
  now,
  search,
  onSearch,
  isSearching,
  isPending,
  onChange,
  onPage,
  onClear,
  onPreview,
  onAdd,
  room,
  writing,
  busyKey,
  className,
}: {
  state: ComposerState
  bank: { items: BankQuestion[]; total: number }
  /** Questions par page (`BANK_PAGE_SIZE`, lu par la page serveur). */
  pageSize: number
  now: number
  search: string
  onSearch: (value: string) => void
  isSearching: boolean
  /** Rechargement de la banque (filtre, tri, page). */
  isPending: boolean
  onChange: (change: Partial<Omit<ComposerState, "page" | "back">>) => void
  onPage: (page: number) => void
  onClear: () => void
  onPreview: (q: BankQuestion) => void
  onAdd: (key: string, ids: string[]) => void
  /** Places restantes avant le visé : le serveur refuse un ajout au-delà. */
  room: number
  writing: boolean
  busyKey: string | null
  className?: string
}) => {
  const { items, total } = bank
  const spin = (key: string) => writing && busyKey === key
  return (
    <section
      aria-label="Banque"
      data-testid="composer-bank"
      className={cn(
        "bg-surface border-line flex min-w-0 flex-col gap-2.5 rounded-lg border pb-1",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-3.5 pt-3.5">
        <h2 className="type-h4 text-ink">Banque</h2>
        <span className="text-ink-3 font-mono text-xs">
          {countLabel(total, "question")}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 px-3.5">
        <SearchInput
          value={search}
          onValueChange={onSearch}
          isSearching={isSearching}
          placeholder="Énoncé, choix de réponse, objectif ou identifiant"
          containerClassName="flex-[1_1_100%]"
          data-testid="composer-bank-search"
        />
        <Select
          value={state.domain || "all"}
          onValueChange={(d) => onChange({ domain: d === "all" ? "" : d })}
        >
          <SelectTrigger
            aria-label="Domaine"
            className="min-w-0 flex-[1_1_170px]"
            data-testid="composer-bank-domain"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les domaines</SelectItem>
            {MEDICAL_DOMAINS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state.sort}
          onValueChange={(sort) => onChange({ sort: sort as BankSort })}
        >
          <SelectTrigger
            aria-label="Tri"
            className="min-w-0 flex-[1_1_170px]"
            data-testid="composer-bank-sort"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="border-line flex-[1_1_100%] rounded-md border px-2.5 py-2">
          <NotUsedSinceField
            name="composer-not-used-since"
            layout="row"
            max={NOT_USED_SINCE_MAX}
            value={state.since}
            onChange={(since) => onChange({ since })}
          />
        </div>
      </div>

      <PendingRegion isPending={isPending} className="flex flex-col gap-2.5">
        {items.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-2.5 pl-3.5">
              <span className="text-ink-3 font-mono text-xs">
                {rangeLabel(state.page, pageSize, total)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={writing || room === 0}
                onClick={() =>
                  onAdd(
                    "add-page",
                    items.slice(0, room).map((q) => q.id),
                  )
                }
                className={TOUCH_HEIGHT}
                data-testid="btn-composer-add-page"
              >
                {spin("add-page") ? (
                  <Spinner size="sm" />
                ) : (
                  <ListPlus aria-hidden />
                )}
                {room >= items.length
                  ? `Ajouter les ${items.length} affichées`
                  : `Ajouter les ${room} premières`}
              </Button>
            </div>
            <ul>
              {items.map((q) => (
                <ComposerRow
                  key={q.id}
                  q={q}
                  onPreview={onPreview}
                  testId="composer-bank-row"
                  meta={
                    <>
                      <span>{q.domain}</span>
                      <LastUseTag
                        label={q.lastUse ? lastUseLabel(q.lastUse, now) : null}
                        recent={q.lastUse?.recent ?? false}
                      />
                      {q.successRate !== null &&
                      isSignificant(q.answerCount) ? (
                        <span className="font-mono">{q.successRate} %</span>
                      ) : (
                        <span className="text-ink-3">Non significatif</span>
                      )}
                    </>
                  }
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={writing || room === 0}
                      onClick={() => onAdd(`add:${q.id}`, [q.id])}
                      aria-label={`Ajouter : ${q.question.slice(0, 80)}`}
                      className={TOUCH_HEIGHT}
                      data-testid="btn-composer-add"
                    >
                      {spin(`add:${q.id}`) ? (
                        <Spinner size="sm" />
                      ) : (
                        <Plus aria-hidden />
                      )}
                      Ajouter
                    </Button>
                  }
                />
              ))}
            </ul>
          </>
        ) : total > 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
            <p className="text-ink text-[0.9375rem] font-medium">
              Cette page n&apos;existe plus.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPage(1)}
            >
              Revenir à la première page
            </Button>
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-2 px-4 py-9 text-center"
            data-testid="composer-bank-empty"
          >
            <SearchX aria-hidden className="text-ink-3 size-5" />
            <p className="text-ink text-[0.9375rem] font-medium">
              Aucune question ne correspond.
            </p>
            <p className="text-ink-3 max-w-95 text-[0.8125rem]">
              La recherche porte sur l&apos;énoncé, les choix de réponse,
              l&apos;objectif et l&apos;identifiant. Les questions déjà choisies
              n&apos;apparaissent pas dans la banque.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={onClear}>
              Effacer les filtres
            </Button>
          </div>
        )}
      </PendingRegion>

      {total > pageSize && (
        <TablePagination
          page={state.page}
          pageSize={pageSize}
          total={total}
          isLoading={isPending}
          summary="page"
          itemNoun={{ one: "question", many: "questions" }}
          onPageChange={onPage}
        />
      )}
    </section>
  )
}
