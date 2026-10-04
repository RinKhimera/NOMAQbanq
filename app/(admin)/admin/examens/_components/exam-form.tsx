"use client"

import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageIntro } from "@/components/shared/page-intro"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { EXAMS_HREF, examEditHref, examHref } from "@/constants/exam-routes"
import {
  type ExamFieldErrors,
  finalizePreparedExam,
  saveExam,
} from "@/features/exams/actions"
import type { BankQuestion } from "@/features/questions/dal"
import { useClock } from "@/hooks/use-clock"
import { useLeaveGuard } from "@/hooks/use-leave-guard"
import { adminPhaseOf, isFinalizedOpen } from "@/lib/exam-phase"
import {
  datesOutOfOrder,
  examReadiness,
  isLateToOpen,
} from "@/lib/exam-readiness"
import { NBSP, formatMediumDate } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { ExamBreadcrumb } from "./exam-breadcrumb"
import {
  type ExamFormValues,
  STEP_ID,
  type SavedExam,
  examDuration,
  firstFailingStep,
  isTargetValid,
  saveErrors,
  selectionSummary,
  targetResetsFinalization,
  toSavePayload,
} from "./exam-form-model"
import { QuestionsStep } from "./exam-form-questions"
import {
  AudienceStep,
  FormatStep,
  InformationsStep,
  WindowStep,
} from "./exam-form-steps"
import {
  type ExamFormAction,
  ExamFormSummary,
  summaryChecks,
} from "./exam-form-summary"

export type ExamFormProps = {
  initialNow: number
  /** Étudiants avec un accès Examens actif aujourd'hui. */
  subscriberCount: number
  initialValues: ExamFormValues
  /** `null` : création (nouvel examen ou réouverture). */
  saved: SavedExam | null
  /** Jeu enregistré, ou jeu repris d'une réouverture. */
  selection: BankQuestion[]
  /** Examen rouvert : ses questions partent avec la première écriture. */
  reopening: { title: string; questionIds: string[] } | null
}

type Failure =
  | { kind: "fields"; title: string }
  | { kind: "message"; title: string; message: string }

const FIELDS_OF: Partial<
  Record<keyof ExamFormValues, (keyof ExamFieldErrors)[]>
> = {
  title: ["title"],
  startDate: ["startDate", "endDate"],
  endDate: ["startDate", "endDate"],
  targetQuestionCount: ["targetQuestionCount"],
  audienceType: ["audienceUserIds"],
  audience: ["audienceUserIds"],
}

const snapshotOf = (v: ExamFormValues) =>
  JSON.stringify({ ...v, audience: v.audience.map((u) => u.id) })

const scrollToStep = (errors: ExamFieldErrors) => {
  const step = firstFailingStep(errors)
  if (step)
    document
      .getElementById(STEP_ID[step])
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" })
}

