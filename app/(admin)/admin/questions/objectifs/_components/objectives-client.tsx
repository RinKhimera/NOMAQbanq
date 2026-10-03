"use client"

import { Merge, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { DataTable } from "@/components/shared/data-table/data-table"
import { PageIntro } from "@/components/shared/page-intro"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type InvalidObjective,
  type ObjectiveEntryView,
  objectivesBoard,
} from "@/features/objectives/groups"
import { foldForSearch } from "@/lib/search"
import { TONE_COLOR } from "@/lib/tone"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { type ObjectiveDialog, ObjectiveDialogs } from "./objective-dialogs"
import { ObjectiveFixSheet } from "./objective-fix-sheet"
import { DomainList, ObjectiveGroupCard } from "./objective-group-card"
import {
  type ObjectivesState,
  groupDomains,
  serializeObjectivesState,
  touchesDomain,
  visibleGroups,
} from "./objectives-model"

const ALL_DOMAINS = "__all"

// Un énoncé collé élargirait le tableau jusqu'à en masquer les colonnes.
const shortValue = (label: string) =>
  label.length > 40 ? `${label.slice(0, 40)}…` : label

/**
 * Référentiel des objectifs du CMC : groupes de variantes à fusionner,
 * valeurs invalides à corriger, puis gestion des objectifs revus. Tout le
 * référentiel arrive avec la page (quelques centaines d'entrées) ; onglet et
 * domaine vivent dans l'URL sans recharger la page.
 */
