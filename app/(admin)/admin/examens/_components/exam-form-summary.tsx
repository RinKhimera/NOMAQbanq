import ExamStatusBadge from "@/components/admin/exam-status-badge"
import {
  type SummaryCheck,
  type SummaryCheckState,
  SummaryPanel,
} from "@/components/shared/form-steps"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { ReadinessCheck } from "@/lib/exam-readiness"
import { NBSP } from "@/lib/format"
import type { ExamStatus } from "@/types"

export type ExamFormAction = "save" | "finalize" | "update"

/**
 * Vérifications du récapitulatif : celles de la carte « À préparer », sur
 * l'état courant du formulaire. Une vérification bloquante passe en erreur
 * après une tentative refusée ; le jeu d'un examen figé est verrouillé.
 */
export const summaryChecks = (
  checks: ReadinessCheck[],
  opts: { frozen: boolean; showErrors: boolean },
): SummaryCheck[] =>
  checks.map((c) => {
    let state: SummaryCheckState
    if (c.key === "questions" && opts.frozen) state = "locked"
    else if (c.ok) state = "ok"
    else if (c.tone === "warning") state = "advice"
    else state = opts.showErrors ? "error" : "todo"
    return { id: c.key, label: `${c.label}${NBSP}: ${c.value}`, state }
  })

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="border-line flex justify-between gap-3 border-b pb-2.5 text-sm">
    <span className="text-ink-3">{label}</span>
    <span className="text-ink text-right font-mono">{value}</span>
  </div>
)

export const ExamFormSummary = ({
  status,
  checks,
  refusals,
  duration,
  pause,
  finalized,
  pending,
  onAction,
  onCancel,
}: {
  status: ExamStatus
  checks: SummaryCheck[]
  /** Tentatives refusées : chaque nouvelle relance l'annonce des vérifications. */
  refusals: number
  duration: string
  pause: string
  /** Examen finalisé : une seule écriture, « Enregistrer les modifications ». */
  finalized: boolean
  pending: ExamFormAction | null
  onAction: (action: ExamFormAction) => void
  onCancel: () => void
}) => {
  const label = (action: ExamFormAction, text: string) =>
    pending === action ? (
      <>
        <Spinner size="sm" />
        {text}
      </>
    ) : (
      text
    )
  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--shell-offset,0px)+1rem)]">
      <div className="flex items-center justify-between gap-2">
        <span className="type-label">Récapitulatif</span>
        <ExamStatusBadge status={status} />
      </div>
      <SummaryPanel checks={checks} blink={refusals}>
        <Fact label="Durée" value={duration} />
        <Fact label="Pause" value={pause} />
        <Fact label="Tentatives" value="1 par étudiant" />
        <Fact label="Résultats" value="à la fermeture" />
        {finalized ? (
          <Button
            type="button"
            className="mt-1 w-full"
            disabled={pending !== null}
            onClick={() => onAction("update")}
            data-testid="btn-save-exam-changes"
          >
            {label("update", "Enregistrer les modifications")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              className="mt-1 w-full"
              disabled={pending !== null}
              onClick={() => onAction("finalize")}
              data-testid="btn-finalize-exam"
            >
              {label("finalize", "Finaliser")}
            </Button>
            <p className="text-ink-3 text-xs leading-normal">
              Un examen en préparation ne s&apos;ouvre pas, même à sa date
              d&apos;ouverture.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending !== null}
              onClick={() => onAction("save")}
              data-testid="btn-save-exam"
            >
              {label("save", "Enregistrer")}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending !== null}
          onClick={onCancel}
          data-testid="btn-cancel-exam"
        >
          Annuler
        </Button>
      </SummaryPanel>
    </div>
  )
}
