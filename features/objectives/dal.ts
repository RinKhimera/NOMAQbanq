import { and, asc, count, eq, isNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { cmcObjectives, questions } from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"

export type ObjectiveOption = { id: string; label: string }

export type ObjectiveOptions = {
  /** Le référentiel, entrées à corriger exclues, trié en français. */
  objectives: ObjectiveOption[]
  /** Identifiants des objectifs qu'utilise au moins une question active du domaine. */
  byDomain: Record<string, string[]>
}

const MAX_OBJECTIVES = 5000

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, "fr")

/**
 * [Admin] Objectifs proposables (formulaire de question, filtre de la liste) :
 * tout le référentiel hors entrées à corriger, et ceux de chaque domaine.
 */
export const getObjectiveOptions = cache(
  async (): Promise<ObjectiveOptions> => {
    await requireRole(["admin"])
    const [objectives, pairs] = await Promise.all([
      db
        .select({ id: cmcObjectives.id, label: cmcObjectives.label })
        .from(cmcObjectives)
        .where(eq(cmcObjectives.needsFix, false))
        .limit(MAX_OBJECTIVES),
      db
        .selectDistinct({
          domain: questions.domain,
          objectiveId: questions.objectiveId,
        })
        .from(questions)
        .innerJoin(cmcObjectives, eq(cmcObjectives.id, questions.objectiveId))
        .where(
          and(isNull(questions.deletedAt), eq(cmcObjectives.needsFix, false)),
        )
        .limit(MAX_OBJECTIVES),
    ])
    const labels = new Map(objectives.map((o) => [o.id, o.label]))
    const byDomain: Record<string, string[]> = {}
    for (const p of pairs) (byDomain[p.domain] ??= []).push(p.objectiveId)
    for (const ids of Object.values(byDomain))
      ids.sort((a, b) =>
        (labels.get(a) ?? "").localeCompare(labels.get(b) ?? "", "fr"),
      )
    return { objectives: objectives.sort(byLabel), byDomain }
  },
)

export type ObjectiveEntry = {
  id: string
  label: string
  needsFix: boolean
  /** Epoch ms ; `null` = pas encore revue. */
  reviewedAt: number | null
  /** Questions actives qui l'utilisent. */
  questionCount: number
  /** Domaines de ces questions, triés. */
  domains: string[]
}

/** [Admin] Tout le référentiel, avec l'usage de chaque entrée par les questions actives. */
export const getObjectiveEntries = cache(
  async (): Promise<ObjectiveEntry[]> => {
    await requireRole(["admin"])
    const rows = await db
      .select({
        id: cmcObjectives.id,
        label: cmcObjectives.label,
        needsFix: cmcObjectives.needsFix,
        reviewedAt: cmcObjectives.reviewedAt,
        questionCount: count(questions.id),
        domains: sql<
          string[] | null
        >`array_agg(distinct ${questions.domain} order by ${questions.domain}) filter (where ${questions.id} is not null)`,
      })
      .from(cmcObjectives)
      .leftJoin(
        questions,
        and(
          eq(questions.objectiveId, cmcObjectives.id),
          isNull(questions.deletedAt),
        ),
      )
      .groupBy(cmcObjectives.id)
      .orderBy(asc(cmcObjectives.label))
      .limit(MAX_OBJECTIVES)
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      needsFix: r.needsFix,
      reviewedAt: r.reviewedAt?.getTime() ?? null,
      questionCount: r.questionCount,
      domains: r.domains ?? [],
    }))
  },
)

export type ObjectiveQuestion = { id: string; question: string; domain: string }

/** [Admin] Questions actives d'un objectif (correction d'une valeur invalide). */
export const getObjectiveQuestions = async (
  objectiveId: string,
): Promise<ObjectiveQuestion[]> => {
  await requireRole(["admin"])
  return db
    .select({
      id: questions.id,
      question: questions.question,
      domain: questions.domain,
    })
    .from(questions)
    .where(
      and(eq(questions.objectiveId, objectiveId), isNull(questions.deletedAt)),
    )
    .orderBy(asc(questions.domain), asc(questions.createdAt), asc(questions.id))
    .limit(500)
}

/**
 * [Public] Objectifs de chaque domaine pour la vitrine : ceux des questions
 * actives, entrées à corriger exclues, du plus utilisé au moins utilisé. Sans
 * garde : lu à travers le cache de `features/marketing/cached.ts`.
 */
export const getPublicDomainObjectives = async (): Promise<
  Record<string, string[]>
> => {
  const rows = await db
    .select({
      domain: questions.domain,
      label: cmcObjectives.label,
      n: count(questions.id),
    })
    .from(questions)
    .innerJoin(cmcObjectives, eq(cmcObjectives.id, questions.objectiveId))
    .where(and(isNull(questions.deletedAt), eq(cmcObjectives.needsFix, false)))
    .groupBy(questions.domain, cmcObjectives.label)
    .limit(MAX_OBJECTIVES)
  const byDomain: Record<string, { label: string; n: number }[]> = {}
  for (const r of rows) (byDomain[r.domain] ??= []).push(r)
  return Object.fromEntries(
    Object.entries(byDomain).map(([domain, list]) => [
      domain,
      list
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "fr"))
        .map((o) => o.label),
    ]),
  )
}
