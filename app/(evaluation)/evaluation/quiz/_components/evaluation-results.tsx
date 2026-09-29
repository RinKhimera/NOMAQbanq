"use client"

import { ArrowRight, RotateCcw } from "lucide-react"
import Link from "next/link"
import { CtaBand } from "@/components/marketing/cta-band"
import {
  Eyebrow,
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { SessionResults } from "@/components/quiz/results/session-results"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { MarketingShell } from "@/components/shared/marketing-shell"
import { ScoreRing } from "@/components/shared/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMinutesSeconds } from "@/lib/attempt-clock"
import { evaluationOutcome, evaluationVerdict } from "@/lib/evaluation"
import { cn } from "@/lib/utils"

type EvaluationResultsProps = {
  /** Questions fusionnées avec la correction renvoyée par le serveur. */
  questions: QuizQuestion[]
  userAnswers: (string | null)[]
  elapsedSeconds: number
  totalSeconds: number
  onRestart: () => void
}

/**
 * Bilan de l'évaluation gratuite, dans la coquille de la vitrine : score,
 * domaines à travailler, puis la correction partagée des résultats de session.
 */
export const EvaluationResults = ({
  questions,
  userAnswers,
  elapsedSeconds,
  totalSeconds,
  onRestart,
}: EvaluationResultsProps) => {
  const outcome = evaluationOutcome(questions, userAnswers)
  const details = [
    {
      label: "Bonnes réponses",
      value: `${outcome.correct} / ${outcome.scored}`,
    },
    {
      label: "Temps utilisé",
      value: `${formatMinutesSeconds(elapsedSeconds)} / ${formatMinutesSeconds(totalSeconds)}`,
    },
    { label: "Sans réponse", value: String(outcome.unanswered) },
  ]

  return (
    <MarketingShell>
      <MarketingHero
        label="Résultats de l'évaluation"
        title={`Vous avez obtenu ${outcome.correct} / ${outcome.scored}.`}
        description={evaluationVerdict(outcome.percent)}
        aside={
          <div className="border-line bg-surface grid grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border max-sm:grid-cols-1">
            <div className="border-line grid place-items-center border-r p-6 max-sm:border-r-0 max-sm:border-b">
              <ScoreRing
                value={outcome.percent}
                label="Score"
                size={128}
                strokeWidth={10}
                valueTestId="score-percentage"
              />
            </div>
            <dl className="divide-line flex flex-col justify-center divide-y">
              {details.map((d) => (
                <div
                  key={d.label}
                  className="flex items-baseline justify-between gap-3 px-5 py-4"
                >
                  <dt className="text-ink-3 text-sm">{d.label}</dt>
                  <dd className="text-ink font-mono text-[15px] tabular-nums">
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2.5">
          <Button asChild size="lg">
            <Link href="/inscription">
              S&apos;inscrire pour continuer
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="outline" onClick={onRestart}>
            <RotateCcw aria-hidden />
            Recommencer
          </Button>
        </div>
      </MarketingHero>

      {outcome.weakDomains.length > 0 && (
        <section className={MARKETING_SECTION}>
          <div
            className={cn(
              MARKETING_WRAP,
              "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14",
            )}
          >
            <div className="flex flex-col gap-3.5">
              <Eyebrow>À revoir</Eyebrow>
              <h2 className="type-h2 text-ink">Domaines à travailler</h2>
              <p className="text-ink-2 text-[15px] leading-relaxed">
                Avec un accès Entraînement, filtrez la banque sur ces domaines
                et révisez en mode tuteur.
              </p>
            </div>
            <ul className="flex flex-wrap content-start gap-2">
              {outcome.weakDomains.map((domain) => (
                <li key={domain}>
                  <Badge variant="destructive" className="font-mono">
                    <span aria-hidden className="bg-danger size-1.5" />
                    {domain}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className={MARKETING_SECTION}>
        <div className={MARKETING_WRAP}>
          <div className="mb-6 flex flex-col gap-3.5">
            <Eyebrow>Correction</Eyebrow>
            <h2 className="type-h2 text-ink">Revoir vos réponses</h2>
          </div>
          <SessionResults
            kind="exam"
            score={outcome.percent}
            questions={questions}
            answers={outcome.answers}
            summary={false}
          />
        </div>
      </section>
      <CtaBand />
    </MarketingShell>
  )
}
