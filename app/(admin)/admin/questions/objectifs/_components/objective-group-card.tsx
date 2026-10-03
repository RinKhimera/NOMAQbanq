"use client"

import { Check, Merge, Plus, X } from "lucide-react"
import { useState } from "react"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { keepObjective, mergeObjectives } from "@/features/objectives/actions"
import type {
  ObjectiveEntryView,
  ObjectiveGroup,
} from "@/features/objectives/groups"
import { normalizeObjectiveLabel } from "@/features/objectives/label"
import { callAction } from "@/lib/safe-action"
import { TOUCH_MIN_HEIGHT, TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import {
  ATTACH_LIMIT,
  attachCandidates,
  groupDomains,
  questionsLabel,
} from "./objectives-model"

export const DomainList = ({ domains }: { domains: readonly string[] }) => {
  const shown = domains.slice(0, 3)
  const more = domains.length - shown.length
  return (
    <span className="text-ink-3 text-[0.8125rem]" title={domains.join(" · ")}>
      {domains.length === 0 ? "Aucune question active" : shown.join(" · ")}
      {more > 0 && <span className="font-mono"> +{more}</span>}
    </span>
  )
}

const AttachValue = ({
  entries,
  selectedIds,
  onPick,
}: {
  entries: readonly ObjectiveEntryView[]
  selectedIds: readonly string[]
  onPick: (entry: ObjectiveEntryView) => void
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const found = attachCandidates(entries, selectedIds, search)
  const candidates = found.slice(0, ATTACH_LIMIT)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={TOUCH_TARGET}
        >
          <Plus aria-hidden />
          Rattacher une valeur…
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-line border-b p-2">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Rechercher une valeur"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {candidates.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={cn(
                  "hover:bg-surface-2 focus-ring flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                  TOUCH_MIN_HEIGHT,
                )}
                onClick={() => {
                  onPick(e)
                  setOpen(false)
                  setSearch("")
                }}
              >
                <span className="text-ink min-w-0">{e.label}</span>
                <span className="text-ink-3 shrink-0 font-mono text-[11px]">
                  {questionsLabel(e.questionCount)}
                </span>
              </button>
            </li>
          ))}
          {candidates.length === 0 && (
            <li className="text-ink-3 px-3 py-2.5 text-sm">Aucun résultat</li>
          )}
        </ul>
        {found.length > candidates.length && (
          <p className="border-line text-ink-3 border-t px-3 py-2 text-xs">
            {ATTACH_LIMIT} premières valeurs sur {found.length} : affinez la
            recherche.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Un groupe à traiter : le libellé à garder parmi ses variantes, des valeurs
 * rattachées d'autres groupes (et détachables), le libellé final, puis
 * « Fusionner » (ou « Garder » quand il ne reste qu'une valeur). Les
 * variantes d'origine partagent la clé normalisée : détachée, l'une d'elles
 * ferait refuser la fusion ou la garde, d'où « Détacher » réservé aux
 * valeurs rattachées. La carte ne garde que des identifiants et relit le
 * référentiel à chaque rendu : une valeur supprimée ailleurs sort de sa
 * sélection.
 */
export const ObjectiveGroupCard = ({
  group,
  entries,
  onDone,
  onError,
}: {
  group: ObjectiveGroup
  /** Tout le référentiel : les valeurs rattachables. */
  entries: readonly ObjectiveEntryView[]
  onDone: (message: string) => void
  onError: (message: string) => void
}) => {
  const [attachedIds, setAttachedIds] = useState<string[]>([])
  const [keptId, setKeptId] = useState<string | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const byId = new Map(entries.map((e) => [e.id, e]))
  const ownIds = new Set(group.entries.map((e) => e.id))
  const selection = [
    ...group.entries,
    ...attachedIds.flatMap((id) => {
      const entry = byId.get(id)
      return entry && !ownIds.has(id) ? [entry] : []
    }),
  ]
  const kept = selection.find((e) => e.id === keptId) ?? selection[0]!
  const finalLabel = label ?? kept.label
  const single = selection.length === 1
  const relabeled = normalizeObjectiveLabel(finalLabel) !== kept.label
  const questionCount = selection.reduce((n, e) => n + e.questionCount, 0)
  const headingId = `group-${group.key}`

  const choose = (id: string) => {
    setKeptId(id)
    setLabel(null)
  }
  const detach = (id: string) => {
    setAttachedIds((ids) => ids.filter((x) => x !== id))
    if (id === kept.id) choose(selection[0]!.id)
  }

  const submit = async () => {
    setPending(true)
    const res = single
      ? await callAction(() =>
          keepObjective({
            id: kept.id,
            ...(relabeled && { label: finalLabel }),
          }),
        )
      : await callAction(() =>
          mergeObjectives({
            keepId: kept.id,
            mergeIds: selection
              .filter((e) => e.id !== kept.id)
              .map((e) => e.id),
            label: finalLabel,
          }),
        )
    setPending(false)
    if (!res.success) return onError(res.error)
    const shown = normalizeObjectiveLabel(finalLabel)
    onDone(
      single
        ? `« ${shown} » gardé`
        : `${questionsLabel(questionCount)} regroupées sous « ${shown} »`,
    )
  }

  return (
    <article
      aria-labelledby={headingId}
      data-testid={`objective-group-${group.key}`}
      className="bg-surface border-line shadow-1 flex flex-col rounded-lg border"
    >
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <DomainList domains={groupDomains(selection)} />
          <h3 id={headingId} className="text-ink text-[15px] font-semibold">
            {single ? "1 valeur" : `${selection.length} variantes`} ·{" "}
            <span className="font-mono">{questionCount}</span> question
            {questionCount > 1 ? "s" : ""}
          </h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant={single ? "outline" : "default"}
          disabled={pending}
          onClick={submit}
          className={TOUCH_TARGET}
          data-testid={single ? "btn-keep-objective" : "btn-merge-objectives"}
        >
          {pending ? (
            <Spinner size="sm" />
          ) : single ? (
            <Check aria-hidden />
          ) : (
            <Merge aria-hidden />
          )}
          {single
            ? relabeled
              ? "Garder sous ce libellé"
              : "Garder tel quel"
            : "Fusionner"}
        </Button>
      </div>
      <div role="radiogroup" aria-label="Libellé à conserver">
        {selection.map((e) => (
          <div
            key={e.id}
            className={cn(
              "border-line flex items-center gap-3 border-b pr-3",
              e.id === kept.id && "bg-accent-soft",
            )}
          >
            <label
              className={cn(
                "flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-5",
                TOUCH_MIN_HEIGHT,
              )}
            >
              <input
                type="radio"
                name={headingId}
                checked={e.id === kept.id}
                onChange={() => choose(e.id)}
                aria-label={e.label}
                className="accent-accent size-4"
              />
              <span className="text-ink min-w-0 flex-1 text-sm wrap-anywhere">
                {e.label}
              </span>
              <span className="text-ink-3 font-mono text-xs">
                {e.questionCount}
              </span>
            </label>
            {ownIds.has(e.id) ? (
              <span className="size-8" aria-hidden />
            ) : (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className={TOUCH_TARGET}
                aria-label={`Détacher « ${e.label} »`}
                title="Détacher"
                onClick={() => detach(e.id)}
              >
                <X aria-hidden />
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="border-line border-b px-3 py-1.5">
        <AttachValue
          entries={entries}
          selectedIds={selection.map((e) => e.id)}
          onPick={(e) => setAttachedIds((ids) => [...ids, e.id])}
        />
      </div>
      <div className="flex flex-col gap-1.5 px-5 pt-3 pb-4">
        <label
          htmlFor={`${headingId}-label`}
          className="text-ink-3 text-[0.8125rem]"
        >
          Libellé final, modifiable
        </label>
        <Input
          id={`${headingId}-label`}
          value={finalLabel}
          onChange={(ev) => setLabel(ev.target.value)}
        />
      </div>
    </article>
  )
}
