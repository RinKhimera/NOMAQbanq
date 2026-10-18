import { UserX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ProgressionEmpty,
  ProgressionView,
} from "@/app/(dashboard)/tableau-de-bord/progression/_components/progression-view"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  getStudentProgress,
  getStudentProgressNeighbors,
} from "@/features/analytics/dal.admin-progression"
import { adminUserHref } from "@/lib/admin-links"
import { pageOfPosition } from "@/lib/admin-progression"
import { requireRole } from "@/lib/auth-guards"
import { currentTimeMs } from "@/lib/clock"
import {
  AFTER_PARAM,
  BEFORE_PARAM,
  isProgressionEmpty,
} from "@/lib/progression"
import { userLabel } from "../../utilisateurs/_components/user-labels"
import {
  DEFAULT_PROGRESSION_LIST,
  FROM_LIST_PARAM,
  parseProgressionList,
  progressionListHref,
  toProgressFilters,
  toSearchParams,
} from "../_components/progression-params"
import { StudentProgressNav } from "./_components/student-progress-nav"

export const metadata: Metadata = { title: "Progression d'un étudiant" }

// La page porte l'état du tableau d'où l'on vient (filtres, tri, période,
// page) : voisins, retour et période conservée. La période s'y change en
// place, comme sur la page de l'étudiant.
export default async function AdminStudentProgressionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // IDOR : garde admin explicite avant de lire un identifiant arbitraire, en
  // plus du layout admin et des gardes internes de la DAL.
  await requireRole(["admin"])
  const { id } = await params
  const raw = toSearchParams(await searchParams)
  const list = parseProgressionList(raw)
  const fromList = raw.get(FROM_LIST_PARAM) === "1"

  const [progress, neighbors] = await Promise.all([
    getStudentProgress(
      id,
      list.period,
      raw.get(AFTER_PARAM),
      raw.get(BEFORE_PARAM),
    ),
    fromList
      ? getStudentProgressNeighbors(id, toProgressFilters(list))
      : Promise.resolve(null),
  ])

  // Retour sur la page du tableau qui contient l'étudiant ; hors du tableau,
  // sur sa première page, période conservée.
  const listHref = progressionListHref(
    neighbors
      ? { ...list, page: pageOfPosition(neighbors.position) }
      : fromList
        ? { ...list, page: 1 }
        : { ...DEFAULT_PROGRESSION_LIST, period: list.period },
  )

  if (!progress) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
          <Link href={listHref} className="hover:text-ink">
            Progression
          </Link>{" "}
          › <span className="text-ink">Introuvable</span>
        </nav>
        <EmptyState
          icons={[UserX]}
          title="Étudiant introuvable"
          description="Ce lien ne correspond à aucun étudiant. Le compte a peut-être été supprimé par l'étudiant : il est anonymisé après 30 jours et n'apparaît plus dans les listes."
        >
          <Button asChild variant="outline">
            <Link href={listHref}>Retour à la liste</Link>
          </Button>
        </EmptyState>
      </div>
    )
  }

  const { dashboard, progression, history, percentiles } = progress
  const student = {
    id,
    name: userLabel(progress.student.name),
    ficheHref: adminUserHref(id),
  }
  const empty = isProgressionEmpty({
    hasHistory: dashboard.hasHistory,
    domains: progression.domains,
  })

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <StudentProgressNav
        name={student.name}
        list={list}
        neighbors={neighbors}
        listHref={listHref}
        ficheHref={empty ? undefined : student.ficheHref}
      />
      {empty ? (
        <ProgressionEmpty
          trainingAccess={progression.trainingAccess}
          student={student}
        />
      ) : (
        <ProgressionView
          period={list.period}
          dashboard={dashboard}
          progression={progression}
          history={history}
          percentiles={percentiles}
          isAdmin={false}
          now={currentTimeMs()}
          student={student}
        />
      )}
    </div>
  )
}
