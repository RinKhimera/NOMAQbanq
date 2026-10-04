import { ArrowLeft, Clock, UserX } from "lucide-react"
import Link from "next/link"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { examHref } from "@/constants/exam-routes"
import type { ExamParticipantUser } from "@/features/exams/dal"
import { ExamBreadcrumb } from "../../../../_components/exam-breadcrumb"

const STATUS_LABEL: Record<string, string> = {
  in_progress: "en cours",
  completed: "soumise",
  auto_submitted: "soumise automatiquement",
}

/**
 * Copie introuvable : aucune participation, ou participation pas encore
 * soumise. Rendu quand `getParticipantExamResults` renvoie une erreur.
 */
export function ParticipantResultsError({
  error,
  status,
  exam,
  participantUser,
}: {
  error: "NO_PARTICIPATION" | "NOT_COMPLETED"
  status?: string
  exam: { id: string; title: string }
  participantUser: ExamParticipantUser
}) {
  const name = participantUser?.name ?? "Compte introuvable"
  const Icon = error === "NO_PARTICIPATION" ? UserX : Clock

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <ExamBreadcrumb
        items={[
          { label: exam.title, href: examHref(exam.id) },
          { label: name },
        ]}
      />

      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar
          name={participantUser?.name}
          image={participantUser?.image}
          className="size-12 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-label">Copie · {exam.title}</p>
          <h1 className="type-h2 text-ink wrap-anywhere">{name}</h1>
          {participantUser?.email && (
            <p className="text-ink-3 text-[0.8125rem] wrap-anywhere">
              {participantUser.email}
            </p>
          )}
        </div>
      </div>

      <section
        data-testid="copy-unavailable"
        data-error={error}
        className="bg-surface border-line shadow-1 flex flex-col items-start gap-3 rounded-lg border p-5 md:p-6"
      >
        <Icon aria-hidden className="text-ink-3 size-6" />
        <h2 className="type-h4 text-ink">
          {error === "NO_PARTICIPATION"
            ? "Aucune participation"
            : "Copie pas encore soumise"}
        </h2>
        <p className="text-ink-2 text-sm leading-normal">
          {error === "NO_PARTICIPATION"
            ? participantUser
              ? "Cet étudiant n'a pas commencé cet examen : il n'a pas de copie."
              : "Ce compte n'existe pas ou a été supprimé."
            : `La participation est ${STATUS_LABEL[status ?? ""] ?? "en cours"} : la copie se lit une fois soumise, par l'étudiant ou à la fermeture de l'examen.`}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={examHref(exam.id)}>
            <ArrowLeft aria-hidden />
            Retour à l&apos;examen
          </Link>
        </Button>
      </section>
    </div>
  )
}
