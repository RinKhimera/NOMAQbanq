import { CircleCheck } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { StatusCard } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"
import { getExamSubmissionSummary } from "@/features/exams/dal"
import { formatDeadline } from "@/lib/format"

interface SubmittedPageProps {
  params: Promise<{ examId: string }>
}

/**
 * Confirmation après la soumission d'un examen : la date de publication des
 * résultats, et deux sorties. Sans participation soumise → retour à la liste.
 */
export const metadata: Metadata = { title: "Examen soumis" }

export default async function ExamSubmittedPage({
  params,
}: SubmittedPageProps) {
  const { examId } = await params
  const summary = await getExamSubmissionSummary(examId)

  if (!summary) {
    redirect("/tableau-de-bord/examen-blanc")
  }

  return (
    <div className="grid place-items-center py-8 md:py-12">
      <StatusCard
        icon={CircleCheck}
        iconTone="success"
        label="Examen blanc"
        title={`${summary.examTitle} soumis`}
        description={
          summary.status === "auto_submitted"
            ? "Soumis automatiquement à la fin du temps, avec les réponses enregistrées."
            : "Vos réponses sont enregistrées."
        }
        actions={
          <>
            <Button asChild className="max-md:h-11">
              <Link href="/tableau-de-bord">Tableau de bord</Link>
            </Button>
            <Button asChild variant="outline" className="max-md:h-11">
              <Link href="/tableau-de-bord/entrainement">
                Continuer à s&apos;entraîner
              </Link>
            </Button>
          </>
        }
      >
        <dl className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-md border">
          {[
            { label: "Répondues", value: summary.answeredCount },
            { label: "Marquées", value: summary.flaggedCount },
          ].map((cell) => (
            <div
              key={cell.label}
              className="bg-surface-2 flex flex-col-reverse px-3.5 py-3"
            >
              <dt className="text-ink-3 text-xs">{cell.label}</dt>
              <dd className="text-ink font-mono text-xl tabular-nums">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-ink-2 text-base leading-relaxed">
          La correction et votre score seront publiés à la fermeture de
          l&apos;examen, le{" "}
          <span className="text-ink font-medium">
            {formatDeadline(summary.endDate)}
          </span>
          . Vous recevrez un courriel.
        </p>
      </StatusCard>
    </div>
  )
}
