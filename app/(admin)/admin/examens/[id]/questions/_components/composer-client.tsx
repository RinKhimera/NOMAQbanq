"use client"

import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageIntro } from "@/components/shared/page-intro"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { composerReturnHref } from "@/constants/exam-routes"
import {
  addExamQuestions,
  previewExamCompletion,
  removeExamQuestions,
} from "@/features/exams/actions"
import type { BankQuestion, DomainPlanRow } from "@/features/questions/dal"
import { useUrlListState } from "@/hooks/use-url-list-state"
import type { ExamStatus } from "@/lib/exam-status"
import { NBSP } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { cn } from "@/lib/utils"
import { ExamBreadcrumb } from "../../../_components/exam-breadcrumb"
import { BankColumn } from "./bank-column"
import { CompletionDialog, type CompletionDraw } from "./completion-dialog"
import { ComposerCounter } from "./composer-counter"
import {
  changedLabel,
  composerLead,
  counterOf,
  fullDomainPlan,
} from "./composer-model"
import {
  type ComposerState,
  cleared,
  serializeComposer,
  withChange,
} from "./composer-params"
import { DomainPlan } from "./domain-plan"
import {
  QuestionPreviewDialog,
  useQuestionPreview,
} from "./question-preview-dialog"
import { SelectionColumn } from "./selection-column"
import { useFirstChangeGuard } from "./use-first-change-guard"

export type ComposerExam = {
  id: string
  title: string
  targetQuestionCount: number
  /** Finalisé : la première modification le remet en préparation. */
  finalized: boolean
  /** Finalisé et pas encore clos : visible des étudiants, suspendu ou non. */
  openToStudents: boolean
  phase: ExamStatus
}

type Tab = "bank" | "selection"

/**
 * Compositeur du jeu de questions : plan par domaine, banque (état dans
 * l'URL, rechargée par la page serveur) et sélection. Les écritures passent
 * par `addExamQuestions` / `removeExamQuestions` puis rechargent la page.
 */
