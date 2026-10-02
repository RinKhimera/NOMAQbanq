"use client"

import { Shuffle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"
import type { Counter } from "./composer-model"

const INDICATOR: Record<Counter["tone"], string> = {
  danger: TONE_COLOR.danger,
  success: TONE_COLOR.success,
  accent: TONE_COLOR.info,
}

type CounterProps = {
  count: number
  target: number
  counter: Counter
  frozen: boolean
  doneHref: string
  onComplete: () => void
  /** Tirage en cours : spinner dans « Compléter ». */
  drawing: boolean
  /** Une écriture est en cours : pas de tirage en parallèle. */
  busy: boolean
}

const Tally = ({
  count,
  target,
  over,
  className,
}: {
  count: number
  target: number
  over: boolean
  className?: string
}) => (
  <span
    data-testid="composer-count"
    className={cn(
      "font-mono font-semibold",
      over ? "text-danger-ink" : "text-ink",
      className,
    )}
  >
    {count} / {target}
  </span>
)

/**
 * Compteur du jeu : barre collante dès 1024 px ; en dessous, la barre reste
 * dans le flux sans ses actions, reprises par une barre basse fixe.
 */
export const ComposerCounter = ({
  count,
  target,
  counter,
  frozen,
  doneHref,
  onComplete,
  drawing,
  busy,
}: CounterProps) => {
  const { need, over, tone, message } = counter
  const completeDisabled = need === 0 || drawing || busy
  return (
    <>
      <div
        data-testid="composer-counter"
        className="bg-surface border-line z-30 flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-lg border px-4 py-3 lg:sticky lg:top-[calc(var(--shell-offset,0px)+0.5rem)]"
      >
        <div className="text-ink-2 flex min-w-45 flex-col gap-1.5 text-sm">
          <span>
            <Tally
              count={count}
              target={target}
              over={over > 0}
              className="text-lg"
            />{" "}
            questions
          </span>
          <Progress
            value={target > 0 ? Math.min(100, (count / target) * 100) : 0}
            indicatorColor={INDICATOR[tone]}
            aria-label={`${count} questions sur ${target}`}
            className="h-1"
          />
        </div>
        <p
          className="text-ink-2 flex-[1_1_200px] text-[0.8125rem]"
          data-testid="composer-counter-message"
        >
          {message}
        </p>
        <div className="flex flex-wrap gap-2 max-lg:hidden">
          {!frozen && (
            <Button
              type="button"
              variant="outline"
              disabled={completeDisabled}
              onClick={onComplete}
              data-testid="btn-composer-complete"
            >
              {drawing ? <Spinner size="sm" /> : <Shuffle aria-hidden />}
              {need ? `Compléter les ${need} restantes` : "Compléter"}
            </Button>
          )}
          <Button asChild>
            <Link href={doneHref} data-testid="btn-composer-done">
              Terminé
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-surface border-line-strong fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden">
        <Tally count={count} target={target} over={over > 0} />
        {!frozen ? (
          <Button
            type="button"
            variant="outline"
            disabled={completeDisabled}
            onClick={onComplete}
            className="h-11 flex-1"
            data-testid="btn-composer-complete-mobile"
          >
            {drawing ? <Spinner size="sm" /> : <Shuffle aria-hidden />}
            {need ? `Compléter les ${need}` : "Complet"}
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        <Button asChild className="h-11">
          <Link href={doneHref}>Terminé</Link>
        </Button>
      </div>
    </>
  )
}
