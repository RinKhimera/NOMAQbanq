"use client"

import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  Scissors,
  TriangleAlert,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  type ClipboardEvent,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { countLabel } from "@/components/admin/question-detail/labels"
import { QuestionImageUploader } from "@/components/admin/question-image-uploader"
import { QuestionCard } from "@/components/quiz/question-card"
import { optionLetter } from "@/components/quiz/question-card/answer-option"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  StepCard,
  type SummaryCheck,
  SummaryPanel,
} from "@/components/shared/form-steps"
import { PageIntro } from "@/components/shared/page-intro"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MEDICAL_DOMAINS } from "@/constants"
import {
  createQuestion,
  setQuestionImages,
  updateQuestion,
} from "@/features/questions/actions"
import type { KeyConfirmation } from "@/features/questions/key-review"
import {
  EXPLANATION_MAX_LENGTH,
  type FormatIssue,
  REFERENCE_MAX_LENGTH,
  diagnoseCorrection,
  normalizeExplanation,
  normalizeReferenceEntry,
  splitReferenceEntry,
} from "@/features/questions/normalization"
import { useLeaveGuard } from "@/hooks/use-leave-guard"
import { NBSP, formatLongDate } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TOUCH_SIZE } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import {
  type FormImage,
  MAX_OPTIONS,
  MAX_REFERENCES,
  MIN_OPTIONS,
  type QuestionFormStep,
  type QuestionFormValues,
  blankQuestionForm,
  duplicateOf,
  hasReferences,
  newQuestionId,
  questionFormChecks,
  snapshotOf,
  toQuestionPayload,
} from "./question-form-model"
import {
  type QuestionListState,
  questionHref,
  questionListHref,
} from "./question-params"

/** Ce que l'édition d'une question déjà en service doit savoir d'elle. */
export type QuestionEditContext = {
  /** Fil d'Ariane : « Question du … ». */
  title: string
  /** Réponses passées par choix d'origine (index des options enregistrées). */
  pastCounts: number[]
  originalOptions: string[]
  originalKeyIndex: number
  /** Clé confirmée en vigueur : la modifier l'annulera. */
  confirmation: KeyConfirmation | null
  /** Examen ouvert qui fige les choix et la clé. */
  lockingExam: { title: string; endDate: number } | null
}

const STEP_ID: Record<QuestionFormStep, string> = {
  classement: "qf-classement",
  enonce: "qf-enonce",
  choix: "qf-choix",
  explication: "qf-explication",
  references: "qf-references",
}

const formatThousands = (n: number) => n.toLocaleString("fr-CA")

const Message = ({
  tone = "note",
  children,
}: {
  tone?: "note" | "danger"
  children: React.ReactNode
}) => (
  <span
    className={cn(
      "text-[0.8125rem] leading-normal",
      tone === "danger" ? "text-danger-ink" : "text-ink-3",
    )}
  >
    {children}
  </span>
)

const FormatWarnings = ({
  issues,
  testId,
}: {
  issues: FormatIssue[]
  testId: string
}) =>
  issues.length === 0 ? null : (
    <div
      data-testid={testId}
      className="border-warning-line bg-warning-soft flex gap-2 rounded-md border p-3 text-[0.8125rem]"
    >
      <TriangleAlert
        aria-hidden
        className="text-warning mt-0.5 size-3.5 shrink-0"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-ink font-medium">Mise en forme à vérifier</span>
        {issues.map((i) => (
          <span key={`${i.code}-${i.index ?? ""}`} className="text-ink-2">
            {i.message}
          </span>
        ))}
      </div>
    </div>
  )

const FormatUndoBanner = ({ onUndo }: { onUndo: () => void }) => (
  <div
    role="status"
    data-testid="format-undo-banner"
    className="text-ink-2 flex items-center gap-2 text-[0.8125rem]"
  >
    <WandSparkles aria-hidden className="text-ink-3 size-3.5" />
    Mise en forme appliquée
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-testid="btn-format-undo"
      onClick={onUndo}
    >
      <Undo2 aria-hidden />
      Annuler
    </Button>
  </div>
)

