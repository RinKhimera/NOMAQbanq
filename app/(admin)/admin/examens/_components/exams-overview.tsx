"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import type { AdminExamOverviewItem } from "@/features/exams/dal"
import { useClock } from "@/hooks/use-clock"
import { NBSP } from "@/lib/format"
import { overviewSections, recentAverage } from "./exams-overview-model"
import { FinishedExamsTable } from "./finished-exams-table"
import { LiveExamCard } from "./live-exam-card"
import { OverviewSection } from "./overview-section"
import { PrepExamCard } from "./prep-exam-card"

export const ExamsOverview = ({
  exams,
  initialNow,
}: {
  exams: AdminExamOverviewItem[]
  initialNow: number
}) => {
  const now = useClock(initialNow)
  const { live, toPrepare, finished } = overviewSections(exams, now)
  const average = recentAverage(finished)

  return (
    <>
      <PageIntro
        eyebrow="Contenu"
        title="Examens blancs"
        description="Chaque examen s'ouvre sur une fenêtre de dates. Les résultats sont publiés à la fermeture."
        actions={
          <Button asChild>
            <Link href="/admin/examens/creer" data-testid="btn-create-exam">
              <Plus aria-hidden />
              Créer un examen
            </Link>
          </Button>
        }
      />

      <OverviewSection
        id="live"
        title="En cours"
        count={live.length}
        empty="Aucun examen en cours."
      >
        {live.map((exam) => (
          <LiveExamCard key={exam.id} exam={exam} now={now} />
        ))}
      </OverviewSection>

      <OverviewSection
        id="prepare"
        title="À préparer"
        count={toPrepare.length}
        empty="Aucun examen à venir ni en préparation."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {toPrepare.map((exam) => (
            <PrepExamCard key={exam.id} exam={exam} now={now} />
          ))}
        </div>
      </OverviewSection>

      <OverviewSection
        id="finished"
        title="Terminés"
        count={finished.length}
        empty="Aucun examen terminé."
        extra={
          average !== null && (
            <span
              className="text-ink-3 font-mono text-xs"
              data-testid="finished-recent-average"
            >
              moyenne des {average.count} derniers{NBSP}: {average.value}
              {NBSP}%
            </span>
          )
        }
      >
        <FinishedExamsTable exams={finished} />
      </OverviewSection>
    </>
  )
}