export function ExamForm({
  initialNow,
  subscriberCount,
  initialValues,
  saved,
  selection,
  reopening,
}: Readonly<ExamFormProps>) {
  const router = useRouter()
  const now = useClock(initialNow)
  const [values, setValues] = useState(initialValues)
  const [snapshot, setSnapshot] = useState(() => snapshotOf(initialValues))
  // Un examen créé par une finalisation refusée : la suite le met à jour.
  const [savedId, setSavedId] = useState(saved?.id ?? null)
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ExamFieldErrors>({})
  const [failure, setFailure] = useState<Failure | null>(null)
  // Une tentative refusée de plus : les vérifications en échec sont relues.
  const [refusals, setRefusals] = useState(0)
  const [pending, setPending] = useState<ExamFormAction | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  const dirty = snapshotOf(values) !== snapshot
  const frozen = saved?.locked ?? false
  const finalized = saved !== null && saved.finalizedAt !== null
  const summary = selectionSummary(selection)
  const questionCount = reopening ? summary.count : (saved?.questionCount ?? 0)
  const status = saved ? adminPhaseOf(saved, now) : "preparation"
  const exitHref = savedId ? examHref(savedId) : EXAMS_HREF

  useLeaveGuard(
    dirty && pending === null,
    (leave) => setPendingLeave(() => leave),
    (href) => router.push(href),
  )

  const set = <K extends keyof ExamFormValues>(
    key: K,
    value: ExamFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }))
    const cleared = FIELDS_OF[key]
    if (cleared?.some((f) => serverErrors[f])) {
      setServerErrors((e) => {
        const next = { ...e }
        for (const f of cleared) delete next[f]
        return next
      })
    }
  }

  const localErrors = saveErrors(values)
  const errors: ExamFieldErrors = {
    ...serverErrors,
    ...(attempted && localErrors.title && { title: localErrors.title }),
    ...(localErrors.targetQuestionCount && {
      targetQuestionCount: localErrors.targetQuestionCount,
    }),
    ...(datesOutOfOrder(values) && {
      endDate: "La fermeture doit suivre l'ouverture.",
    }),
  }

  const readiness = examReadiness(
    {
      startDate: values.startDate,
      endDate: values.endDate,
      finalizedAt: saved?.finalizedAt ?? null,
      questionCount,
      deletedQuestionCount: selection.filter((q) => q.deleted).length,
      targetQuestionCount: values.targetQuestionCount,
      audienceType: values.audienceType,
      audienceSize: values.audience.length,
    },
    now,
    { finalizing: true },
  )
  const checks = summaryChecks(readiness, {
    frozen,
    showErrors: Object.keys(serverErrors).length > 0,
  })

  const resetWarning = targetResetsFinalization(
    saved,
    values.targetQuestionCount,
  )
    ? `Changer le nombre de questions remet l'examen en préparation${NBSP}: il faudra le finaliser de nouveau${
        saved && isFinalizedOpen(saved, now)
          ? ", et il disparaît côté étudiant jusqu'à la refinalisation"
          : ""
      }.`
    : null

  const refuse = (
    res: { error: string; fieldErrors?: ExamFieldErrors },
    title: string,
  ) => {
    setRefusals((n) => n + 1)
    if (res.fieldErrors && Object.keys(res.fieldErrors).length > 0) {
      setServerErrors(res.fieldErrors)
      setFailure({ kind: "fields", title })
      scrollToStep(res.fieldErrors)
      return
    }
    setFailure({ kind: "message", title, message: res.error })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const leaveTo = (href: string) => {
    setSnapshot(snapshotOf(values))
    router.push(href)
  }

  const run = async (action: ExamFormAction) => {
    if (pending) return
    setAttempted(true)
    setFailure(null)
    if (Object.keys(localErrors).length > 0) {
      setServerErrors({})
      setRefusals((n) => n + 1)
      scrollToStep(localErrors)
      return
    }
    setServerErrors({})
    setPending(action)
    const res = await callAction(() =>
      saveExam(
        toSavePayload(values, {
          id: savedId ?? undefined,
          questionIds:
            savedId === null && reopening ? reopening.questionIds : undefined,
        }),
      ),
    )
    if (!res.success) {
      setPending(null)
      refuse(
        res,
        action === "update"
          ? "Modifications non enregistrées"
          : "L'examen n'a pas été enregistré",
      )
      return
    }
    const examId = res.examId

    if (action === "save") {
      toast.success("Examen enregistré en préparation")
      leaveTo(examHref(examId))
      return
    }
    if (action === "update") {
      if (finalized && !res.finalized) {
        toast.success("Modifications enregistrées", {
          description: "L'examen est repassé en préparation : finalisez-le.",
        })
      } else toast.success("Modifications enregistrées")
      leaveTo(examHref(examId))
      return
    }

    // La finalisation vient après l'enregistrement : refusée, elle laisse
    // l'examen enregistré en préparation.
    setSnapshot(snapshotOf(values))
    if (savedId === null) {
      setSavedId(examId)
      // Sans navigation : l'écran garde les erreurs, et un rechargement
      // rouvre l'examen créé au lieu d'en créer un autre.
      window.history.replaceState(null, "", examEditHref(examId))
    }
    const fin = await callAction(() => finalizePreparedExam({ examId }))
    if (!fin.success) {
      setPending(null)
      refuse(fin, "L'examen ne peut pas encore être finalisé")
      return
    }
    toast.success(
      `Examen finalisé · durée ${examDuration(values.targetQuestionCount)}`,
    )
    leaveTo(examHref(examId))
  }

  const cancel = () => {
    if (dirty) setPendingLeave(() => () => leaveTo(exitHref))
    else router.push(exitHref)
  }

  const crumb = saved
    ? saved.title
    : reopening
      ? `Réouverture de ${reopening.title}`
      : "Nouvel examen"
  const title = saved
    ? `Modifier ${saved.title}`
    : reopening
      ? `Rouvrir ${reopening.title}`
      : "Créer un examen blanc"
  const lead = reopening
    ? `Nouvel examen en préparation, pré-rempli à partir de ${reopening.title}. Choisissez ses dates, puis finalisez-le.`
    : !finalized
      ? "Vous pouvez enregistrer l'examen en préparation, même incomplet, et le finaliser plus tard."
      : undefined
  const participations = saved?.participations ?? 0

  return (
    <div className="flex flex-col gap-4">
      <ExamBreadcrumb
        items={
          saved
            ? [
                { label: saved.title, href: examHref(saved.id) },
                { label: "Modifier" },
              ]
            : [{ label: crumb }]
        }
      />

      <PageIntro title={title} description={lead} />

      {frozen && (
        <Alert data-testid="exam-frozen-alert">
          <Lock aria-hidden />
          <AlertTitle>Jeu de questions figé</AlertTitle>
          <AlertDescription className="text-ink-2">
            {participations > 1
              ? `${participations} participations existent.`
              : "Une participation existe."}{" "}
            Le nombre et le choix des questions sont verrouillés{NBSP}; le
            titre, la description, les dates, la pause et l&apos;audience
            restent modifiables, sauf repousser la fin d&apos;un examen terminé
            {NBSP}: utilisez «{NBSP}Rouvrir{NBSP}».
          </AlertDescription>
        </Alert>
      )}
      {failure && (
        <Alert variant="destructive" data-testid="exam-form-error">
          <AlertTitle>{failure.title}</AlertTitle>
          <AlertDescription>
            {failure.kind === "fields"
              ? "Corrigez les points signalés ci-dessous."
              : failure.message}
          </AlertDescription>
        </Alert>
      )}
      {saved && saved.startDate !== null && isLateToOpen(saved, now) && (
        <Alert variant="destructive" data-testid="exam-late-alert">
          <AlertTitle>
            Devait ouvrir le {formatMediumDate(saved.startDate)}
          </AlertTitle>
          <AlertDescription>
            L&apos;examen est encore en préparation{NBSP}: il ne s&apos;ouvre
            pas tant qu&apos;il n&apos;est pas finalisé.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <InformationsStep values={values} errors={errors} set={set} />
          <WindowStep values={values} errors={errors} set={set} />
          <FormatStep
            values={values}
            errors={errors}
            set={set}
            frozen={frozen}
            resetWarning={resetWarning}
          />
          <AudienceStep
            values={values}
            errors={errors}
            set={set}
            subscriberCount={subscriberCount}
          />
          <QuestionsStep
            summary={{ ...summary, count: questionCount }}
            target={
              isTargetValid(values.targetQuestionCount)
                ? values.targetQuestionCount
                : 0
            }
            examId={savedId}
            frozen={frozen}
            reopenedFrom={reopening && !savedId ? reopening.title : null}
            error={errors.questionIds}
          />
        </div>

        <ExamFormSummary
          status={status}
          checks={checks}
          refusals={refusals}
          duration={
            isTargetValid(values.targetQuestionCount)
              ? examDuration(values.targetQuestionCount) +
                (finalized ? "" : " (estimée)")
              : "—"
          }
          pause={
            values.enablePause
              ? `${values.pauseDurationMinutes}${NBSP}min`
              : "Aucune"
          }
          finalized={finalized}
          pending={pending}
          onAction={run}
          onCancel={cancel}
        />
      </div>

      <ConfirmDialog
        open={pendingLeave !== null}
        onOpenChange={(open) => !open && setPendingLeave(null)}
        variant="destructive"
        title={`Quitter sans enregistrer${NBSP}?`}
        description="Vos modifications seront perdues."
        cancelLabel="Continuer la saisie"
        confirmLabel="Quitter sans enregistrer"
        onConfirm={() => {
          const leave = pendingLeave
          setSnapshot(snapshotOf(values))
          setPendingLeave(null)
          leave?.()
        }}
      />
    </div>
  )
}
