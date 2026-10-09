"use client"

import { ArrowDown, ArrowUp, LocateFixed, User } from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Progress } from "@/components/ui/progress"
import type { ExamRankingRow } from "@/features/exams/dal"
import { formatScore, scoreTextClass, scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"

/** Au-delà, la ligne du lecteur sort facilement de l'écran : raccourci « Aller à ma position ». */
const JUMP_FROM = 12
const FLASH_MS = 1600
const ANONYMOUS = "Candidat anonyme"

/** Ligne du lecteur hors de l'écran : au-dessus ou en dessous. */
type Offscreen = "above" | "below" | null

const ROW_GRID =
  "grid grid-cols-[40px_minmax(0,1fr)_52px] items-center gap-2.5 py-2 pr-3 pl-2 md:grid-cols-[56px_minmax(0,1fr)_minmax(0,220px)] md:gap-4 md:px-5"

const RankingRow = ({
  row,
  flash = false,
  pinned,
}: {
  row: ExamRankingRow
  flash?: boolean
  pinned?: { side: "above" | "below"; onJump: () => void }
}) => {
  const name = row.username ?? ANONYMOUS
  return (
    <div
      data-testid={
        pinned
          ? "ranking-self-pinned"
          : row.isSelf
            ? "ranking-self"
            : "ranking-row"
      }
      className={cn(
        ROW_GRID,
        "min-h-13",
        pinned &&
          "grid-cols-[40px_minmax(0,1fr)_52px_44px] md:grid-cols-[56px_minmax(0,1fr)_minmax(0,220px)_32px]",
        row.isSelf && "bg-accent-soft ring-accent ring-1 ring-inset",
        flash && "ring-2",
        pinned && "shadow-pop",
      )}
    >
      {/* La copie épinglée ne se relit pas : seule sa flèche compte. */}
      <span
        aria-hidden={pinned ? true : undefined}
        className={cn(
          "pr-1 text-right font-mono text-sm tabular-nums md:pr-2",
          row.isSelf ? "text-accent-ink font-semibold" : "text-ink-2",
        )}
      >
        {row.rank}
      </span>
      <span
        aria-hidden={pinned ? true : undefined}
        className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 md:flex-nowrap md:gap-3"
      >
        {row.username ? (
          <UserAvatar
            name={row.username}
            image={row.image}
            className="size-8"
          />
        ) : (
          <span
            aria-hidden
            className="bg-surface-2 text-ink-3 ring-line-strong grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset"
          >
            <User className="size-4" />
          </span>
        )}
        <span
          className={cn(
            "text-ink min-w-0 text-[0.9375rem] leading-tight wrap-anywhere md:truncate",
            !row.username && "text-ink-3 italic",
            row.isSelf && "font-semibold",
          )}
        >
          {name}
        </span>
        {row.isSelf && <Badge variant="accent">Vous</Badge>}
      </span>
      <span
        aria-hidden={pinned ? true : undefined}
        className="grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_48px]"
      >
        <Progress
          value={row.score}
          indicatorColor={TONE_COLOR[scoreTone(row.score)]}
          className="h-1.5 max-md:hidden"
          aria-hidden
        />
        <span
          className={cn(
            "text-right font-mono text-sm tabular-nums",
            scoreTextClass(row.score),
          )}
        >
          {formatScore(row.score)}
        </span>
      </span>
      {pinned && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={TOUCH_TARGET}
          aria-label="Aller à ma position"
          onClick={pinned.onJump}
        >
          {pinned.side === "above" ? (
            <ArrowUp aria-hidden />
          ) : (
            <ArrowDown aria-hidden />
          )}
        </Button>
      )}
    </div>
  )
}

/**
 * Liste du classement. La ligne du lecteur, hors de l'écran, s'épingle en
 * haut ou en bas de la liste avec une flèche pour y revenir.
 */
export const RankingBoard = ({
  rows,
  total,
}: {
  rows: ExamRankingRow[]
  total: number
}) => {
  const self = rows.find((r) => r.isSelf)
  const selfRef = useRef<HTMLLIElement>(null)
  const [offscreen, setOffscreen] = useState<Offscreen>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const el = selfRef.current
    if (!el) return
    const top =
      Number.parseFloat(
        getComputedStyle(el).getPropertyValue("--shell-offset"),
      ) * 16 || 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setOffscreen(null)
        else
          setOffscreen(
            entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)
              ? "above"
              : "below",
          )
      },
      { rootMargin: `-${top}px 0px 0px 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(false), FLASH_MS)
    return () => clearTimeout(id)
  }, [flash])

  const jump = () => {
    selfRef.current?.scrollIntoView({ block: "center" })
    selfRef.current?.focus({ preventScroll: true })
    setFlash(true)
  }

  return (
    <section
      aria-labelledby="ranking-title"
      className="border-line bg-surface rounded-lg border"
    >
      <div className="flex min-h-15 items-center justify-between gap-3 py-3 pr-3 pl-4 md:pr-4 md:pl-5">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id="ranking-title" className="type-h4 text-ink">
            Classement
          </h2>
          <span className="text-ink-3 font-mono text-[0.8125rem] tabular-nums">
            {total.toLocaleString("fr-CA")}
          </span>
        </div>
        {self && rows.length > JUMP_FROM && (
          <Button
            size="sm"
            variant="ghost"
            className={TOUCH_TARGET}
            onClick={jump}
          >
            <LocateFixed aria-hidden />
            Aller à ma position
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          size="compact"
          title="Aucun participant classé pour le moment"
          description="Aucune participation terminée n'est encore classée pour cet examen."
        />
      ) : (
        <>
          <div
            aria-hidden
            className={cn(ROW_GRID, "bg-surface-2 border-line border-t")}
          >
            <span className="type-label pr-1 text-right md:pr-2">Rang</span>
            <span className="type-label">Participant</span>
            <span className="type-label text-right">Score</span>
          </div>
          {/* Hauteur nulle : la copie épinglée ne décale pas la liste, sinon
              la ligne du lecteur rentrerait dans l'écran et la copie
              disparaîtrait aussitôt. */}
          {self && offscreen === "above" && (
            <div className="sticky top-(--shell-offset) z-5 h-0">
              <div className="bg-surface absolute inset-x-0 top-0">
                <RankingRow
                  row={self}
                  pinned={{ side: "above", onJump: jump }}
                />
              </div>
            </div>
          )}
          <ol aria-label="Classement des participants">
            {rows.map((row, i) => (
              <Fragment key={row.rank}>
                {i > 0 && row.rank > rows[i - 1].rank + 1 && (
                  <li
                    data-testid="ranking-gap"
                    aria-label={`Rangs ${rows[i - 1].rank + 1} à ${row.rank - 1} non affichés`}
                    className="border-line text-ink-3 border-t py-1.5 text-center font-mono text-sm"
                  >
                    …
                  </li>
                )}
                <li
                  ref={row.isSelf ? selfRef : undefined}
                  tabIndex={row.isSelf ? -1 : undefined}
                  className="border-line border-t outline-none [contain-intrinsic-size:auto_52px] [content-visibility:auto] last:rounded-b-lg"
                >
                  <RankingRow row={row} flash={flash && row.isSelf} />
                </li>
              </Fragment>
            ))}
          </ol>
          {self && offscreen === "below" && (
            <div className="sticky bottom-0 z-5 h-0">
              <div className="bg-surface absolute inset-x-0 bottom-0 rounded-b-lg">
                <RankingRow
                  row={self}
                  pinned={{ side: "below", onJump: jump }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
