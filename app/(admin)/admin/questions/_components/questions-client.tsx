"use client"

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Image as ImageIcon,
  Minus,
  Plus,
  SearchX,
  TriangleAlert,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import {
  answersLabel,
  countLabel,
  isSignificant,
} from "@/components/admin/question-detail/labels"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { TablePagination } from "@/components/shared/data-table/table-pagination"
import { FilterChip } from "@/components/shared/filter-chip"
import {
  FilterGroup,
  FilterPanelButton,
} from "@/components/shared/filter-panel"
import { PageIntro } from "@/components/shared/page-intro"
import { SearchInput } from "@/components/shared/search-input"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { Button } from "@/components/ui/button"
import { PendingRegion } from "@/components/ui/pending-region"
import { Progress } from "@/components/ui/progress"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEDICAL_DOMAINS } from "@/constants"
import type { ExamPickerOption } from "@/features/exams/dal"
import type {
  QuestionListItem,
  QuestionListPage,
  QuestionSortBy,
} from "@/features/questions/dal"
import { QUESTIONS_PAGE_SIZE } from "@/features/questions/page-size"
import { RECENT_EXAMS_DEFAULT } from "@/features/questions/recent-exams"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { phaseOf } from "@/lib/exam-phase"
import { EXAM_STATUS_CONFIG } from "@/lib/exam-status"
import { formatMediumDate } from "@/lib/format"
import { scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { ExportQuestionsButton } from "./export-questions-button"
import {
  DEFAULT_QUESTION_LIST,
  FIRST_ORDER,
  type ImageFilter,
  NOT_USED_SINCE_MAX,
  type QuestionListState,
  type QuestionTab,
  panelFilterCount,
  questionHref,
  serializeQuestionList,
  toQuestionFilters,
  withChange,
} from "./question-params"

const IMAGE_OPTIONS: { value: ImageFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "with", label: "Avec" },
  { value: "without", label: "Sans" },
]

const notUsedSinceLabel = (n: number) =>
  `Pas utilisée depuis ${countLabel(n, "examen")}`

const sameDay = (a: number, b: number) =>
  formatMediumDate(a) === formatMediumDate(b)

const QuestionFlags = ({ q }: { q: QuestionListItem }) => (
  <>
    {q.keyToVerify && (
      <TriangleAlert
        role="img"
        aria-label="Clé à vérifier"
        className="text-warning mr-1.5 inline size-3.5 align-[-2px]"
      />
    )}
    {q.imageCount > 0 && (
      <ImageIcon
        role="img"
        aria-label="Image d'énoncé"
        className="text-ink-3 mr-1.5 inline size-3.5 align-[-2px]"
      />
    )}
  </>
)

const SuccessCell = ({ q }: { q: QuestionListItem }) =>
  q.successRate === null || !isSignificant(q.answerCount) ? (
    <span className="flex flex-col gap-px">
      <span className="text-ink-3 text-xs whitespace-nowrap">
        Non significatif
      </span>
      <span className="text-ink-3 font-mono text-[11px]">
        {answersLabel(q.answerCount)}
      </span>
    </span>
  ) : (
    <span className="flex flex-col gap-px">
      <span className="inline-flex items-center gap-2">
        <Progress
          value={q.successRate}
          indicatorColor={TONE_COLOR[scoreTone(q.successRate)]}
          aria-label={`Taux de réussite ${q.successRate} %`}
          className="h-1 w-11"
        />
        <span className="text-ink font-mono text-xs">{q.successRate} %</span>
      </span>
      <span className="text-ink-3 font-mono text-[11px]">
        {answersLabel(q.answerCount)}
      </span>
    </span>
  )

