"use client"

import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Lock,
  Percent,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { VitalCard } from "@/components/shared/vital-card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import type { ExamListItem } from "@/features/exams/dal"
import { useClock } from "@/hooks/use-clock"
import { examListStats, openExamState, sortOpenExams } from "@/lib/exam-list"
import { partition } from "@/lib/exam-phase"
import { formatCurrency, formatDeadline, formatExpiration } from "@/lib/format"
import { PASS_THRESHOLD, formatScore } from "@/lib/score"
import { cn } from "@/lib/utils"
import { ExamStartDialog } from "./exam-start-dialog"
import { PastExams, UpcomingExams } from "./exam-timeline"
import { OpenExamCard, SubmittedExamCard } from "./open-exam-card"

type AccessBannerProps = {
  expiredAt: number | null
  priceFromCents: number | null
}

/** Sans accès Examens, la liste reste : ce bandeau dit ce qui manque. */
const AccessBanner = ({ expiredAt, priceFromCents }: AccessBannerProps) => {
  const expired = expiredAt !== null
  const Icon = expired ? CircleAlert : Lock
  return (
    <section
      aria-label="Accès Examens"
      data-testid="exam-access-banner"
      className="border-line-strong bg-surface flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-5 py-4"
    >
      <Icon
        aria-hidden
        className={cn("size-4.5", expired ? "text-danger-ink" : "text-ink-3")}
      />
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
        <p className="text-ink text-[15px] font-semibold">
          {expired
            ? `Votre accès Examens a expiré le ${formatExpiration(expiredAt)}`
            : "Accès Examens requis"}
        </p>
        <p className="text-ink-2 text-sm leading-normal text-pretty">
          {expired ? (
            "Vos scores restent affichés. La correction et les examens réservés aux abonnés demandent un accès actif."
          ) : (
            <>
              Les examens réservés aux abonnés demandent un accès Examens ou le
              Pack Premium
              {priceFromCents !== null && (
                <>
                  , à partir de{" "}
                  <span className="text-ink font-mono">
                    {formatCurrency(priceFromCents, "CAD", { whole: true })}
                  </span>{" "}
                  pour 1 mois
                </>
              )}
              . Les examens sur invitation restent accessibles.
            </>
          )}
        </p>
      </div>
      <Button asChild className="max-md:h-11 max-md:w-full">
        <Link href="/tarifs">
          {expired ? "Prolonger l'accès" : "Voir les tarifs"}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </section>
  )
}

type NoOpenProps = { next: ExamListItem | undefined }

const NoOpenExam = ({ next }: NoOpenProps) => (
  <div className="border-line-strong bg-surface flex flex-wrap items-center gap-4 rounded-lg border border-dashed px-5 py-4.5">
    <CalendarClock aria-hidden className="text-ink-3 size-4.5" />
    <div className="min-w-0 flex-[1_1_260px]">
      <p className="text-ink text-[15px] font-medium">
        Aucun examen ouvert pour le moment
      </p>
      <p className="text-ink-3 text-sm">
        {next ? (
          <>
            Prochain : {next.title}, ouverture le{" "}
            <span className="text-ink font-mono">
              {formatDeadline(next.startDate)}
            </span>
            .
          </>
        ) : (
          "Le prochain examen apparaîtra ici dès sa planification."
        )}
      </p>
    </div>
    <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
      <Link href="/tableau-de-bord/entrainement">
        <BookOpen aria-hidden />
        S&apos;entraîner en attendant
      </Link>
    </Button>
  </div>
)

interface ExamenBlancClientProps {
  exams: ExamListItem[]
  /** Accès aux examens `subscribers` (abonnement actif, ou admin). Un examen
   *  sur invitation reste passable sans lui. */
  hasExamAccess: boolean
  /** Échéance passée de l'accès Examens (epoch ms) ; `null` = actif ou jamais eu. */
  accessExpiredAt: number | null
  /** Prix d'appel mensuel du catalogue, en cents. */
  priceFromCents: number | null
  initialNow: number
}

export function ExamenBlancClient({
  exams,
  hasExamAccess,
  accessExpiredAt,
  priceFromCents,
  initialNow,
}: ExamenBlancClientProps) {
  const [starting, setStarting] = useState<ExamListItem | null>(null)
  // La page suit l'horloge : décomptes à la seconde, bascules ouvert → terminé.
  const now = useClock(initialNow, 1000)

  const { active, upcoming, completed } = useMemo(
    () => partition(exams, now),
    [exams, now],
  )
  const open = useMemo(
    () =>
      sortOpenExams(
        active.map((exam) => ({
          exam,
          state: openExamState(exam, now, hasExamAccess),
        })),
      ),
    [active, now, hasExamAccess],
  )
  const stats = useMemo(() => examListStats(exams), [exams])

  if (exams.length === 0) {
    return (
      <div className="bg-surface border-line rounded-lg border px-6 py-14">
        <EmptyState
          size="compact"
          icons={[ClipboardList]}
          title="Aucun examen blanc pour l'instant"
          description="Les examens blancs sont publiés ici avec leur fenêtre d'ouverture. En attendant, les séries d'entraînement couvrent les 22 domaines."
        >
          <Button asChild variant="outline" className="max-md:h-11">
            <Link href="/tableau-de-bord/entrainement">
              Commencer une série
            </Link>
          </Button>
        </EmptyState>
      </div>
    )
  }

  const compact = open.length > 1

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <VitalCard
          label="Examens passés"
          value={String(stats.taken)}
          icon={ClipboardCheck}
          subtitle="participations soumises"
        />
        <VitalCard
          label="Réussis"
          value={stats.graded > 0 ? `${stats.passed} / ${stats.graded}` : "—"}
          icon={CircleCheck}
          subtitle={`seuil de réussite ${formatScore(PASS_THRESHOLD)}`}
        />
        <VitalCard
          label="Score moyen"
          value={stats.average === null ? "—" : String(stats.average)}
          unit="%"
          icon={Percent}
          subtitle="scores publiés seulement"
        />
      </div>

      {!hasExamAccess && (
        <AccessBanner
          expiredAt={accessExpiredAt}
          priceFromCents={priceFromCents}
        />
      )}

      {open.length > 0 ? (
        <div
          className={cn(
            "grid gap-3",
            open.length === 2 && "grid-cols-1 lg:grid-cols-2",
            open.length > 2 &&
              "grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]",
          )}
        >
          {open.map(({ exam, state }) =>
            state === "submitted" ? (
              <SubmittedExamCard
                key={exam.id}
                exam={exam}
                completedAt={exam.userParticipation?.completedAt ?? null}
              />
            ) : (
              <OpenExamCard
                key={exam.id}
                exam={exam}
                state={state}
                now={now}
                compact={compact}
                onStart={setStarting}
              />
            ),
          )}
        </div>
      ) : (
        <NoOpenExam next={upcoming[0]} />
      )}

      <UpcomingExams exams={upcoming} now={now} />
      <PastExams exams={completed} hasAccess={hasExamAccess} />

      <ExamStartDialog
        exam={starting}
        now={now}
        onClose={() => setStarting(null)}
      />
    </>
  )
}
