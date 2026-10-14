"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import {
  ACCESS_STATUS,
  ACCESS_TYPE_LABEL,
  daysLeftLabel,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"
import { ACCESS_HREF } from "@/constants"
import type { AccessType } from "@/features/payments/access-ledger"
import type { MyAccess } from "@/features/payments/dal"
import { formatDayMonth } from "@/lib/format"
import { TONE_COLOR, TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"

const ORDER: AccessType[] = ["exam", "training"]

/**
 * État des deux accès au bas du menu étudiant. Tout se dérive des props du
 * layout (`getMyAccess`), jamais de l'horloge : le statut vient de
 * `daysRemaining` (`getAccessStatus`), la date d'un accès expiré est ancrée
 * sur l'heure de l'Est.
 */
export const ShellAccessLines = ({
  access,
  onReselect,
}: {
  access: MyAccess
  /** Clic depuis la page Abonnements elle-même : aucune navigation ne suivra. */
  onReselect?: () => void
}) => {
  const onAccessPage = usePathname() === ACCESS_HREF
  return (
    <ul aria-label="Vos accès" className="flex flex-col gap-0.5">
      {ORDER.map((type) => {
        const info = access[type]
        const status = getAccessStatus(info?.expiresAt, info?.daysRemaining)
        const { tone } = ACCESS_STATUS[status]
        let state = "Non actif"
        if (info && status === "expired")
          state = `Expiré le ${formatDayMonth(info.expiresAt)}`
        else if (info && status !== "none")
          state = daysLeftLabel(info.daysRemaining)

        return (
          <li key={type}>
            {/* Sans prefetch, comme toute la coquille : `.claude/rules/loading-ui.md`. */}
            <Link
              href={ACCESS_HREF}
              prefetch={false}
              onClick={onAccessPage ? onReselect : undefined}
              className="focus-ring text-ink-2 hover:bg-surface-2 hover:text-ink flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-(--duration-base) max-lg:h-11"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-xs"
                style={{ backgroundColor: TONE_COLOR[tone] }}
              />
              <span className="flex-1 truncate">{ACCESS_TYPE_LABEL[type]}</span>
              <span
                data-testid="access-state"
                data-tone={tone}
                className={cn(
                  "font-mono text-xs whitespace-nowrap",
                  TONE_TEXT[tone],
                )}
              >
                {state}
              </span>
              <LinkPendingIndicator />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
