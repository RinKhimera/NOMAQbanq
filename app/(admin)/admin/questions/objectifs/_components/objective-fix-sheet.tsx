"use client"

import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import { ErrorState } from "@/components/shared/error-state"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SkeletonText } from "@/components/ui/skeleton-patterns"
import {
  correctQuestionObjective,
  loadObjectiveQuestions,
} from "@/features/objectives/actions"
import type { ObjectiveQuestion } from "@/features/objectives/dal"
import type {
  InvalidObjective,
  ObjectiveEntryView,
} from "@/features/objectives/groups"
import { callAction } from "@/lib/safe-action"
import { objectiveSelectOptions } from "../../_components/question-form-model"
import { oneLine } from "./objectives-model"

const shorten = (text: string) =>
  text.length > 40 ? `${text.slice(0, 40)}…` : text

/**
 * Correction d'une valeur invalide, question par question : chaque choix
 * s'enregistre aussitôt, sans passer par le formulaire de la question.
 */
export const ObjectiveFixSheet = ({
  invalid,
  objectives,
  onClose,
  onError,
}: {
  invalid: InvalidObjective
  /** Le référentiel, valeurs invalides exclues. */
  objectives: readonly ObjectiveEntryView[]
  onClose: () => void
  onError: (message: string) => void
}) => {
  const [loaded, setLoaded] = useState<{
    questions: ObjectiveQuestion[] | null
    failed: boolean
  }>({ questions: null, failed: false })
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    loadObjectiveQuestions(invalid.id)
      .then((questions) => live && setLoaded({ questions, failed: false }))
      .catch(() => live && setLoaded({ questions: null, failed: true }))
    return () => {
      live = false
    }
  }, [invalid.id, attempt])

  const options = objectives.map((o) => ({ id: o.id, label: o.label }))
  const domainIds = (domain: string) =>
    objectives.filter((o) => o.domains.includes(domain)).map((o) => o.id)

  const choose = async (question: ObjectiveQuestion, objectiveId: string) => {
    setSaving(question.id)
    const res = await callAction(() =>
      correctQuestionObjective({ questionId: question.id, objectiveId }),
    )
    setSaving(null)
    if (!res.success) return onError(res.error)
    setChosen((c) => ({ ...c, [question.id]: objectiveId }))
  }

  const questions = loaded.questions
  const done = Object.keys(chosen).length
  const total = questions?.length ?? invalid.questionCount

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-130">
        <SheetHeader>
          <SheetTitle>Corriger « {shorten(invalid.label)} »</SheetTitle>
          <SheetDescription>{invalid.problems.join(" · ")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {loaded.failed ? (
            <ErrorState
              title="Impossible de charger les questions"
              description="Vérifiez votre connexion, puis réessayez."
              onRetry={() => {
                setLoaded({ questions: null, failed: false })
                setAttempt((n) => n + 1)
              }}
            />
          ) : !questions ? (
            <SkeletonText lines={6} />
          ) : (
            <ul className="flex flex-col">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="border-line flex flex-col gap-2 border-b py-3"
                  data-testid={`fix-question-${q.id}`}
                >
                  <span className="text-ink line-clamp-2 text-sm">
                    {oneLine(q.question)}
                  </span>
                  <span className="text-ink-3 text-xs">{q.domain}</span>
                  {chosen[q.id] ? (
                    <span className="text-success-ink flex items-center gap-1.5 text-sm">
                      <Check aria-hidden className="size-4" />
                      {options.find((o) => o.id === chosen[q.id])?.label}
                    </span>
                  ) : (
                    <>
                      <label htmlFor={`fix-${q.id}`} className="sr-only">
                        Objectif de la question
                      </label>
                      <SearchableSelect
                        id={`fix-${q.id}`}
                        value=""
                        onChange={(id) => choose(q, id)}
                        options={objectiveSelectOptions(
                          options,
                          domainIds(q.domain),
                        )}
                        placeholder="Choisir un objectif"
                        searchPlaceholder="Rechercher un objectif"
                        emptyText="Aucun objectif ne correspond"
                        disabled={saving === q.id}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <SheetFooter className="border-line flex-row items-center justify-between border-t">
          <span
            className={
              done === total && total > 0
                ? "text-success-ink font-mono text-[0.8125rem]"
                : "text-ink-2 font-mono text-[0.8125rem]"
            }
          >
            {done} / {total} corrigée{total > 1 ? "s" : ""}
          </span>
          <Button type="button" onClick={onClose}>
            Terminé
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
