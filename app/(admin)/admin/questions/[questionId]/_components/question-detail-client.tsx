"use client"

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  answersLabel,
  percent,
  questionTitle,
} from "@/components/admin/question-detail/labels"
import {
  QuestionDetailContent,
  type QuestionFile,
  topWrongOption,
} from "@/components/admin/question-detail/question-detail-content"
import { optionLetter } from "@/components/quiz/question-card/answer-option"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CopyId } from "@/components/shared/copy-id"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  confirmQuestionKey,
  deleteQuestion,
} from "@/features/questions/actions"
import type { QuestionNeighbors } from "@/features/questions/dal"
import { KEY_CONFIRMATION_NOTE_MAX } from "@/features/questions/key-review"
import { NBSP, formatLongDate, formatMediumDate } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import type { LockingExam } from "../../_components/question-page-data"
import {
  type QuestionListState,
  pageOfPosition,
  questionEditHref,
  questionHref,
  questionListHref,
} from "../../_components/question-params"

const ConfirmKeyDialog = ({
  file,
  open,
  onOpenChange,
  nextHref,
}: {
  file: QuestionFile
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Confirmée, la question sort de l'onglet « Clé à vérifier » : on enchaîne. */
  nextHref: string | null
}) => {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)
  const { breakdown } = file
  const top = topWrongOption(breakdown)
  const key = breakdown.options.findIndex((o) => o.isKey)
  const tooLong = note.length > KEY_CONFIRMATION_NOTE_MAX
  const n = breakdown.answerCount

  const submit = async () => {
    setPending(true)
    const res = await callAction(() =>
      confirmQuestionKey({ id: file.question.id, note }),
    )
    setPending(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(
      "Clé confirmée",
      nextHref
        ? {
            action: {
              label: "Question suivante",
              onClick: () => router.push(nextHref),
            },
          }
        : undefined,
    )
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-130">
        <DialogHeader>
          <DialogTitle>
            Confirmer la clé {optionLetter(key)}
            {NBSP}?
          </DialogTitle>
          <DialogDescription>
            Après revue, vous jugez la clé juste malgré la répartition. La
            question sort de l&apos;onglet « Clé à vérifier ».
          </DialogDescription>
        </DialogHeader>
        <dl className="border-line flex flex-col rounded-md border text-sm">
          {[
            [
              "Option la plus choisie",
              `${optionLetter(top)} · ${percent(breakdown.options[top]?.count ?? 0, n)} %`,
            ],
            [
              "Clé de réponse",
              `${optionLetter(key)} · ${percent(breakdown.options[key]?.count ?? 0, n)} %`,
            ],
            ["Réponses", String(n)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-line flex justify-between gap-3 border-t px-3 py-2 first:border-t-0"
            >
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-ink font-mono">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="key-note" className="text-ink text-sm font-medium">
            Pourquoi la clé est juste{" "}
            <span className="text-ink-3 font-normal">(facultatif)</span>
          </label>
          <Textarea
            id="key-note"
            rows={3}
            value={note}
            aria-invalid={tooLong || undefined}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. : piège classique, le distracteur décrit la conduite d'avant 2020"
          />
          <span
            className={
              tooLong
                ? "text-danger-ink text-xs"
                : "text-ink-3 font-mono text-xs"
            }
          >
            {tooLong
              ? `${KEY_CONFIRMATION_NOTE_MAX} caractères au plus.`
              : `${note.length} / ${KEY_CONFIRMATION_NOTE_MAX}`}
          </span>
        </div>
        <p className="text-ink-3 flex items-start gap-1.5 text-xs leading-normal">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          La confirmation tombe si l&apos;énoncé, les choix ou la clé sont
          modifiés, ou si le nombre de réponses double (10 nouvelles au moins)
          et que l&apos;écart persiste. Elle ne masque pas les signalements des
          candidats.
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={pending || tooLong}
            onClick={submit}
            data-testid="btn-confirm-key-submit"
          >
            {pending && <Spinner size="sm" />}
            Confirmer la clé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const Neighbors = ({
  neighbors,
  list,
}: {
  neighbors: QuestionNeighbors | null
  list: QuestionListState
}) => {
  const target = (id: string | null, position: number) =>
    id ? questionHref(id, { ...list, page: pageOfPosition(position) }) : null
  const previous = neighbors
    ? target(neighbors.previousId, neighbors.position - 1)
    : null
  const next = neighbors
    ? target(neighbors.nextId, neighbors.position + 1)
    : null
  const nav = (
    href: string | null,
    children: React.ReactNode,
    label: string,
  ) =>
    href ? (
      <Button
        asChild
        size="sm"
        variant="outline"
        aria-label={label}
        className={TOUCH_HEIGHT}
      >
        <Link href={href} prefetch={false}>
          {children}
          <LinkPendingIndicator />
        </Link>
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        disabled
        aria-label={label}
        className={TOUCH_HEIGHT}
      >
        {children}
      </Button>
    )
  return (
    <nav
      aria-label="Question précédente ou suivante"
      className="flex items-center gap-2"
    >
      {nav(
        previous,
        <>
          <ChevronLeft aria-hidden />
          Précédente
        </>,
        "Question précédente",
      )}
      <span
        className="text-ink-2 font-mono text-xs whitespace-nowrap"
        data-testid="question-position"
      >
        {neighbors
          ? `${neighbors.position.toLocaleString("fr-CA")} sur ${neighbors.total.toLocaleString("fr-CA")}`
          : "Hors de la liste filtrée"}
      </span>
      {nav(
        next,
        <>
          Suivante
          <ChevronRight aria-hidden />
        </>,
        "Question suivante",
      )}
    </nav>
  )
}

/**
 * Page de détail d'une question : en-tête, navigation dans la liste filtrée
 * d'où l'on vient, puis le contenu partagé avec l'aperçu.
 */
export const QuestionDetailClient = ({
  file,
  list,
  neighbors,
  lockingExam,
  initialNow,
}: {
  file: QuestionFile
  list: QuestionListState
  neighbors: QuestionNeighbors | null
  lockingExam: LockingExam | null
  initialNow: number
}) => {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const q = file.question
  const listHref = questionListHref(list)
  const editHref = questionEditHref(q.id, list)
  // Référencée par un examen ou une réponse d'étudiant : archivée à coup sûr.
  // Sinon le serveur tranche (une série ou une réponse d'admin la retient).
  const archives = file.exams.length > 0 || file.breakdown.answerCount > 0

  const remove = async () => {
    const res = await callAction(() => deleteQuestion(q.id))
    if (!res.success) {
      toast.error(res.error)
      return false
    }
    toast.success(
      res.mode === "soft"
        ? "Question archivée : elle ne sera plus tirée"
        : "Question supprimée",
    )
    router.push(listHref)
  }

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
        <Link href={listHref} className="hover:text-ink">
          Questions
        </Link>{" "}
        › <span className="text-ink">{questionTitle(q.createdAt)}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col items-start gap-2">
          <Badge variant="accent">{q.domain}</Badge>
          <h1 className="type-h3 text-ink wrap-anywhere">{q.objectifCMC}</h1>
          <span className="text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
            <span>
              Créée le {formatMediumDate(q.createdAt)}
              {formatMediumDate(q.updatedAt) !==
                formatMediumDate(q.createdAt) &&
                ` · Modifiée le ${formatMediumDate(q.updatedAt)}`}
            </span>
            <CopyId id={q.id} />
          </span>
        </div>
        <div className="flex flex-wrap gap-2 max-md:w-full max-md:*:flex-1">
          <Button asChild>
            <Link href={editHref} data-testid="btn-edit-question">
              <Pencil aria-hidden />
              Modifier
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            data-testid="btn-delete-question"
          >
            <Trash2 aria-hidden />
            Supprimer
          </Button>
        </div>
      </div>

      {lockingExam && (
        <p className="text-ink-2 flex items-start gap-2 text-sm">
          <Lock aria-hidden className="text-ink-3 mt-0.5 size-3.5 shrink-0" />
          Dans l&apos;examen ouvert « {lockingExam.title} » : choix et clé
          verrouillés jusqu&apos;au {formatLongDate(lockingExam.endDate)}.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm" variant="ghost" className={TOUCH_HEIGHT}>
          <Link href={listHref}>
            <ArrowLeft aria-hidden />
            Retour à la liste
          </Link>
        </Button>
        <Neighbors neighbors={neighbors} list={list} />
      </div>

      <QuestionDetailContent
        file={file}
        now={initialNow}
        editHref={editHref}
        confirmKeyAction={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            data-testid="btn-confirm-key"
          >
            Confirmer la clé
          </Button>
        }
      />

      {file.review.toVerify && (
        <ConfirmKeyDialog
          key={String(confirmOpen)}
          file={file}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          nextHref={
            neighbors?.nextId
              ? questionHref(neighbors.nextId, {
                  ...list,
                  page: pageOfPosition(neighbors.position),
                })
              : null
          }
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        icon={Trash2}
        title={`Supprimer cette question${NBSP}?`}
        description={
          archives
            ? `Elle sera archivée : elle reste dans les examens et l'historique des étudiants qui l'utilisent (${answersLabel(file.breakdown.answerCount)}), mais ne sera plus tirée.`
            : "Elle sera supprimée définitivement, ou archivée si une série d'entraînement la contient."
        }
        confirmLabel="Supprimer"
        pendingLabel="Suppression…"
        confirmTestId="btn-delete-question-confirm"
        onConfirm={remove}
      />
    </>
  )
}
