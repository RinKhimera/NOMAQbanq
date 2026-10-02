"use client"

import { CalendarRange } from "lucide-react"
import type { ReactNode } from "react"
import { countLabel } from "@/components/admin/question-detail/labels"
import { UserMultiSelect } from "@/components/admin/user-multi-select"
import { StepCard } from "@/components/shared/form-steps"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ExamFieldErrors } from "@/features/exams/actions"
import {
  MAX_EXAM_QUESTIONS,
  MAX_PAUSE_MINUTES,
  MIN_EXAM_QUESTIONS,
  MIN_PAUSE_MINUTES,
  SECONDS_PER_QUESTION,
} from "@/features/exams/schemas"
import { useMounted } from "@/hooks/use-mounted"
import { NBSP } from "@/lib/format"
import {
  type ExamFormValues,
  STEP_ID,
  fromLocalDay,
  toLocalDay,
  windowNote,
} from "./exam-form-model"

export type StepProps = {
  values: ExamFormValues
  errors: ExamFieldErrors
  set: <K extends keyof ExamFormValues>(
    key: K,
    value: ExamFormValues[K],
  ) => void
}

const Field = ({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={id} className="text-ink text-sm font-medium">
      {label}
    </label>
    {children}
    {error ? (
      <p
        id={`${id}-error`}
        className="text-danger-ink text-[0.8125rem]"
        data-testid={`${id}-error`}
      >
        {error}
      </p>
    ) : (
      hint && <p className="text-ink-3 text-[0.8125rem]">{hint}</p>
    )}
  </div>
)

export const InformationsStep = ({ values, errors, set }: StepProps) => (
  <StepCard id={STEP_ID.informations} n={1} title="Informations">
    <Field id="exam-title" label="Titre" error={errors.title}>
      <Input
        id="exam-title"
        value={values.title}
        maxLength={200}
        aria-invalid={Boolean(errors.title)}
        onChange={(e) => set("title", e.target.value)}
        data-testid="exam-title-input"
      />
    </Field>
    <Field
      id="exam-description"
      label="Description"
      hint="Visible par les étudiants sur la carte de l'examen."
    >
      <Textarea
        id="exam-description"
        rows={3}
        maxLength={2000}
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        data-testid="exam-description-input"
      />
    </Field>
  </StepCard>
)

/**
 * Fenêtre à la journée. Un jour choisi vaut minuit du navigateur ; le jour
 * d'un instant enregistré se lit donc aussi dans le fuseau du navigateur, ce
 * que le rendu serveur ne connaît pas : les champs se remplissent au montage.
 */
export const WindowStep = ({ values, errors, set }: StepProps) => {
  const mounted = useMounted()
  const dayOf = (ms: number | null) =>
    mounted && ms !== null ? toLocalDay(ms) : ""
  const startDay = dayOf(values.startDate)
  const endDay = dayOf(values.endDate)
  return (
    <StepCard
      id={STEP_ID.window}
      n={2}
      title="Fenêtre d'ouverture"
      description={`Ouverture à 0${NBSP}h${NBSP}00 le premier jour, fermeture à 0${NBSP}h${NBSP}00 le jour de fin. Pour un examen d'un jour, choisissez le lendemain comme fin.`}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="exam-start" label="Ouverture" error={errors.startDate}>
          <Input
            id="exam-start"
            type="date"
            value={startDay}
            aria-invalid={Boolean(errors.startDate)}
            onChange={(e) => set("startDate", fromLocalDay(e.target.value))}
            data-testid="exam-start-input"
          />
        </Field>
        <Field id="exam-end" label="Fermeture" error={errors.endDate}>
          <Input
            id="exam-end"
            type="date"
            value={endDay}
            aria-invalid={Boolean(errors.endDate)}
            onChange={(e) => set("endDate", fromLocalDay(e.target.value))}
            data-testid="exam-end-input"
          />
        </Field>
      </div>
      {startDay && endDay && endDay > startDay && (
        <p
          className="bg-surface-2 border-line text-ink-2 flex items-center gap-2 rounded-md border px-3 py-2 text-[0.8125rem]"
          data-testid="exam-window-note"
        >
          <CalendarRange aria-hidden className="text-ink-3 size-3.5 shrink-0" />
          <span className="font-mono">{windowNote(startDay, endDay)}</span>
        </p>
      )}
    </StepCard>
  )
}

export const FormatStep = ({
  values,
  errors,
  set,
  frozen,
  resetWarning,
}: StepProps & {
  frozen: boolean
  /** `null` : le visé saisi ne remet pas l'examen en préparation. */
  resetWarning: string | null
}) => (
  <StepCard id={STEP_ID.format} n={3} title="Format">
    <Field
      id="exam-target"
      label="Nombre de questions visé"
      hint={`Entre ${MIN_EXAM_QUESTIONS} et ${MAX_EXAM_QUESTIONS}. La durée est calculée à la finalisation${NBSP}: ${SECONDS_PER_QUESTION} secondes par question.`}
      error={errors.targetQuestionCount}
    >
      <Input
        id="exam-target"
        inputMode="numeric"
        className="max-w-40"
        disabled={frozen}
        value={values.targetQuestionCount || ""}
        aria-invalid={Boolean(errors.targetQuestionCount)}
        onChange={(e) =>
          set(
            "targetQuestionCount",
            Number(e.target.value.replace(/\D/g, "")) || 0,
          )
        }
        data-testid="exam-target-input"
      />
    </Field>
    {resetWarning && (
      <p
        className="border-warning-line bg-warning-soft text-warning-ink rounded-md border px-3 py-2 text-[0.8125rem]"
        data-testid="exam-target-reset-warning"
      >
        {resetWarning}
      </p>
    )}
    <div className="border-line flex items-start justify-between gap-4 border-t pt-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor="exam-pause" className="text-ink text-[0.9375rem]">
          Pause
        </label>
        <p className="text-ink-3 text-[0.8125rem] leading-normal">
          Une seule pause. Elle se déclenche d&apos;elle-même à mi-temps si le
          candidat ne l&apos;a pas prise. Après la pause, les questions de la
          première moitié sont verrouillées.
        </p>
      </div>
      <Switch
        id="exam-pause"
        checked={values.enablePause}
        onCheckedChange={(checked) => set("enablePause", checked)}
        data-testid="exam-pause-switch"
      />
    </div>
    {values.enablePause && (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-ink text-sm font-medium">
            Durée de la pause
          </span>
          <span
            className="text-ink font-mono text-sm"
            data-testid="exam-pause-minutes"
          >
            {values.pauseDurationMinutes}
            {NBSP}min
          </span>
        </div>
        <Slider
          min={MIN_PAUSE_MINUTES}
          max={MAX_PAUSE_MINUTES}
          step={1}
          value={[values.pauseDurationMinutes]}
          onValueChange={([v]) => set("pauseDurationMinutes", v)}
          aria-label="Durée de la pause"
          className="py-2"
        />
        <div className="text-ink-3 flex justify-between font-mono text-[0.6875rem]">
          <span>
            {MIN_PAUSE_MINUTES}
            {NBSP}min
          </span>
          <span>
            {MAX_PAUSE_MINUTES}
            {NBSP}min
          </span>
        </div>
      </div>
    )}
  </StepCard>
)

export const AudienceStep = ({
  values,
  errors,
  set,
  subscriberCount,
}: StepProps & { subscriberCount: number }) => {
  const n = values.audience.length
  return (
    <StepCard id={STEP_ID.audience} n={4} title="Audience">
      <SegmentedControl
        label="Audience"
        value={values.audienceType}
        onValueChange={(v) => set("audienceType", v)}
        options={[
          { value: "subscribers", label: "Abonnés Examens" },
          { value: "restricted", label: "Liste restreinte" },
        ]}
        testIdPrefix="exam-audience"
        className="self-start"
      />
      {values.audienceType === "subscribers" ? (
        <p className="text-ink-3 text-[0.8125rem]">
          Tous les étudiants avec un accès Examens actif{NBSP}:{" "}
          {subscriberCount.toLocaleString("fr-CA")} aujourd&apos;hui.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <UserMultiSelect
            value={values.audience}
            onChange={(next) => set("audience", next)}
          />
          <p
            className={
              errors.audienceUserIds
                ? "text-danger-ink text-[0.8125rem]"
                : "text-ink-3 text-[0.8125rem]"
            }
            data-testid="exam-audience-help"
          >
            {errors.audienceUserIds
              ? errors.audienceUserIds
              : `${n > 0 ? `${countLabel(n, "étudiant sélectionné", "étudiants sélectionnés")}. ` : ""}Seuls les étudiants de la liste peuvent passer l'examen, sans abonnement. Une liste vide est acceptée en préparation.`}
          </p>
        </div>
      )}
    </StepCard>
  )
}
