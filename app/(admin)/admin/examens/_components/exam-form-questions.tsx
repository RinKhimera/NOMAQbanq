import { Eye, History, ListChecks, Lock, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { countLabel } from "@/components/admin/question-detail/labels"
import { StepCard } from "@/components/shared/form-steps"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { examComposerHref } from "@/constants/exam-routes"
import { TONE_COLOR } from "@/lib/tone"
import { STEP_ID, type SelectionSummary } from "./exam-form-model"

/** Étape « Questions » : résumé du jeu enregistré, le jeu se compose ailleurs. */
export const QuestionsStep = ({
  summary,
  target,
  examId,
  frozen,
  reopenedFrom,
  error,
}: {
  summary: SelectionSummary
  target: number
  /** `null` tant que l'examen n'est pas enregistré. */
  examId: string | null
  frozen: boolean
  /** Titre de l'examen rouvert, à la création d'une réouverture. */
  reopenedFrom: string | null
  error?: string
}) => {
  const n = summary.count
  const over = n > target
  const tone = over ? "danger" : n === target ? "success" : "info"
  const maxTop = summary.topDomains[0]?.[1] ?? 1
  return (
    <StepCard
      id={STEP_ID.questions}
      n={5}
      title="Questions"
      description={
        frozen
          ? `${n} questions, figées depuis la première participation.`
          : "Le jeu de questions est figé dès la première participation."
      }
    >
      {frozen && (
        <StatusPill tone="neutral" icon={Lock} className="self-start">
          Verrouillé
        </StatusPill>
      )}
      {error && (
        <p
          className="text-danger-ink text-[0.8125rem]"
          data-testid="exam-questions-error"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-ink-2 text-sm">
          <span
            className={
              over
                ? "text-danger-ink font-mono text-base font-semibold"
                : "text-ink font-mono text-base font-semibold"
            }
            data-testid="exam-questions-count"
          >
            {n} / {target || "—"}
          </span>{" "}
          questions
        </span>
        <Progress
          value={target > 0 ? Math.min(100, (n / target) * 100) : 0}
          indicatorColor={TONE_COLOR[tone]}
          className="h-1"
          aria-label="Questions choisies sur le nombre visé"
        />
        {reopenedFrom && (
          <span className="text-ink-3 text-xs">
            Questions reprises de {reopenedFrom}, sauf celles supprimées depuis.
          </span>
        )}
      </div>

      {summary.topDomains.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="type-label">Domaines les plus représentés</span>
          <ul className="flex flex-col gap-1.5">
            {summary.topDomains.map(([domain, count]) => (
              <li
                key={domain}
                className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2rem]"
              >
                <span className="text-ink-2 truncate text-[0.8125rem]">
                  {domain}
                </span>
                <span
                  aria-hidden
                  className="bg-surface-2 col-span-full row-start-2 h-2 overflow-hidden rounded-xs sm:col-span-1 sm:row-start-auto"
                >
                  <span
                    className="bg-accent block h-full"
                    style={{ width: `${(count / maxTop) * 100}%` }}
                  />
                </span>
                <span className="text-ink text-right font-mono text-xs sm:col-start-3 sm:row-start-1">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(summary.recent > 0 || summary.keyToVerify > 0) && (
        <div className="text-warning-ink flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
          {summary.recent > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <History aria-hidden className="text-warning size-3.5" />
              {countLabel(
                summary.recent,
                "question récente",
                "questions récentes",
              )}
            </span>
          )}
          {summary.keyToVerify > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert aria-hidden className="text-warning size-3.5" />
              {countLabel(
                summary.keyToVerify,
                "clé à vérifier",
                "clés à vérifier",
              )}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {examId ? (
          <Button
            asChild
            variant={frozen ? "outline" : "default"}
            className="max-md:min-h-11"
          >
            <Link
              href={examComposerHref(examId, "formulaire")}
              data-testid="btn-compose-questions"
            >
              {frozen ? <Eye aria-hidden /> : <ListChecks aria-hidden />}
              {frozen
                ? "Voir le jeu de questions"
                : "Composer le jeu de questions"}
            </Link>
          </Button>
        ) : (
          <>
            <Button disabled data-testid="btn-compose-questions">
              <ListChecks aria-hidden />
              Composer le jeu de questions
            </Button>
            <span className="text-ink-3 text-[0.8125rem]">
              Enregistrez d&apos;abord l&apos;examen{" "}: il sera en
              préparation.
            </span>
          </>
        )}
      </div>
    </StepCard>
  )
}
