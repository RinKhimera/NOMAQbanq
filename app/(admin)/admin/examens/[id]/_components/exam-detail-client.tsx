"use client"

import { Lock } from "lucide-react"
import Link from "next/link"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import { formatCount } from "@/components/admin/question-detail/labels"
import { PageIntro } from "@/components/shared/page-intro"
import { StatBand } from "@/components/shared/stat-band"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { examAudienceEditHref, examEditHref } from "@/constants/exam-routes"
import type {
  ExamAudienceUser,
  ExamFigures,
  LeaderboardEntry,
} from "@/features/exams/dal"
import { useClock } from "@/hooks/use-clock"
import { adminPhaseOf, adminSectionOf } from "@/lib/exam-phase"
import { isLateToOpen, preciseWindow } from "@/lib/exam-readiness"
import { formatMediumDate } from "@/lib/format"
import { TONE_COLOR } from "@/lib/tone"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import { ExamBreadcrumb } from "../../_components/exam-breadcrumb"
import { DetailCard } from "./detail-card"
import {
  RestrictedAudienceCard,
  SubscribersAudienceCard,
} from "./exam-audience-card"
import { ExamDetailActions } from "./exam-detail-actions"
import {
  type DetailExam,
  audienceBadge,
  durationBadge,
  pauseBadge,
  questionsBadge,
  statItems,
  tracking,
} from "./exam-detail-model"
import { ExamLeaderboard } from "./exam-leaderboard"

const FinalizeLink = ({ examId }: { examId: string }) => (
  <Button asChild size="sm" className={TOUCH_HEIGHT}>
    <Link href={examEditHref(examId)} data-testid="btn-finalize-exam">
      Finaliser
    </Link>
  </Button>
)

/** Fiche d'un examen blanc (admin) : pilotage, classement et audience. */
export function ExamDetailClient({
  exam,
  figures,
  leaderboard,
  audience,
  initialNow,
}: {
  exam: DetailExam
  figures: ExamFigures
  leaderboard: LeaderboardEntry[]
  audience: ExamAudienceUser[]
  /** Horloge serveur du rendu : la phase de l'examen s'en déduit. */
  initialNow: number
}) {
  const now = useClock(initialNow)
  const phase = adminPhaseOf(exam, now)
  const participations = figures.participations
  const late = isLateToOpen(exam, now)
  const follow = tracking(exam, phase, figures, now)

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <ExamBreadcrumb items={[{ label: exam.title }]} />

      <PageIntro
        eyebrow={preciseWindow(exam)}
        title={exam.title}
        actions={
          <ExamDetailActions
            exam={exam}
            participations={participations}
            now={now}
          />
        }
      />

      <div className="flex flex-wrap gap-2" data-testid="exam-badges">
        <ExamStatusBadge status={phase} />
        {[questionsBadge(exam), durationBadge(exam), pauseBadge(exam)].map(
          (label) => (
            <Badge key={label} variant="outline" className="font-mono">
              {label}
            </Badge>
          ),
        )}
        <Badge variant="outline">{audienceBadge(exam)}</Badge>
      </div>

      {late && exam.startDate !== null && (
        <Alert
          variant="destructive"
          data-testid="alert-late-to-open"
          className="flex flex-wrap items-start justify-between gap-3"
        >
          <div className="min-w-0 flex-[1_1_320px]">
            <AlertTitle>
              Devait ouvrir le {formatMediumDate(exam.startDate)}
            </AlertTitle>
            <AlertDescription className="text-ink-2">
              L&apos;examen est encore en préparation : il ne s&apos;ouvre pas,
              même à sa date d&apos;ouverture. Finalisez-le pour l&apos;ouvrir
              aux étudiants.
            </AlertDescription>
          </div>
          <FinalizeLink examId={exam.id} />
        </Alert>
      )}

      {figures.locked && (
        <Alert data-testid="alert-frozen-questions">
          <Lock aria-hidden />
          <AlertTitle>Jeu de questions figé</AlertTitle>
          <AlertDescription className="text-ink-2">
            Des participations existent : les questions ne peuvent plus être
            modifiées. Le titre, les dates, la pause et l&apos;audience restent
            modifiables, sauf repousser la fin d&apos;un examen terminé :
            utilisez « Rouvrir ».
          </AlertDescription>
        </Alert>
      )}

      <StatBand items={statItems(phase, figures, exam.audienceType)} />

      {follow && (
        <DetailCard
          testId="exam-tracking-card"
          eyebrow="Suivi"
          title={follow.title}
          description={follow.description}
          action={
            follow.finalize ? <FinalizeLink examId={exam.id} /> : undefined
          }
          bodyClassName="px-5 pb-5 md:px-6"
        >
          {follow.progress && (
            <div className="flex flex-col gap-2">
              <Progress
                value={
                  follow.progress.started === 0
                    ? 0
                    : (follow.progress.submitted / follow.progress.started) *
                      100
                }
                indicatorColor={TONE_COLOR.success}
                className="h-1.5"
                aria-label="Participations soumises"
              />
              <span className="text-ink-3 font-mono text-xs">
                {formatCount(follow.progress.submitted)} soumis sur{" "}
                {formatCount(follow.progress.started)} commencés
              </span>
            </div>
          )}
        </DetailCard>
      )}

      <ExamLeaderboard
        examId={exam.id}
        leaderboard={leaderboard}
        provisional={adminSectionOf(exam, now) === "active"}
      />

      {exam.audienceType === "restricted" ? (
        <RestrictedAudienceCard
          audience={audience}
          editHref={examAudienceEditHref(exam.id)}
        />
      ) : (
        <SubscribersAudienceCard
          eligible={figures.eligible}
          editHref={examAudienceEditHref(exam.id)}
        />
      )}
    </div>
  )
}
