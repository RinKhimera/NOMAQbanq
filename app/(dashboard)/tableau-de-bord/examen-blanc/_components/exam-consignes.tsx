import { formatDeadline, formatShortDuration } from "@/lib/format"

type ExamConsignesProps = {
  questionCount: number
  /** En secondes. */
  completionTime: number
  /** `null` = aucune pause pour cet examen. */
  pauseDurationMinutes: number | null
  endDate: number
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <span className="text-ink font-mono">{children}</span>
)

/** Les cinq règles d'un examen blanc, lues avant de le commencer. */
export const ExamConsignes = ({
  questionCount,
  completionTime,
  pauseDurationMinutes,
  endDate,
}: ExamConsignesProps) => (
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