export const ComposerClient = ({
  exam,
  frozen,
  state,
  selection,
  plan,
  bank,
  bankPageSize,
  initialNow,
}: {
  exam: ComposerExam
  frozen: boolean
  state: ComposerState
  selection: BankQuestion[]
  plan: DomainPlanRow[]
  /** `null` quand le jeu est figé : la banque n'est pas lue. */
  bank: { items: BankQuestion[]; total: number } | null
  bankPageSize: number
  initialNow: number
}) => {
  const router = useRouter()
  const [isWriting, startWrite] = useTransition()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("bank")
  const [draw, setDraw] = useState<CompletionDraw | null>(null)
  const [drawing, setDrawing] = useState(false)
  const { guard, dialog } = useFirstChangeGuard(exam.finalized && !frozen)
  const preview = useQuestionPreview()

  const {
    search,
    setSearch,
    isPending: isNavigating,
    latest,
    go,
  } = useUrlListState({
    state,
    serialize: serializeComposer,
    withSearch: (current, q) => withChange(current, { q }),
  })
  const change = (c: Partial<Omit<ComposerState, "page" | "back">>) =>
    go(withChange(latest(), c))

  const pickDomain = (domain: string) => {
    change({ domain: latest().domain === domain ? "" : domain })
    setTab("bank")
  }

  const count = selection.length
  const counter = counterOf({
    count,
    target: exam.targetQuestionCount,
    frozen,
  })
  const selectedIds = new Set(selection.map((q) => q.id))

  const runWrite = (key: string, kind: "add" | "remove", ids: string[]) =>
    new Promise<boolean>((resolve) => {
      setBusyKey(key)
      startWrite(async () => {
        const action = kind === "add" ? addExamQuestions : removeExamQuestions
        const res = await callAction(() =>
          action({ examId: exam.id, questionIds: ids }),
        )
        if (!res.success) {
          toast.error(res.error)
          resolve(false)
          return
        }
        const delta = Math.abs(res.count - count)
        toast.success(
          changedLabel(delta, kind === "add" ? "ajoutée" : "retirée"),
        )
        if (exam.finalized && !res.finalized) {
          toast.info(
            "L'examen est repassé en préparation : finalisez-le de nouveau.",
          )
        }
        startWrite(() => router.refresh())
        resolve(true)
      })
    })

  const write = (kind: "add" | "remove") => (key: string, ids: string[]) =>
    guard(() => runWrite(key, kind, ids))

  const fetchDraw = async () => {
    setDrawing(true)
    const res = await callAction(() =>
      previewExamCompletion({ examId: exam.id }),
    )
    setDrawing(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    setDraw({ questionIds: res.questionIds, lines: res.lines })
  }

  const applyDraw = async (ids: string[]) => {
    if (await runWrite("draw", "add", ids)) setDraw(null)
  }

  const togglePreviewed = (item: BankQuestion) => {
    const inSelection = selectedIds.has(item.id)
    preview.close()
    guard(() =>
      runWrite(
        `${inSelection ? "remove" : "add"}:${item.id}`,
        inSelection ? "remove" : "add",
        [item.id],
      ),
    )
  }

  const doneHref = composerReturnHref(exam.id, state.back)

  return (
    <div className="flex flex-col gap-3.5 max-lg:pb-20">
      <ExamBreadcrumb
        items={[
          { label: exam.title, href: doneHref },
          { label: "Jeu de questions" },
        ]}
      />

      <PageIntro
        title="Composer le jeu de questions"
        description={composerLead(exam.title, exam.phase, frozen)}
      />

      {frozen && (
        <Alert data-testid="composer-frozen-alert">
          <Lock aria-hidden />
          <AlertTitle>Lecture seule</AlertTitle>
          <AlertDescription>
            Des participations existent : le jeu de questions ne peut plus
            changer.
          </AlertDescription>
        </Alert>
      )}

      <ComposerCounter
        count={count}
        target={exam.targetQuestionCount}
        counter={counter}
        frozen={frozen}
        doneHref={doneHref}
        onComplete={() => guard(fetchDraw)}
        drawing={drawing && !draw}
        busy={isWriting}
      />

      <DomainPlan
        rows={fullDomainPlan(plan)}
        activeDomain={state.domain}
        onPickDomain={pickDomain}
      />

      {!frozen && bank && (
        <SegmentedControl
          label="Banque ou sélection"
          value={tab}
          options={[
            { value: "bank", label: "Banque", count: bank.total },
            { value: "selection", label: "Sélection", count },
          ]}
          onValueChange={setTab}
          testIdPrefix="composer-tab"
          className="w-full *:flex-1 *:justify-center lg:hidden"
        />
      )}

      <div
        className={cn("grid items-start gap-3", !frozen && "lg:grid-cols-2")}
      >
        {!frozen && bank && (
          <BankColumn
            state={state}
            bank={bank}
            pageSize={bankPageSize}
            now={initialNow}
            search={search}
            onSearch={setSearch}
            isSearching={isNavigating && search.trim() !== state.q}
            isPending={isNavigating}
            onChange={change}
            onPage={(page) => go({ ...latest(), page })}
            onClear={() => {
              setSearch("")
              go(cleared(latest()))
            }}
            onPreview={(q) => void preview.open(q)}
            onAdd={write("add")}
            room={counter.need}
            writing={isWriting}
            busyKey={busyKey}
            className={cn(tab !== "bank" && "max-lg:hidden")}
          />
        )}
        <SelectionColumn
          items={selection}
          now={initialNow}
          frozen={frozen}
          onPreview={(q) => void preview.open(q)}
          onRemove={write("remove")}
          writing={isWriting}
          busyKey={busyKey}
          className={cn(!frozen && tab !== "selection" && "max-lg:hidden")}
        />
      </div>

      <QuestionPreviewDialog
        preview={preview.preview}
        now={initialNow}
        inSelection={
          preview.preview ? selectedIds.has(preview.preview.item.id) : false
        }
        frozen={frozen}
        full={counter.need === 0}
        writing={isWriting}
        onClose={preview.close}
        onRetry={(item) => void preview.open(item)}
        onToggle={togglePreviewed}
      />

      <CompletionDialog
        draw={draw}
        need={counter.need}
        redrawing={drawing && !!draw}
        applying={isWriting && busyKey === "draw"}
        onRedraw={() => void fetchDraw()}
        onApply={(ids) => void applyDraw(ids)}
        onClose={() => setDraw(null)}
      />

      <ConfirmDialog
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        onConfirm={dialog.onConfirm}
        title={`Remettre l'examen en préparation${NBSP}?`}
        description={
          <>
            Modifier le jeu remet l&apos;examen en préparation : il faudra le
            finaliser de nouveau.
            {exam.openToStudents && (
              <>
                {" "}
                L&apos;examen est ouvert : il disparaîtra de la liste des
                étudiants jusqu&apos;à la refinalisation.
              </>
            )}
          </>
        }
        confirmLabel="Modifier le jeu"
        confirmTestId="btn-composer-confirm-change"
      />
    </div>
  )
}
