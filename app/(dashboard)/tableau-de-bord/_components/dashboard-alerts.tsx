import { CircleAlert, ClipboardList, Clock } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { getAccessStatus } from "@/components/shared/payments/access-badge"
import { Button } from "@/components/ui/button"
import type { ExamInProgress } from "@/features/analytics/dal"
import type { AccessStatus, LapsedAccess } from "@/features/payments/dal"
import { remainingMs } from "@/lib/attempt-clock"
import { formatDateTime, formatExpiration } from "@/lib/format"
import { TONE_SOFT, TONE_TEXT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

const ACCESS_LABEL = { exam: "Examens", training: "Entraînement" } as const

const EXPIRED_NEXT_STEP = {
  exam: "Réactivez l'accès pour passer les prochains examens blancs.",
  training: "Réactivez l'accès pour lancer de nouvelles séries.",
} as const

/** « 4 h 05 », ou « 42 min » sous l'heure. */
const shortDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  return hours > 0
    ? `${hours} h ${String(minutes % 60).padStart(2, "0")}`
    : `${minutes} min`
}

const DashboardAlert = ({
  tone,
  icon: Icon,
  title,
  action,
  children,
}: {
  tone: Tone
  icon: typeof Clock
  title: string
  action: ReactNode
  children: ReactNode
}) => (
  <div
    className={cn(
      "flex flex-wrap items-start gap-x-3 gap-y-3 rounded-lg border p-4",
      TONE_SOFT[tone],
    )}
  >
    <Icon
      className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])}
      aria-hidden="true"
    />
    <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
      <p className="text-ink text-sm font-semibold">{title}</p>
      <p className="text-ink-2 text-sm leading-relaxed">{children}</p>
    </div>
    <div className="shrink-0 max-md:w-full max-md:pl-7">{action}</div>
  </div>
)

const AlertLink = ({
  href,
  primary = false,
  children,
}: {
  href: string
  primary?: boolean
  children: ReactNode
}) => (
  <Button
    asChild
    size="sm"
    variant={primary ? "default" : "outline"}
    className="max-md:h-11"
  >
    <Link href={href}>{children}</Link>
  </Button>
)

type DashboardAlertsProps = {
  examInProgress: ExamInProgress | null
  access: AccessStatus | null
  lapsed: LapsedAccess
  /** Instant du rendu serveur : le temps restant ne se lit pas sur l'horloge du navigateur. */
  now: number
}

/**
 * Alertes du tableau de bord : examen commencé (Reprendre), accès qui expire
 * dans 7 jours ou moins (Prolonger), accès expiré (Réactiver).
 */
export const DashboardAlerts = ({
  examInProgress,
  access,
  lapsed,
  now,
}: DashboardAlertsProps) => {
  const alerts: ReactNode[] = []

  if (examInProgress) {
    const { examId, title, answeredCount, questionCount, timing } =
      examInProgress
    const remaining = remainingMs(timing, now)
    // Le cron ne clôt une participation qu'à la fermeture de l'examen : un
    // budget épuisé bien avant reste « ouvert » jusque-là.
    const timeUp = remaining === 0
    const progress = (
      <span className="font-mono">
        {answeredCount} / {questionCount}
      </span>
    )
    alerts.push(
      <DashboardAlert
        key="exam-in-progress"
        tone={timeUp ? "warning" : "info"}
        icon={ClipboardList}
        title={timeUp ? `${title} : temps écoulé` : `${title} en cours`}
        action={
          <AlertLink
            href={`/tableau-de-bord/examen-blanc/${examId}/evaluation`}
            primary
          >
            {timeUp ? "Terminer l'examen" : "Reprendre"}
          </AlertLink>
        }
      >
        {timeUp ? (
          <>
            {progress} questions répondues. Le temps imparti est épuisé : ouvrez
            l&apos;examen pour le soumettre, vos réponses enregistrées sont
            conservées.
          </>
        ) : (
          <>
            {progress} questions répondues · environ{" "}
            <span className="font-mono">{shortDuration(remaining)}</span>{" "}
            restantes. Commencé le {formatDateTime(timing.startedAt)} ;{" "}
            {timing.pauseInProgress
              ? "en pause : le chronomètre reprendra à la fin de la pause."
              : "le chronomètre continue de tourner."}
          </>
        )}
      </DashboardAlert>,
    )
  }

  for (const type of ["exam", "training"] as const) {
    const info = type === "exam" ? access?.examAccess : access?.trainingAccess
    const label = ACCESS_LABEL[type]
    if (
      info &&
      getAccessStatus(info.expiresAt, info.daysRemaining) === "expiring"
    ) {
      const days = info.daysRemaining
      alerts.push(
        <DashboardAlert
          key={`expiring-${type}`}
          tone="warning"
          icon={Clock}
          title={`Votre accès ${label} expire dans ${days} jour${days > 1 ? "s" : ""}`}
          action={<AlertLink href="/tarifs">Prolonger</AlertLink>}
        >
          Il prend fin le {formatExpiration(info.expiresAt)}. Si vous prolongez
          avec une formule {label} avant cette date, le temps restant
          s&apos;ajoute à la nouvelle période.
        </DashboardAlert>,
      )
    }
    const lapsedAt = lapsed[type]
    if (!info && lapsedAt !== null) {
      alerts.push(
        <DashboardAlert
          key={`expired-${type}`}
          tone="danger"
          icon={CircleAlert}
          title={`Votre accès ${label} a expiré le ${formatExpiration(lapsedAt)}`}
          action={<AlertLink href="/tarifs">Réactiver</AlertLink>}
        >
          Vos résultats et votre progression restent consultables.{" "}
          {EXPIRED_NEXT_STEP[type]}
        </DashboardAlert>,
      )
    }
  }

  return alerts
}