export const ObjectivesClient = ({
  entries,
  initialState,
}: {
  entries: ObjectiveEntryView[]
  initialState: ObjectivesState
}) => {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [fixing, setFixing] = useState<InvalidObjective | null>(null)
  const [dialog, setDialog] = useState<ObjectiveDialog | null>(null)
  const [search, setSearch] = useState("")

  const board = objectivesBoard(entries)
  const valid = entries.filter((e) => !e.needsFix)
  const domains = groupDomains(entries)
  const groups = visibleGroups(board.pending, state.domain)
  const invalid = board.invalid.filter((e) =>
    touchesDomain(e.domains, state.domain),
  )
  const term = foldForSearch(search)
  const reviewed = board.reviewed.filter(
    (e) =>
      touchesDomain(e.domains, state.domain) &&
      (!term || foldForSearch(e.label).includes(term)),
  )
  const { done, total } = board.progress

  const change = (patch: Partial<ObjectivesState>) => {
    const next = { ...state, ...patch }
    setState(next)
    const query = serializeObjectivesState(next).toString()
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    )
  }
  const settled = (message: string) => {
    toast.success(message)
    router.refresh()
  }
  const failed = (message: string) => toast.error(message)

  return (
    <>
      <PageIntro
        eyebrow="Contenu"
        title="Objectifs du CMC"
        backHref="/admin/questions"
        description={`Le champ objectif était saisi en texte libre : ${entries.length.toLocaleString("fr-CA")} valeurs, dont beaucoup de variantes d'accents, de casse ou d'espaces. Choisissez le libellé à garder, puis fusionnez.`}
        actions={
          <Button type="button" onClick={() => setDialog({ kind: "create" })}>
            <Plus aria-hidden />
            Nouvel objectif
          </Button>
        }
      />

      <div className="bg-surface border-line shadow-1 flex flex-col gap-2 rounded-lg border px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-ink-2 text-sm">Groupes traités</span>
          <span
            className="text-ink font-mono text-[0.8125rem]"
            data-testid="objectives-progress"
          >
            {done} / {total}
          </span>
        </div>
        <Progress
          value={total ? (done / total) * 100 : 100}
          indicatorColor={TONE_COLOR.success}
          className="h-1.5"
          aria-label="Groupes traités"
        />
        <span className="text-ink-3 text-[0.8125rem]">
          Seuls les objectifs du référentiel peuvent être choisis à la saisie.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Groupes"
          value={state.tab}
          onValueChange={(tab) => change({ tab })}
          options={[
            {
              value: "todo",
              label: "À traiter",
              count: board.pending.length + board.invalid.length,
            },
            { value: "done", label: "Traités", count: board.reviewed.length },
          ]}
          testIdPrefix="objectives-tab"
        />
        <Select
          value={state.domain || ALL_DOMAINS}
          onValueChange={(v) => change({ domain: v === ALL_DOMAINS ? "" : v })}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Domaine">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DOMAINS}>Tous les domaines</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.tab === "done" && (
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Rechercher un objectif"
            aria-label="Rechercher un objectif"
            containerClassName="w-full sm:w-72"
          />
        )}
      </div>

      {state.tab === "todo" ? (
        <>
          {groups.map((g) => (
            <ObjectiveGroupCard
              key={g.entries.map((e) => e.id).join("|")}
              group={g}
              entries={valid}
              onDone={settled}
              onError={failed}
            />
          ))}
          {invalid.length > 0 && (
            <section
              aria-labelledby="invalid-title"
              className="flex flex-col gap-3"
              data-testid="invalid-objectives"
            >
              <h2
                id="invalid-title"
                className="text-ink-3 font-mono text-xs tracking-[0.06em] uppercase"
              >
                Valeurs invalides
              </h2>
              <DataTable
                columns={[
                  {
                    id: "value",
                    label: "Valeur",
                    required: true,
                    cell: (e) => (
                      <span
                        className="text-ink font-mono text-xs"
                        title={e.label}
                      >
                        {shortValue(e.label)}
                      </span>
                    ),
                  },
                  {
                    id: "domains",
                    label: "Domaines",
                    cellClassName: "whitespace-normal",
                    cell: (e) => <DomainList domains={e.domains} />,
                  },
                  {
                    id: "count",
                    label: "Questions",
                    className: "text-right",
                    cellClassName: "font-mono",
                    cell: (e) => e.questionCount,
                  },
                  {
                    id: "problem",
                    label: "Problème",
                    cellClassName: "whitespace-normal",
                    cell: (e) => (
                      <span className="text-ink-3">
                        {e.problems.join(" · ")}
                      </span>
                    ),
                  },
                ]}
                rows={invalid}
                getRowId={(e) => e.id}
                action={{
                  label: "Corriger",
                  cell: (e) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={TOUCH_TARGET}
                      onClick={() => setFixing(e)}
                      data-testid={`btn-fix-${e.id}`}
                    >
                      Corriger
                    </Button>
                  ),
                }}
              />
            </section>
          )}
          {groups.length === 0 && invalid.length === 0 && (
            <p className="text-ink-3 py-8 text-sm">
              Tous les groupes de ce filtre sont traités.
            </p>
          )}
        </>
      ) : reviewed.length > 0 ? (
        <DataTable
          columns={[
            {
              id: "label",
              label: "Objectif",
              required: true,
              cell: (e) => (
                <span className="text-ink wrap-anywhere">{e.label}</span>
              ),
            },
            {
              id: "domains",
              label: "Domaines",
              cell: (e) => <DomainList domains={e.domains} />,
            },
            {
              id: "count",
              label: "Questions",
              className: "text-right",
              cellClassName: "font-mono",
              cell: (e) => e.questionCount,
            },
          ]}
          rows={reviewed}
          getRowId={(e) => e.id}
          action={{
            label: "Actions",
            cell: (e) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className={TOUCH_TARGET}
                    aria-label={`Actions sur « ${e.label} »`}
                  >
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => setDialog({ kind: "rename", entry: e })}
                  >
                    <Pencil aria-hidden />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setDialog({ kind: "merge", entry: e })}
                  >
                    <Merge aria-hidden />
                    Fusionner dans un autre objectif
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDialog({ kind: "delete", entry: e })}
                  >
                    <Trash2 aria-hidden />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          }}
        />
      ) : (
        <p className="text-ink-3 py-8 text-sm">
          {board.reviewed.length === 0
            ? "Aucun groupe traité pour le moment."
            : "Aucun objectif ne correspond."}
        </p>
      )}

      {fixing && (
        <ObjectiveFixSheet
          invalid={fixing}
          objectives={valid}
          onError={failed}
          onClose={() => {
            setFixing(null)
            router.refresh()
          }}
        />
      )}
      {dialog && (
        <ObjectiveDialogs
          key={dialog.kind + ("entry" in dialog ? dialog.entry.id : "")}
          dialog={dialog}
          objectives={valid}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null)
            settled(message)
          }}
        />
      )}
    </>
  )
}
