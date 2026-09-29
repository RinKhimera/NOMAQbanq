"use client"

import { Pause, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { TimeZone } from "@/lib/attempt-clock"
import { TONE_SOFT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import type { SessionHeaderProps } from "./types"

const TIMER: Record<TimeZone, string> = {
  normal: "border-line-strong text-ink",
  warning: TONE_SOFT.warning,
  critical: cn(TONE_SOFT.danger, "border-danger"),
}

/**
 * Barre de passation : titre, « Question 12 / 50 », progression, chrono à
 * paliers, pause et fin. Elle s'adapte à SA largeur (requêtes de conteneur) :
 * dans la coquille, la SideNav lui retire 264 px.
 */
export const SessionHeader = ({
  title,
  kind,
  modeLabel,
  currentIndex,
  totalQuestions,
  answeredCount,
  timer,
  onPause,
  onFinish,
  sticky = true,
  titleAs: Title = "h1",
}: SessionHeaderProps) => (
  <header
    className={cn(
      "bg-surface border-line text-ink @container border-b",
      sticky && "sticky top-(--shell-offset,0px) z-10",
    )}
  >
    <div className="flex h-14 items-center gap-2.5 px-3 @min-[680px]:gap-5 @min-[680px]:px-5">
      <div className="flex min-w-0 flex-[0_1_auto] items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-[1px]",
            kind === "training" ? "bg-success" : "bg-accent",
          )}
        />
        <Title className="truncate text-[15px] font-semibold">{title}</Title>
        {modeLabel && (
          <span className="text-ink-3 hidden font-mono text-xs whitespace-nowrap @min-[880px]:inline">
            {modeLabel}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-4">
        <span className="text-ink-2 font-mono text-[13px] whitespace-nowrap tabular-nums">
          <span className="hidden @min-[680px]:inline">Question </span>
          {currentIndex + 1} / {totalQuestions}
        </span>
        <div className="hidden max-w-45 min-w-15 flex-[0_1_180px] items-center gap-2.5 @min-[680px]:flex">
          <Progress
            value={(answeredCount / totalQuestions) * 100}
            aria-label="Questions répondues"
            className={cn(
              "h-1.5",
              kind === "training" &&
                "*:data-[slot=progress-indicator]:bg-success",
            )}
          />
          <span className="text-ink-3 font-mono text-xs tabular-nums">
            {answeredCount}/{totalQuestions}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {timer && (
          <span
            role="timer"
            aria-label="Temps restant"
            data-zone={timer.zone}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md border px-2.5 font-mono text-[15px] font-medium whitespace-nowrap tabular-nums transition-[background-color,border-color] duration-(--duration-base)",
              TIMER[timer.zone],
            )}
          >
            <Timer aria-hidden className="size-3.75" />
            {timer.label}
          </span>
        )}
        {onPause && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPause}
            data-testid="btn-pause"
            aria-label="Mettre en pause l'examen"
            className="max-md:size-11 max-md:px-0"
          >
            <Pause aria-hidden className="size-3.5" />
            <span className="hidden @min-[680px]:inline">Pause</span>
          </Button>
        )}
        {onFinish && (
          <Button
            size="sm"
            onClick={onFinish}
            data-testid="btn-header-finish"
            className="max-md:h-11"
          >
            Terminer
          </Button>
        )}
      </div>
    </div>
  </header>
)
