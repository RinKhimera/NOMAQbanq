import { ArrowLeft, ArrowRight, ChevronRight, User } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Button } from "@/components/ui/button"
import type { StudentProgressNeighbors } from "@/features/analytics/dal.admin-progression"
import { pageOfPosition } from "@/lib/admin-progression"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import {
  type ProgressionListState,
  progressionListHref,
  studentProgressHref,
} from "../../_components/progression-params"

const NeighborLink = ({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: ReactNode
}) =>
  href ? (
    <Button
      asChild
      size="sm"
      variant="ghost"
      aria-label={label}
      className={TOUCH_HEIGHT}
    >
      <Link href={href} prefetch={false}>
        {children}
        <LinkPendingIndicator />
      </Link>
    </Button>
  ) : (
    <Button
      size="sm"
      variant="ghost"
      disabled
      aria-label={label}
      className={TOUCH_HEIGHT}
    >
      {children}
    </Button>
  )

/**
 * Fil d'Ariane et navigation du détail : étudiant précédent / suivant dans
 * le tableau d'où l'on vient (à travers les pages), retour au tableau, fiche.
 * Ouvert hors du tableau, ou absent du tableau filtré : « Hors de la liste
 * filtrée », sans flèches.
 */
export const StudentProgressNav = ({
  name,
  list,
  neighbors,
  listHref,
  ficheHref,
}: {
  name: string
  list: ProgressionListState
  neighbors: StudentProgressNeighbors | null
  listHref: string
  /** Absent : la page porte elle-même le lien vers la fiche (état vide). */
  ficheHref?: string
}) => {
  const target = (id: string | null, position: number) =>
    id
      ? studentProgressHref(id, { ...list, page: pageOfPosition(position) })
      : null

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href={progressionListHref({ ...list, page: 1 })}
              prefetch={false}
              className="focus-ring hover:text-ink rounded-xs"
            >
              Progression
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <li aria-current="page" className="text-ink">
            {name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {neighbors ? (
          <nav
            aria-label="Étudiant précédent ou suivant"
            className="flex flex-wrap items-center gap-1"
          >
            <NeighborLink
              href={target(neighbors.previousId, neighbors.position - 1)}
              label="Étudiant précédent"
            >
              <ArrowLeft aria-hidden="true" />
              Étudiant précédent
            </NeighborLink>
            <NeighborLink
              href={target(neighbors.nextId, neighbors.position + 1)}
              label="Étudiant suivant"
            >
              Étudiant suivant
              <ArrowRight aria-hidden="true" />
            </NeighborLink>
            <span
              className="text-ink-3 font-mono text-xs whitespace-nowrap"
              data-testid="student-position"
            >
              {neighbors.position.toLocaleString("fr-CA")} sur{" "}
              {neighbors.total.toLocaleString("fr-CA")}
            </span>
          </nav>
        ) : (
          <span
            className="text-ink-3 text-[0.8125rem]"
            data-testid="student-position"
          >
            Hors de la liste filtrée
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="ghost" className={TOUCH_HEIGHT}>
            <Link href={listHref} prefetch={false}>
              Retour à la liste
              <LinkPendingIndicator />
            </Link>
          </Button>
          {ficheHref && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className={TOUCH_HEIGHT}
            >
              <Link href={ficheHref}>
                <User aria-hidden="true" />
                Voir la fiche
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