/**
 * Le texte collé, et le champ tel que le collage brut l'aurait laissé. Seul le
 * texte collé décide d'intercepter : coller un mot propre dans un champ ancien
 * ne doit pas reformater tout le champ.
 */
const readPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget
  const pasted = e.clipboardData.getData("text/plain")
  const raw =
    el.value.slice(0, el.selectionStart) +
    pasted +
    el.value.slice(el.selectionEnd)
  // Les bords du morceau collé ne sont pas une mise en forme à corriger.
  const text = pasted.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "")
  return { text, raw }
}

const replaceAt = <T,>(list: T[], index: number, entries: T[]) => [
  ...list.slice(0, index),
  ...entries,
  ...list.slice(index + 1),
]

const pastAnswersNote = (n: number) =>
  `${n > 1 ? `Ses ${n} réponses passées deviendront` : "Sa réponse passée deviendra"} « formulation antérieure ».`

const ChoicesEditor = ({
  values,
  setValues,
  frozen,
  edit,
  showErrors,
}: {
  values: QuestionFormValues
  setValues: (update: (v: QuestionFormValues) => QuestionFormValues) => void
  frozen: boolean
  edit: QuestionEditContext | null
  showErrors: boolean
}) => {
  const { options, sources, keyIndex } = values
  const dups = duplicateOf(options)
  const canRemove = !frozen && options.length > MIN_OPTIONS
  const past = (i: number) => {
    const source = sources[i]
    return edit && source !== null ? (edit.pastCounts[source] ?? 0) : 0
  }
  const removed = edit
    ? edit.originalOptions
        .map((option, index) => ({
          option,
          index,
          n: edit.pastCounts[index] ?? 0,
        }))
        .filter((o) => o.n > 0 && !sources.includes(o.index))
    : []

  const setOption = (i: number, text: string) =>
    setValues((v) => ({ ...v, options: replaceAt(v.options, i, [text]) }))
  const remove = (i: number) =>
    setValues((v) => ({
      ...v,
      options: replaceAt(v.options, i, []),
      sources: replaceAt(v.sources, i, []),
      keyIndex:
        v.keyIndex !== null && v.keyIndex > i ? v.keyIndex - 1 : v.keyIndex,
    }))
  const add = (text: string, source: number | null) =>
    setValues((v) => {
      // Un choix rétabli reprend sa place parmi les choix d'origine.
      const at =
        source === null
          ? v.options.length
          : v.sources.filter((s) => s !== null && s < source).length
      return {
        ...v,
        options: [...v.options.slice(0, at), text, ...v.options.slice(at)],
        sources: [...v.sources.slice(0, at), source, ...v.sources.slice(at)],
        keyIndex:
          v.keyIndex !== null && v.keyIndex >= at ? v.keyIndex + 1 : v.keyIndex,
      }
    })

  return (
    <div className="flex flex-col gap-3">
      {options.map((option, i) => {
        const isKey = keyIndex === i
        const empty = showErrors && !option.trim()
        const n = past(i)
        const source = sources[i]
        const reworded =
          n > 0 && source !== null && option !== edit?.originalOptions[source]
        return (
          <div key={i} className="flex flex-col gap-1">
            <div
              className={cn(
                "bg-surface flex items-center gap-2 rounded-md border p-1.5",
                isKey ? "border-success" : "border-line-strong",
                (dups[i] >= 0 || empty) && "border-danger",
                frozen && "bg-surface-2",
              )}
            >
              <button
                type="button"
                aria-pressed={isKey}
                disabled={frozen}
                aria-label={`Désigner ${optionLetter(i)} comme clé de réponse`}
                data-testid={`btn-key-${i}`}
                onClick={() => setValues((v) => ({ ...v, keyIndex: i }))}
                className={cn(
                  "focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border font-mono text-sm font-semibold disabled:cursor-default max-lg:size-11",
                  isKey
                    ? "border-success bg-success text-white"
                    : "border-line-strong text-ink-2 hover:bg-surface-2",
                )}
              >
                {optionLetter(i)}
              </button>
              <Input
                value={option}
                disabled={frozen}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Choix ${optionLetter(i)}`}
                aria-label={`Choix ${optionLetter(i)}`}
                aria-invalid={dups[i] >= 0 || empty || undefined}
                data-testid={`option-input-${i}`}
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              {isKey && (
                <span className="text-success-ink font-mono text-[11px] uppercase">
                  Clé
                </span>
              )}
              {canRemove && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className={TOUCH_SIZE}
                  disabled={isKey}
                  title={
                    isKey
                      ? "Désignez d'abord une autre clé de réponse"
                      : undefined
                  }
                  aria-label={`Retirer le choix ${optionLetter(i)}`}
                  onClick={() => remove(i)}
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
            {dups[i] >= 0 && (
              <Message tone="danger">
                Le choix {optionLetter(i)} est identique au choix{" "}
                {optionLetter(dups[i])} (casse et espaces ignorés).
              </Message>
            )}
            {empty && dups[i] < 0 && (
              <Message tone="danger">
                Remplissez le choix {optionLetter(i)}.
              </Message>
            )}
            {canRemove && isKey && (
              <Message>
                Désignez d&apos;abord une autre clé de réponse pour retirer ce
                choix.
              </Message>
            )}
            {reworded && <Message>{pastAnswersNote(n)}</Message>}
          </div>
        )
      })}
      {removed.map((r) => (
        <div
          key={`removed-${r.index}`}
          className="border-line flex items-start gap-3 rounded-md border border-dashed p-2.5"
        >
          <span className="text-ink-3 font-mono text-sm">
            {optionLetter(r.index)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-ink-3 text-sm wrap-anywhere line-through">
              {r.option}
            </span>
            <Message>Choix retiré. {pastAnswersNote(r.n)}</Message>
          </span>
          {!frozen && options.length < MAX_OPTIONS && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => add(r.option, r.index)}
            >
              Rétablir
            </Button>
          )}
        </div>
      ))}
      {!frozen && options.length < MAX_OPTIONS && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => add("", null)}
        >
          <Plus aria-hidden />
          Ajouter un 5e choix
        </Button>
      )}
    </div>
  )
}

/**
 * Formulaire de question, création et édition : 5 étapes, colonne collante
 * (vérifications, actions, aperçu étudiant). « Enregistrer » reste actif : un
 * clic sur un formulaire incomplet montre les erreurs et défile vers la
 * première.
 */
export const QuestionForm = ({
  mode,
  initialQuestionId,
  initial,
  objectivesByDomain,
  list,
  edit,
}: {
  mode: "create" | "edit"
  /** Identifiant réservé en création (images envoyées avant l'enregistrement). */
  initialQuestionId: string
  initial: QuestionFormValues
  objectivesByDomain: Record<string, string[]>
  list: QuestionListState
  edit: QuestionEditContext | null
}) => {
  const router = useRouter()
  const [values, setValuesState] = useState(initial)
  const [questionId, setQuestionId] = useState(initialQuestionId)
  const [created, setCreated] = useState(mode === "edit")
  const [snapshot, setSnapshot] = useState(() => snapshotOf(initial))
  const [showErrors, setShowErrors] = useState(false)
  const [blink, setBlink] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<
    { kind: "server"; message: string } | { kind: "images" } | null
  >(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  // Une création est partie : une réponse perdue en route laisse la question
  // créée, et le prochain essai la reprend en mise à jour.
  const createSent = useRef(false)
  const [formatUndo, setFormatUndo] = useState<{
    field: "explanation" | "references"
    raw: Pick<QuestionFormValues, "explanation" | "references">
  } | null>(null)
  const [reveal, setReveal] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploads, setUploads] = useState({
    statement: { uploading: 0, failed: 0 },
    explanation: { uploading: 0, failed: 0 },
  })

  const setValues = (update: (v: QuestionFormValues) => QuestionFormValues) =>
    setValuesState(update)

  const frozen = edit?.lockingExam != null
  const answered = edit !== null && edit.pastCounts.some((n) => n > 0)
  const dirty = snapshotOf(values) !== snapshot
  const detailHref =
    mode === "edit" ? questionHref(questionId, list) : questionListHref(list)
  const backHref = detailHref

  useLeaveGuard(
    dirty && !saving,
    (leave) => setPendingLeave(() => leave),
    (href) => router.push(href),
  )

  const checks = questionFormChecks(values, { frozen, showErrors })
  const ok = checks.every((c) => c.state === "ok" || c.state === "locked")
  const summaryChecks: SummaryCheck[] = [
    ...checks,
    {
      id: "references",
      label: hasReferences(values) ? "Références" : "Références (recommandé)",
      state: hasReferences(values) ? "ok" : "advice",
    },
  ]
  const failing = (id: string) =>
    checks.find((c) => c.id === id)?.state === "error"

  const issues = useMemo(
    () =>
      diagnoseCorrection({
        explanation: values.explanation,
        references: values.references,
      }),
    [values.explanation, values.references],
  )
  const explanationIssues = issues.filter((i) => i.field === "explanation")
  const referenceIssues = (index: number) =>
    issues.filter((i) => i.field === "references" && i.index === index)

  const keyCorrected =
    answered &&
    !frozen &&
    values.keyIndex !== null &&
    edit !== null &&
    edit.originalKeyIndex >= 0 &&
    values.sources[values.keyIndex] !== edit.originalKeyIndex

  const go = (href: string) => {
    if (dirty && !saving) setPendingLeave(() => () => router.push(href))
    else router.push(href)
  }

  const applyCorrection = (
    field: "explanation" | "references",
    next: Pick<QuestionFormValues, "explanation" | "references">,
  ) => {
    setFormatUndo({
      field,
      raw: { explanation: values.explanation, references: values.references },
    })
    setValues((v) => ({ ...v, ...next }))
  }

  const onExplanationPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const { text, raw } = readPaste(e)
    if (normalizeExplanation(text) === text) return
    e.preventDefault()
    setFormatUndo({
      field: "explanation",
      raw: { explanation: raw, references: values.references },
    })
    setValues((v) => ({ ...v, explanation: normalizeExplanation(raw) }))
  }

  const onReferencePaste = (
    index: number,
    e: ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const { text, raw } = readPaste(e)
    const pasted = normalizeReferenceEntry(text)
    if (pasted.length === 1 && pasted[0] === text) return
    e.preventDefault()
    const sources = normalizeReferenceEntry(raw)
    setFormatUndo({
      field: "references",
      raw: {
        explanation: values.explanation,
        references: replaceAt(values.references, index, [raw]),
      },
    })
    setValues((v) => ({
      ...v,
      references: replaceAt(
        v.references,
        index,
        sources.length > 0 ? sources : [""],
      ),
    }))
  }

  const editReferences = (next: string[]) => {
    setFormatUndo(null)
    setValues((v) => ({ ...v, references: next }))
  }

  const setImages =
    (field: "statementImages" | "explanationImages") =>
    (update: SetStateAction<FormImage[]>) =>
      setValues((v) => ({
        ...v,
        [field]: typeof update === "function" ? update(v[field]) : update,
      }))

  const onStatementUploads = useCallback(
    (p: { uploading: number; failed: number }) =>
      setUploads((u) => ({ ...u, statement: p })),
    [],
  )
  const onExplanationUploads = useCallback(
    (p: { uploading: number; failed: number }) =>
      setUploads((u) => ({ ...u, explanation: p })),
    [],
  )

  const save = async (again: boolean) => {
    if (saving) return
    if (!ok) {
      setShowErrors(true)
      setBlink((b) => b + 1)
      const first = checks.find((c) => c.state !== "ok" && c.state !== "locked")
      if (first)
        document
          .getElementById(STEP_ID[first.step])
          ?.scrollIntoView?.({ behavior: "smooth", block: "start" })
      return
    }
    if (uploads.statement.uploading + uploads.explanation.uploading > 0) {
      toast.error("Attendez la fin de l'envoi des images.")
      return
    }

    setSaving(true)
    setSaveError(null)
    const payload = toQuestionPayload(values)
    const update = () =>
      callAction(() => updateQuestion({ id: questionId, ...payload }))
    const retry = createSent.current
    let res: { success: boolean; error?: string }
    if (created) res = await update()
    else {
      createSent.current = true
      res = await callAction(() =>
        createQuestion({ id: questionId, ...payload }),
      )
      if (!res.success && "alreadyExists" in res && retry) res = await update()
    }
    if (!res.success) {
      setSaving(false)
      setSaveError({ kind: "server", message: res.error ?? "" })
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    setCreated(true)

    // Les deux jeux sont toujours réécrits en édition : retirer la dernière
    // image doit aussi s'enregistrer.
    const imageResults = await Promise.all(
      (
        [
          ["statement", values.statementImages],
          ["explanation", values.explanationImages],
        ] as const
      )
        .filter(([, images]) => mode === "edit" || images.length > 0)
        .map(([kind, images]) =>
          callAction(() =>
            setQuestionImages({
              questionId,
              kind,
              images: images.map((img, order) => ({
                storagePath: img.storagePath,
                order,
              })),
            }),
          ),
        ),
    )
    setSaving(false)
    if (imageResults.some((r) => !r.success)) {
      setSaveError({ kind: "images" })
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    if (again) {
      const next = blankQuestionForm(values)
      setValuesState(next)
      setSnapshot(snapshotOf(next))
      setCreated(false)
      createSent.current = false
      setQuestionId(newQuestionId())
      setShowErrors(false)
      setFormatUndo(null)
      toast.success("Question enregistrée")
      window.scrollTo({ top: 0 })
      return
    }
    setSnapshot(snapshotOf(values))
    toast.success(
      mode === "edit" ? "Question mise à jour" : "Question enregistrée",
    )
    router.push(questionHref(questionId, list))
  }

  const saveLabel = saving ? (
    <>
      <Spinner size="sm" />
      Enregistrement…
    </>
  ) : mode === "edit" ? (
    "Enregistrer les modifications"
  ) : (
    "Enregistrer"
  )

  const previewOptions = values.options.filter((o) => o.trim())
  const keyText =
    values.keyIndex !== null ? values.options[values.keyIndex] : undefined
  const objectives = values.domain
    ? (objectivesByDomain[values.domain] ?? [])
    : []

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-0">
      <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
        <Link href={questionListHref(list)} className="hover:text-ink">
          Questions
        </Link>
        {edit && (
          <>
            {" › "}
            <Link href={detailHref} className="hover:text-ink">
              {edit.title}
            </Link>
          </>
        )}
        {" › "}
        <span className="text-ink">
          {mode === "edit" ? "Modifier" : "Nouvelle question"}
        </span>
      </nav>

      <PageIntro
        title={mode === "edit" ? "Modifier la question" : "Nouvelle question"}
        description={
          answered
            ? "Vos modifications s'appliquent partout, y compris aux corrections des examens déjà passés. Les réponses déjà données gardent leur verdict et les scores ne changent pas."
            : undefined
        }
      />

      {saveError?.kind === "server" && (
        <Alert variant="destructive" data-testid="save-error">
          <AlertTitle>L&apos;enregistrement a échoué.</AlertTitle>
          <AlertDescription>
            {saveError.message || "Réessayez."}
          </AlertDescription>
        </Alert>
      )}
      {saveError?.kind === "images" && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertTitle>
            Question enregistrée, mais les images n&apos;ont pas été
            enregistrées. Réessayez.
          </AlertTitle>
        </Alert>
      )}
      {edit?.confirmation && (
        <Alert>
          <BadgeCheck aria-hidden />
          <AlertDescription className="text-ink-2">
            Clé confirmée le {formatLongDate(edit.confirmation.at)}
            {edit.confirmation.byName ? ` par ${edit.confirmation.byName}` : ""}
            . Modifier l&apos;énoncé, les choix ou la clé annulera cette
            confirmation : la question pourra redevenir « Clé à vérifier ».
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <StepCard id={STEP_ID.classement} n={1} title="Classement">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qf-domain" className="text-sm font-medium">
                  Domaine
                </label>
                <Select
                  value={values.domain}
                  onValueChange={(domain) =>
                    setValues((v) => ({
                      ...v,
                      domain,
                      objective: domain === v.domain ? v.objective : "",
                    }))
                  }
                >
                  <SelectTrigger
                    id="qf-domain"
                    aria-invalid={
                      (failing("classement") && !values.domain) || undefined
                    }
                    className="w-full"
                  >
                    <SelectValue placeholder="Choisir un domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICAL_DOMAINS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {failing("classement") && !values.domain && (
                  <Message tone="danger">Choisissez un domaine.</Message>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qf-objective" className="text-sm font-medium">
                  Objectif du CMC
                </label>
                <SearchableSelect
                  id="qf-objective"
                  value={values.objective}
                  onChange={(objective) =>
                    setValues((v) => ({ ...v, objective }))
                  }
                  options={objectives.map((o) => ({ value: o, label: o }))}
                  placeholder={
                    values.domain
                      ? "Choisir ou créer un objectif"
                      : "Choisissez d'abord un domaine"
                  }
                  searchPlaceholder="Rechercher un objectif"
                  emptyText="Aucun objectif pour ce domaine"
                  creatable
                  disabled={!values.domain}
                  invalid={
                    failing("classement") &&
                    !!values.domain &&
                    !values.objective.trim()
                  }
                />
                {failing("classement") &&
                  values.domain &&
                  !values.objective.trim() && (
                    <Message tone="danger">
                      Choisissez ou créez un objectif.
                    </Message>
                  )}
              </div>
            </div>
          </StepCard>

          <StepCard
            id={STEP_ID.enonce}
            n={2}
            title="Énoncé et images"
            description="La vignette clinique et la question posée."
          >
            <div className="flex flex-col gap-1.5">
              <Textarea
                rows={7}
                value={values.question}
                aria-label="Énoncé"
                aria-invalid={failing("enonce") || undefined}
                data-testid="question-input"
                onChange={(e) =>
                  setValues((v) => ({ ...v, question: e.target.value }))
                }
                placeholder="Un homme de 54 ans se présente à l'urgence…"
                className="font-serif text-base leading-relaxed"
              />
              <div className="flex justify-between gap-3">
                <span>
                  {failing("enonce") ? (
                    <Message tone="danger">Rédigez l&apos;énoncé.</Message>
                  ) : values.question.trim() &&
                    values.question !== values.question.trim() ? (
                    <Message>
                      Les espaces en début et fin d&apos;énoncé seront retirés à
                      l&apos;enregistrement.
                    </Message>
                  ) : null}
                </span>
                <span className="text-ink-3 font-mono text-xs whitespace-nowrap">
                  {countLabel(values.question.trim().length, "caractère")}
                </span>
              </div>
            </div>
            <QuestionImageUploader
              key={`statement-${questionId}`}
              questionId={questionId}
              kind="statement"
              label="Images d'énoncé"
              images={values.statementImages}
              onImagesChange={setImages("statementImages")}
              onPendingChange={onStatementUploads}
            />
          </StepCard>

          <StepCard
            id={STEP_ID.choix}
            n={3}
            title="Choix de réponse"
            description="4 ou 5 choix. Cliquez sur la lettre pour désigner la clé de réponse."
          >
            {edit?.lockingExam && (
              <Alert data-testid="frozen-choices">
                <Lock aria-hidden />
                <AlertDescription className="text-ink-2">
                  Cette question est dans l&apos;examen ouvert «{NBSP}
                  {edit.lockingExam.title}
                  {NBSP}» jusqu&apos;au{" "}
                  {formatLongDate(edit.lockingExam.endDate)} : ses choix et sa
                  clé sont verrouillés jusqu&apos;à la fermeture. L&apos;énoncé,
                  l&apos;explication, les références et le classement restent
                  modifiables.
                </AlertDescription>
              </Alert>
            )}
            <ChoicesEditor
              values={values}
              setValues={setValues}
              frozen={frozen}
              edit={edit}
              showErrors={showErrors}
            />
            {failing("cle") && (
              <Message tone="danger">
                Désignez la clé de réponse : cliquez sur une lettre.
              </Message>
            )}
            {keyCorrected && edit && values.keyIndex !== null && (
              <Alert variant="warning" data-testid="key-corrected">
                <TriangleAlert aria-hidden />
                <AlertTitle>
                  Clé corrigée : {optionLetter(edit.originalKeyIndex)} →{" "}
                  {optionLetter(values.keyIndex)}
                </AlertTitle>
                <AlertDescription className="text-ink-2">
                  Vous corrigez la clé de réponse : le taux de réussite sera
                  recalculé sur la nouvelle clé. Les verdicts et les scores
                  passés ne changent pas, et les étudiants verront que la clé a
                  été corrigée.
                </AlertDescription>
              </Alert>
            )}
          </StepCard>

          <StepCard
            id={STEP_ID.explication}
            n={4}
            title="Explication"
            description="Affichée dans la correction et en mode tuteur. Numérotez les appels de références : [1], [1-3]. 20 000 caractères au plus."
          >
            <div className="flex flex-col gap-1.5">
              <Textarea
                rows={8}
                value={values.explanation}
                aria-label="Explication"
                aria-invalid={
                  failing("explication") ||
                  values.explanation.length > EXPLANATION_MAX_LENGTH ||
                  undefined
                }
                data-testid="explanation-input"
                onChange={(e) => {
                  setFormatUndo(null)
                  setValues((v) => ({ ...v, explanation: e.target.value }))
                }}
                onPaste={onExplanationPaste}
                placeholder="La clé est B, car…"
              />
              {formatUndo?.field === "explanation" && (
                <FormatUndoBanner
                  onUndo={() => {
                    setValues((v) => ({ ...v, ...formatUndo.raw }))
                    setFormatUndo(null)
                  }}
                />
              )}
              <div className="flex justify-between gap-3">
                <span>
                  {failing("explication") ? (
                    <Message tone="danger">Rédigez l&apos;explication.</Message>
                  ) : values.explanation.length > EXPLANATION_MAX_LENGTH ? (
                    <Message tone="danger">20 000 caractères au plus.</Message>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs whitespace-nowrap",
                    values.explanation.length > EXPLANATION_MAX_LENGTH
                      ? "text-danger-ink"
                      : "text-ink-3",
                  )}
                >
                  {formatThousands(values.explanation.length)} / 20 000
                </span>
              </div>
              <FormatWarnings
                issues={explanationIssues}
                testId="explanation-format-warnings"
              />
            </div>
            <QuestionImageUploader
              key={`explanation-${questionId}`}
              questionId={questionId}
              kind="explanation"
              label="Images d'explication"
              help="Affichées seulement à la correction, jamais pendant la passation."
              images={values.explanationImages}
              onImagesChange={setImages("explanationImages")}
              onPendingChange={onExplanationUploads}
            />
          </StepCard>

          <StepCard
            id={STEP_ID.references}
            n={5}
            title="Références"
            description="Une entrée par source, dans l'ordre des appels de l'explication."
          >
            <div className="flex flex-col gap-3">
              {values.references.map((reference, i) => {
                const canSplit = splitReferenceEntry(reference).length > 1
                const tooLong = reference.length > REFERENCE_MAX_LENGTH
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-2"
                  >
                    <span className="text-ink-3 pt-2.5 font-mono text-xs">
                      [{i + 1}]
                    </span>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <Textarea
                        rows={2}
                        value={reference}
                        aria-label={`Référence ${i + 1}`}
                        aria-invalid={tooLong || undefined}
                        data-testid={`reference-input-${i}`}
                        onChange={(e) =>
                          editReferences(
                            replaceAt(values.references, i, [e.target.value]),
                          )
                        }
                        onPaste={(e) => onReferencePaste(i, e)}
                        placeholder="Auteurs. Titre. Revue. Année;volume:pages."
                        className="min-h-16"
                      />
                      {tooLong && (
                        <Message tone="danger">
                          {formatThousands(reference.length)} caractères :{" "}
                          {formatThousands(REFERENCE_MAX_LENGTH)} au plus par
                          référence.
                        </Message>
                      )}
                      <FormatWarnings
                        issues={referenceIssues(i)}
                        testId={`reference-format-warnings-${i}`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {canSplit && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          data-testid={`btn-split-reference-${i}`}
                          disabled={
                            values.references.length -
                              1 +
                              splitReferenceEntry(reference).length >
                            MAX_REFERENCES
                          }
                          onClick={() =>
                            applyCorrection("references", {
                              explanation: values.explanation,
                              references: replaceAt(
                                values.references,
                                i,
                                splitReferenceEntry(reference),
                              ),
                            })
                          }
                        >
                          <Scissors aria-hidden />
                          Découper
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className={TOUCH_SIZE}
                        aria-label={`Retirer la référence ${i + 1}`}
                        disabled={values.references.length === 1}
                        onClick={() =>
                          editReferences(replaceAt(values.references, i, []))
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {formatUndo?.field === "references" && (
                <FormatUndoBanner
                  onUndo={() => {
                    setValues((v) => ({ ...v, ...formatUndo.raw }))
                    setFormatUndo(null)
                  }}
                />
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={values.references.length >= MAX_REFERENCES}
                  onClick={() => editReferences([...values.references, ""])}
                >
                  <Plus aria-hidden />
                  Ajouter une référence
                </Button>
                <span className="text-ink-3 text-xs">
                  {MAX_REFERENCES} références au plus,{" "}
                  {formatThousands(REFERENCE_MAX_LENGTH)} caractères chacune
                </span>
                <span className="text-ink-3 ml-auto font-mono text-xs">
                  {values.references.filter((r) => r.trim()).length} /{" "}
                  {MAX_REFERENCES}
                </span>
              </div>
            </div>
          </StepCard>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--shell-offset,0px)+1rem)]">
          <SummaryPanel checks={summaryChecks} blink={blink}>
            <Button
              type="button"
              className="w-full"
              disabled={saving}
              onClick={() => save(false)}
              data-testid="btn-save-question"
            >
              {saveLabel}
            </Button>
            {mode === "create" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={saving}
                onClick={() => save(true)}
                data-testid="btn-save-and-new"
              >
                Enregistrer et en créer une autre
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={saving}
              onClick={() => go(backHref)}
            >
              Annuler
            </Button>
          </SummaryPanel>

          <div className="bg-surface border-line rounded-lg border">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                aria-expanded={previewOpen}
                onClick={() => setPreviewOpen(!previewOpen)}
                className="focus-ring flex cursor-pointer items-center gap-1.5 rounded-xs lg:pointer-events-none"
              >
                <span className="type-label">Aperçu étudiant</span>
                {previewOpen ? (
                  <ChevronUp aria-hidden className="size-3.5 lg:hidden" />
                ) : (
                  <ChevronDown aria-hidden className="size-3.5 lg:hidden" />
                )}
              </button>
              <label className="text-ink-2 flex items-center gap-2 text-[0.8125rem]">
                Correction
                <Switch checked={reveal} onCheckedChange={setReveal} />
              </label>
            </div>
            <div
              className={cn(
                "border-line border-t p-3",
                !previewOpen && "max-lg:hidden",
              )}
            >
              {values.question.trim() || previewOptions.length ? (
                <QuestionCard
                  variant="exam"
                  showCorrectAnswer={reveal}
                  revealExplanationImages
                  question={{
                    _id: questionId,
                    question: values.question.trim() || "…",
                    options: previewOptions.length ? previewOptions : ["…"],
                    domain: values.domain || "Domaine",
                    objectifCMC: values.objective || "Objectif du CMC",
                    images: values.statementImages,
                    correctAnswer:
                      keyText && keyText.trim() ? keyText : undefined,
                    explanation: values.explanation,
                    references: values.references.filter((r) => r.trim()),
                    explanationImages: values.explanationImages,
                  }}
                />
              ) : (
                <p className="text-ink-3 px-2 py-6 text-center text-sm">
                  L&apos;aperçu apparaît dès que vous saisissez l&apos;énoncé ou
                  les choix.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border-line fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t px-4 py-3 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => go(backHref)}
        >
          Annuler
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={saving}
          onClick={() => save(false)}
        >
          {saveLabel}
        </Button>
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
