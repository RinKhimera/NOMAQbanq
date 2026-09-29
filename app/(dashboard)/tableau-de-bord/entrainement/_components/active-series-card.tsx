"use client"

import { ArrowRight, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { abandonTrainingSession } from "@/features/training/actions"
import type { ActiveTrainingSession } from "@/features/training/dal"
import { TRAINING_MODE_LABEL } from "@/features/training/schemas"
import { useClock } from "@/hooks/use-clock"
import { formatShortDuration } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

type ActiveSeriesCardProps = {
  session: NonNullable<ActiveTrainingSession>["session"]
  /** Horloge serveur du rendu : premier rendu identique au SSR, puis tick à la minute. */
  initialNow: number
  /** Expirée : plus de reprise possible, la carte le dit et propose de la retirer. */
  expired?: boolean
}

/**
 * Série en cours, au-dessus du formulaire (qui reste affiché) : progression,
 * âge, expiration, « Abandonner » et « Reprendre ».
 */
export const ActiveSeriesCard = ({
  session,
  initialNow,
  expired = false,
}: ActiveSeriesCardProps) => {
  const router = useRouter()
  const now = useClock(initialNow)
  const [abandonOpen, setAbandonOpen] = useState(false)

  const remainingMs = Math.max(0, session.expiresAt - now)
  const elapsedMs = Math.max(0, now - session.startedAt)
  const expiresSoon = remainingMs < TWO_HOURS_MS
  const answered = session.answeredCount
  const total = session.questionCount

  const abandon = async () => {
    const res = await callAction(() =>
      abandonTrainingSession({ sessionId: session.id }),
    )
    if (!res.success) {
      toast.error("Erreur", { description: res.error })
      return false
    }
    toast.success(expired ? "Série retirée" : "Série abandonnée")
    router.refresh()
  }

  return (
    <section
      data-testid="active-series-card"
      data-state={expired ? "expired" : "active"}
      aria-label={expired ? "Série expirée" : "Série en cours"}
      className="border-line-strong bg-surface flex flex-wrap items-center justify-between gap-4 rounded-lg border px-6 py-5 max-md:px-5"
    >
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
        <p
          className={cn(
            "type-label",
            expired ? "text-warning-ink" : "text-accent-ink",
          )}
        >
          {expired ? "Série expirée" : "Série en cours"}
        </p>
        <p className="text-ink text-base font-semibold">
          {session.domain ?? "Tous les domaines"} · mode{" "}
          {TRAINING_MODE_LABEL[session.mode].toLowerCase()}
        </p>
        <div className="flex max-w-95 items-center gap-3">
          <Progress
            value={total > 0 ? (answered / total) * 100 : 0}
            indicatorColor={TONE_COLOR.success}
            className="h-1.5 flex-1"
            aria-label="Questions répondues"
          />
          <span className="text-ink-2 font-mono text-sm whitespace-nowrap tabular-nums">
            {answered} / {total} répondues
          </span>
        </div>
        <p className="text-ink-3 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          <span>
            Commencée il y a{" "}
            <span className="font-mono">{formatShortDuration(elapsedMs)}</span>
          </span>
          {expired ? (
            <span className="text-warning-ink">
              Expirée : ses réponses ne comptent pas. Vous pouvez commencer une
              nouvelle série.
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                expiresSoon && "text-warning-ink",
              )}
            >
              {expiresSoon && <Clock aria-hidden className="size-3.5" />}
              Expire dans{" "}
              <span className="font-mono">
                {formatShortDuration(remainingMs)}
              </span>
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 max-[480px]:w-full max-[480px]:*:flex-1">
        {expired ? (
          <Button
            variant="outline"
            onClick={() => setAbandonOpen(true)}
            className="max-md:h-11"
          >
            Retirer
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={() => setAbandonOpen(true)}
              className="max-md:h-11"
            >
              Abandonner
            </Button>
            <Button asChild className="max-md:h-11">
              <Link href={`/tableau-de-bord/entrainement/${session.id}`}>
                Reprendre
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={abandonOpen}
        onOpenChange={setAbandonOpen}
        variant="destructive"
        title={expired ? "Retirer la série expirée ?" : "Abandonner la série ?"}
        description={
          expired
            ? "Elle disparaît de cette page. Ses réponses ne comptaient déjà plus."
            : "Votre progression sera perdue et vous pourrez commencer une nouvelle série."
        }
        confirmLabel={expired ? "Retirer" : "Abandonner la série"}
        pendingLabel={expired ? "Retrait…" : "Abandon…"}
        onConfirm={abandon}
      />
    </section>
  )
}
