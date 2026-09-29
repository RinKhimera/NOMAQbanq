"use client"

import type { ReactNode } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { closesBeforeBudget } from "@/lib/exam-list"
import {
  formatCountdown,
  formatDeadline,
  formatShortDuration,
} from "@/lib/format"
import { TONE_SOFT } from "@/lib/tone"

export type ConsignesExam = {
  questionCount: number
  /** En secondes. */
  completionTime: number
  /** `null` = aucune pause pour cet examen. */
  pauseDurationMinutes: number | null
  endDate: number
}

const Num = ({ children }: { children: ReactNode }) => (
  <span className="text-ink font-mono">{children}</span>
)

/** Les cinq règles d'un examen blanc, lues avant de le commencer. */
export const ExamConsignes = ({
  questionCount,
  completionTime,
  pauseDurationMinutes,
  endDate,
}: ConsignesExam) => (
  <ul className="text-ink-2 flex list-disc flex-col gap-1.5 pl-4.5 text-sm leading-relaxed">
    <li>
      <Num>{questionCount} questions</Num> en{" "}
      <Num>{formatShortDuration(completionTime * 1000)}</Num>. Le chronomètre
      démarre immédiatement.
    </li>
    <li>Le chronomètre continue même si vous fermez la page.</li>
    <li>
      {pauseDurationMinutes ? (
        <>
          Une seule pause, jusqu&apos;à <Num>{pauseDurationMinutes} min</Num> :
          le chronomètre de l&apos;examen s&apos;arrête pendant la pause.
        </>
      ) : (
        "Aucune pause pour cet examen."
      )}
    </li>
    <li>
      Vous pouvez marquer des questions et modifier vos réponses jusqu&apos;à la
      soumission. À la fin du temps, l&apos;examen est soumis automatiquement.
    </li>
    <li>
      Une seule tentative, impossible de recommencer. Résultats et correction
      publiés à la fermeture, le {formatDeadline(endDate)}.
    </li>
  </ul>
)

type ExamConsignesFormProps = {
  exam: ConsignesExam
  /** Horloge du rendu : l'alerte de fermeture s'y compare. */
  now: number
  acknowledged: boolean
  onAcknowledgedChange: (value: boolean) => void
  disabled?: boolean
}

/**
 * Consignes à accuser avant de commencer : alerte si l'examen ferme avant la
 * fin de la durée prévue, les règles, puis « J'ai lu les consignes ». Même
 * corps dans le dialogue de la liste et sur l'écran de départ plein écran.
 */
export const ExamConsignesForm = ({
  exam,
  now,
  acknowledged,
  onAcknowledgedChange,
  disabled = false,
}: ExamConsignesFormProps) => (
  <div className="flex flex-col gap-3.5">
    {closesBeforeBudget(exam, now) && (
      <Alert className={TONE_SOFT.warning}>
        <AlertDescription className="text-warning-ink">
          Cet examen ferme dans {formatCountdown(exam.endDate - now)}, avant la
          fin des {formatShortDuration(exam.completionTime * 1000)} prévues : il
          sera soumis à la fermeture.
        </AlertDescription>
      </Alert>
    )}
    <ExamConsignes {...exam} />
    <label className="text-ink flex cursor-pointer items-center gap-2.5 text-sm max-md:min-h-11">
      <Checkbox
        checked={acknowledged}
        onCheckedChange={(v) => onAcknowledgedChange(v === true)}
        disabled={disabled}
        data-testid="exam-consignes-ack"
      />
      J&apos;ai lu les consignes.
    </label>
  </div>
)
