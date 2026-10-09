import { ArrowRight, Hourglass, Lock } from "lucide-react"
import Link from "next/link"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  STUDENT_EXAMS_HREF,
  studentExamResultsHref,
} from "@/constants/exam-routes"
import type { ExamRanking } from "@/features/exams/dal"
import { formatMediumDate } from "@/lib/format"
import {
  formatPercentile,
  formatScore,
  scoreTextClass,
  scoreTone,
} from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { RankingBoard } from "./ranking-board"

const count = (n: number) => n.toLocaleString("fr-CA")

const plural = (n: number, word: string) =>
  `${count(n)} ${word}${n > 1 ? "s" : ""}`

type Props = {
  ranking: ExamRanking
  /** Percentile du lecteur ; `null` sous l'effectif minimal ou sans score lisible. */
  percentile: number | null
}

export const ExamRankingView = ({ ranking, percentile }: Props) => {
  const { exam, total, rows, mine, correctionLocked } = ranking
  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        eyebrow="Classement"
        title={exam.title}
        backHref={STUDENT_EXAMS_HREF}
        description={
          <span className="font-mono text-[0.8125rem] tabular-nums">
            Fermé le {formatMediumDate(exam.endDate)} ·{" "}
            {plural(exam.questionCount, "question")} ·{" "}
            {plural(total, "participant")}
          </span>
        }
      />
      {mine && (
        <MyPosition
          examId={exam.id}
          mine={mine}
          total={total}
          percentile={percentile}
          correctionLocked={correctionLocked}
        />
      )}
      <RankingBoard rows={rows} total={total} />
    </div>
  )
}

type MyPositionProps = {
  examId: string
  mine: NonNullable<ExamRanking["mine"]>
  total: number
  percentile: number | null
  correctionLocked: boolean
}

const MyPosition = ({
  examId,
  mine,
  total,
  percentile,
  correctionLocked,
}: MyPositionProps) => {
  const heldBy = mine.held
    ? (mine.withheldBy ?? "l'examen blanc encore ouvert")
    : null
  return (
    <section
      aria-label="Votre position"
      data-testid="ranking-mine"
      className="border-line-strong bg-surface grid items-start gap-x-8 gap-y-5 rounded-lg border p-5 md:grid-cols-2 md:px-7 md:py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]"
    >
      {mine.held ? (
        <div className="flex min-w-0 flex-col gap-2 md:col-span-2 lg:col-span-2">
          <p className="type-label">Votre position</p>
          <p className="text-ink flex items-start gap-2.5 text-lg leading-snug font-semibold text-pretty">
            <Hourglass
              aria-hidden
              className="text-ink-3 mt-1 size-4.5 shrink-0"
            />
            Score retenu, publié à la fermeture de {heldBy}.
          </p>
          <p className="text-ink-3 text-sm leading-relaxed text-pretty">
            Votre rang apparaîtra à ce moment. Le classement des autres
            participants est déjà publié.
          </p>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="type-label">Votre position</p>
            <p
              data-testid="ranking-mine-rank"
              className="text-ink font-serif text-3xl font-semibold tabular-nums md:text-4xl"
            >
              Rang {count(mine.rank)}{" "}
              <span className="text-ink-3 text-xl">sur {count(total)}</span>
            </p>
            {percentile !== null && (
              <p
                data-testid="ranking-percentile"
                className="text-ink-2 text-[0.9375rem] leading-normal text-pretty"
              >
                {formatPercentile(percentile)}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2 lg:max-w-65">
            <p className="type-label">Votre score</p>
            <p
              className={`font-serif text-3xl font-semibold tabular-nums md:text-4xl ${scoreTextClass(mine.score)}`}
            >
              {formatScore(mine.score)}
            </p>
            <Progress
              value={mine.score}
              indicatorColor={TONE_COLOR[scoreTone(mine.score)]}
              className="h-1.5"
              aria-label={`Votre score : ${formatScore(mine.score)}`}
            />
          </div>
        </>
      )}
      <div className="flex flex-col items-start gap-2 max-md:*:w-full md:col-span-2 lg:col-span-1">
        <CorrectionAction
          examId={examId}
          locked={correctionLocked}
          heldBy={heldBy}
        />
      </div>
    </section>
  )
}

const CorrectionAction = ({
  examId,
  locked,
  heldBy,
}: {
  examId: string
  locked: boolean
  heldBy: string | null
}) => {
  if (locked)
    return (
      <>
        <Button size="lg" variant="outline" disabled>
          <Lock aria-hidden />
          Voir mes réponses
        </Button>
        <p className="text-ink-2 max-w-65 text-[0.8125rem] leading-normal">
          Accès requis pour la correction.{" "}
          <Link
            href="/tarifs"
            className="text-accent-ink hover:text-ink focus-ring rounded-xs underline underline-offset-2"
          >
            Voir les tarifs
          </Link>
        </p>
      </>
    )
  return (
    <>
      <Button asChild size="lg">
        <Link href={studentExamResultsHref(examId)}>
          Voir mes réponses
          <ArrowRight aria-hidden />
        </Link>
      </Button>
      {heldBy && (
        <p className="text-ink-2 max-w-65 text-[0.8125rem] leading-normal">
          Les questions communes avec {heldBy} seront corrigées à sa fermeture.
        </p>
      )}
    </>
  )
}