/** Bouton de tri d'en-tête ; la colonne Réussite en porte deux. */
const SortButton = ({
  label,
  field,
  state,
  onSort,
}: {
  label: string
  field: QuestionSortBy
  state: QuestionListState
  onSort: (field: QuestionSortBy) => void
}) => {
  const on = state.sort === field
  const Icon = !on ? ArrowUpDown : state.order === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Trier par ${label.toLowerCase()}`}
      aria-pressed={on}
      data-testid={`sort-${field}`}
      className={cn(
        "focus-ring inline-flex cursor-pointer items-center gap-1 rounded-xs text-xs font-semibold",
        on ? "text-ink" : "text-ink-3 hover:text-ink",
      )}
    >
      {label}
      <Icon aria-hidden className={cn("size-3", !on && "opacity-50")} />
    </button>
  )
}

/** « Toutes » ou « Pas utilisée depuis [n] examens », n de 1 à 20. */
const NotUsedSinceField = ({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number | null) => void
}) => {
  const [count, setCount] = useState(value ?? RECENT_EXAMS_DEFAULT)
  const setN = (n: number) => {
    const next = Math.max(1, Math.min(NOT_USED_SINCE_MAX, n))
    setCount(next)
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex min-h-8 cursor-pointer items-center gap-2">
        <input
          type="radio"
          name="not-used-since"
          checked={value === null}
          onChange={() => onChange(null)}
          className="size-4 accent-(--accent)"
        />
        Toutes
      </label>
      <label className="flex min-h-8 cursor-pointer flex-wrap items-center gap-2">
        <input
          type="radio"
          name="not-used-since"
          checked={value !== null}
          onChange={() => onChange(count)}
          className="size-4 accent-(--accent)"
        />
        Pas utilisée depuis
        <span className="border-line-strong inline-flex h-8 items-center rounded-md border">
          <button
            type="button"
            aria-label="Moins"
            disabled={count <= 1}
            onClick={() => setN(count - 1)}
            className="focus-ring text-ink-2 hover:bg-surface-2 flex size-8 cursor-pointer items-center justify-center rounded-l-md disabled:cursor-default disabled:opacity-40"
          >
            <Minus aria-hidden className="size-3" />
          </button>
          <input
            inputMode="numeric"
            aria-label="Nombre d'examens"
            value={count}
            onFocus={() => value === null && onChange(count)}
            onChange={(e) =>
              setN(Number(e.target.value.replace(/\D/g, "")) || 1)
            }
            className="w-8 bg-transparent text-center font-mono text-sm outline-none"
          />
          <button
            type="button"
            aria-label="Plus"
            disabled={count >= NOT_USED_SINCE_MAX}
            onClick={() => setN(count + 1)}
            className="focus-ring text-ink-2 hover:bg-surface-2 flex size-8 cursor-pointer items-center justify-center rounded-r-md disabled:cursor-default disabled:opacity-40"
          >
            <Plus aria-hidden className="size-3" />
          </button>
        </span>
        {count > 1 ? "examens" : "examen"}
      </label>
    </div>
  )
}

/**
 * Liste des questions : onglets à compteur, recherche, domaine et filtres
 * secondaires, 20 lignes par page. Un clic sur une ligne ouvre la page de
 * détail, qui garde la liste d'où l'on vient.
 */
export const QuestionsClient = ({
  state,
  list,
  objectivesByDomain,
  exams,
  initialNow,
}: {
  state: QuestionListState
  list: QuestionListPage
  objectivesByDomain: Record<string, string[]>
  exams: ExamPickerOption[]
  initialNow: number
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(state.q)

  // Dernier état demandé : pendant un rechargement, `state` (les props) est
  // encore l'ancien, et un second changement effacerait le premier.
  const requested = useRef(state)
  useEffect(() => {
    requested.current = state
  }, [state])
  const latest = () => requested.current

  const go = (next: QuestionListState) =>
    startTransition(() => {
      requested.current = next
      const params = serializeQuestionList(next)
      router.replace(params.size ? `${pathname}?${params}` : pathname, {
        scroll: false,
      })
    })
  const change = (c: Partial<Omit<QuestionListState, "page">>) =>
    go(withChange(latest(), c))

  useDebouncedValue(search, 300, (value) => {
    if (value.trim() !== latest().q) change({ q: value.trim() })
  })

  const onSort = (field: QuestionSortBy) => {
    const current = latest()
    change({
      sort: field,
      order:
        current.sort === field
          ? current.order === "desc"
            ? "asc"
            : "desc"
          : FIRST_ORDER[field],
    })
  }

  const clearAll = (keepTab: boolean) => {
    setSearch("")
    const current = latest()
    go({
      ...DEFAULT_QUESTION_LIST,
      tab: keepTab ? current.tab : "all",
      sort: current.sort,
      order: current.order,
    })
  }

  const examOptions = exams.map((e) => ({
    value: e.id,
    label: e.title,
    hint: EXAM_STATUS_CONFIG[phaseOf(e, initialNow)].label,
  }))
  const examTitle = exams.find((e) => e.id === state.exam)?.title
  const objectives = state.domain
    ? (objectivesByDomain[state.domain] ?? [])
    : []

  const chips: {
    label: string
    value: string
    reset: Partial<Omit<QuestionListState, "page">>
  }[] = [
    state.domain && {
      label: "Domaine",
      value: state.domain,
      reset: { domain: "" },
    },
    state.objective && {
      label: "Objectif",
      value: state.objective,
      reset: { objective: "" },
    },
    state.images !== "all" && {
      label: "Images",
      value: state.images === "with" ? "avec" : "sans",
      reset: { images: "all" as const },
    },
    state.notUsedSince !== null && {
      label: "Dernière utilisation",
      value: notUsedSinceLabel(state.notUsedSince),
      reset: { notUsedSince: null },
    },
    state.exam && {
      label: "Examen",
      value: examTitle ?? "Examen supprimé",
      reset: { exam: "" },
    },
  ].filter((c) => !!c)

  const open = (q: QuestionListItem) => router.push(questionHref(q.id, state))

  const columns: DataTableColumn<QuestionListItem>[] = [
    {
      id: "question",
      label: "Question",
      required: true,
      className: "min-w-72 max-w-[34rem]",
      cell: (q) => (
        <Link
          href={questionHref(q.id, state)}
          prefetch={false}
          onClick={(e) => e.stopPropagation()}
          data-testid="question-row-link"
          className="focus-ring text-ink line-clamp-2 rounded-xs text-[0.8125rem] leading-snug whitespace-normal hover:underline hover:underline-offset-3"
        >
          <QuestionFlags q={q} />
          {q.question}
        </Link>
      ),
    },
    {
      id: "domain",
      label: "Domaine",
      cell: (q) => (
        <span className="text-ink-2 whitespace-nowrap">{q.domain}</span>
      ),
    },
    {
      id: "objective",
      label: "Objectif CMC",
      className: "max-w-56",
      cell: (q) => (
        <span className="text-ink-2 line-clamp-2 whitespace-normal">
          {q.objectifCMC}
        </span>
      ),
    },
    {
      id: "success",
      label: "Réussite",
      header: (
        <span
          className="inline-flex items-center gap-3"
          title="Une colonne, deux tris : taux de réussite ou nombre de réponses"
        >
          <SortButton
            label="Réussite"
            field="successRate"
            state={state}
            onSort={onSort}
          />
          <SortButton
            label="Réponses"
            field="answerCount"
            state={state}
            onSort={onSort}
          />
        </span>
      ),
      cell: (q) => <SuccessCell q={q} />,
    },
    {
      id: "createdAt",
      label: "Créée",
      header: (
        <SortButton
          label="Créée"
          field="createdAt"
          state={state}
          onSort={onSort}
        />
      ),
      cell: (q) => (
        <span className="text-ink-2 font-mono text-xs whitespace-nowrap">
          {formatMediumDate(q.createdAt)}
        </span>
      ),
    },
    {
      id: "exams",
      label: "Examens",
      visibleFrom: "never",
      className: "text-right",
      cell: (q) => <span className="font-mono text-xs">{q.usageCount}</span>,
    },
    {
      id: "updatedAt",
      label: "Modifiée",
      visibleFrom: "never",
      header: (
        <SortButton
          label="Modifiée"
          field="updatedAt"
          state={state}
          onSort={onSort}
        />
      ),
      cell: (q) => (
        <span className="text-ink-2 font-mono text-xs whitespace-nowrap">
          {sameDay(q.updatedAt, q.createdAt)
            ? "—"
            : formatMediumDate(q.updatedAt)}
        </span>
      ),
    },
  ]

  const tabs: { value: QuestionTab; label: string; count: number }[] = [
    { value: "all", label: "Toutes", count: list.counts.all },
    { value: "toVerify", label: "Clé à vérifier", count: list.counts.toVerify },
    {
      value: "noReferences",
      label: "Sans références",
      count: list.counts.noReferences,
    },
  ]

  return (
    <>
      <PageIntro
        eyebrow="Contenu"
        title="Questions"
        description="Banque de l'entraînement et des examens blancs, classée par domaine et objectif du CMC."
        actions={
          <>
            <ExportQuestionsButton
              selection={toQuestionFilters(state)}
              questionCount={list.total}
            />
            <Button asChild>
              <Link href="/admin/questions/nouvelle">
                <Plus aria-hidden />
                Nouvelle question
              </Link>
            </Button>
          </>
        }
      />

      <SegmentedControl
        label="Onglets des questions"
        value={state.tab}
        options={tabs}
        onValueChange={(tab) => change({ tab })}
        testIdPrefix="tab"
        className="max-w-full self-start overflow-x-auto"
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          isSearching={isPending && search.trim() !== state.q}
          placeholder="Énoncé, choix de réponse, objectif ou identifiant"
          containerClassName="flex-[1_1_280px] md:max-w-[460px]"
          className="text-[0.9375rem]"
        />
        <Select
          value={state.domain || "all"}
          onValueChange={(d) => change({ domain: d === "all" ? "" : d })}
        >
          <SelectTrigger aria-label="Domaine" className="w-56 max-md:flex-1">
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
        <FilterPanelButton
          activeCount={panelFilterCount(state)}
          onReset={() =>
            change({
              images: "all",
              notUsedSince: null,
              exam: "",
              objective: "",
            })
          }
          resultLabel={`Afficher ${countLabel(list.total, "question")}`}
        >
          <FilterGroup label="Images">
            <SegmentedControl
              label="Images d'énoncé"
              value={state.images}
              options={IMAGE_OPTIONS}
              onValueChange={(images) => change({ images })}
              testIdPrefix="images"
              className="w-full *:flex-1 *:justify-center"
            />
          </FilterGroup>
          <FilterGroup
            label="Dernière utilisation"
            help="Examen blanc le plus récent, par date d'ouverture, qui contient la question."
          >
            <NotUsedSinceField
              value={state.notUsedSince}
              onChange={(notUsedSince) => change({ notUsedSince })}
            />
          </FilterGroup>
          <FilterGroup label="Examen précis" htmlFor="filter-exam">
            <SearchableSelect
              id="filter-exam"
              value={state.exam}
              onChange={(exam) => change({ exam })}
              options={examOptions}
              clearLabel="Tous les examens"
              placeholder="Tous les examens"
              searchPlaceholder="Rechercher un examen"
            />
          </FilterGroup>
          <FilterGroup
            label="Objectif CMC"
            htmlFor="filter-objective"
            help={
              state.domain
                ? undefined
                : "Choisissez d'abord un domaine : la liste montre les objectifs de ses questions."
            }
          >
            <SearchableSelect
              id="filter-objective"
              value={state.objective}
              onChange={(objective) => change({ objective })}
              options={objectives.map((o) => ({ value: o, label: o }))}
              clearLabel="Tous les objectifs"
              placeholder="Tous les objectifs"
              searchPlaceholder="Rechercher un objectif"
              disabled={!state.domain}
            />
          </FilterGroup>
        </FilterPanelButton>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <FilterChip
              key={c.label}
              onRemove={() => change(c.reset)}
              removeLabel={`Retirer le filtre ${c.label.toLowerCase()}`}
            >
              <span className="text-ink-3">{c.label} :</span> {c.value}
            </FilterChip>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => clearAll(true)}
          >
            <X aria-hidden />
            Tout effacer
          </Button>
        </div>
      )}

      <div className="bg-surface border-line overflow-hidden rounded-lg border">
        {list.items.length === 0 ? (
          <PendingRegion
            isPending={isPending}
            className="flex flex-col items-center gap-2 px-5 py-9 text-center"
          >
            <SearchX aria-hidden className="text-ink-3 size-5" />
            <p className="text-ink text-[0.9375rem] font-medium">
              Aucune question ne correspond.
            </p>
            <p className="text-ink-3 max-w-md text-[0.8125rem]">
              La recherche porte sur l&apos;énoncé, les choix de réponse,
              l&apos;objectif et l&apos;identifiant.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => clearAll(false)}
            >
              Effacer les filtres
            </Button>
          </PendingRegion>
        ) : (
          <>
            <div className="max-lg:hidden">
              <DataTable
                columns={columns}
                rows={list.items}
                getRowId={(q) => q.id}
                preferencesKey="admin-questions"
                isPending={isPending}
                onRowClick={open}
                className="rounded-none border-0"
              />
            </div>
            <PendingRegion isPending={isPending} className="lg:hidden">
              <ul>
                {list.items.map((q) => (
                  <li
                    key={q.id}
                    className="border-line border-t first:border-t-0"
                  >
                    <Link
                      href={questionHref(q.id, state)}
                      prefetch={false}
                      className="focus-ring hover:bg-surface-2 flex min-h-14 flex-col gap-1.5 px-4 py-3"
                    >
                      <span className="text-ink line-clamp-2 text-sm">
                        <QuestionFlags q={q} />
                        {q.question}
                      </span>
                      <span className="text-ink-3 flex flex-wrap gap-x-1.5 text-xs">
                        <span>{q.domain}</span>
                        <span aria-hidden>·</span>
                        {q.successRate === null ? (
                          <span>
                            Non significatif · {answersLabel(q.answerCount)}
                          </span>
                        ) : (
                          <span className="font-mono">
                            <span className="text-ink">{q.successRate} %</span>{" "}
                            · {answersLabel(q.answerCount)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PendingRegion>
          </>
        )}
        {list.total > 0 && (
          <TablePagination
            page={state.page}
            pageSize={QUESTIONS_PAGE_SIZE}
            total={list.total}
            isLoading={isPending}
            itemNoun={{ one: "question", many: "questions" }}
            onPageChange={(p) => {
              go({ ...latest(), page: p })
              window.scrollTo({ top: 0 })
            }}
          />
        )}
      </div>
    </>
  )
}
