import { and, eq, isNull, sql } from "drizzle-orm"
import "server-only"
import { examParticipations, user } from "@/db/schema"

/** Participation soumise, en SQL (forme de `isSubmitted`). */
export const SUBMITTED = sql`${examParticipations.status} in ('completed', 'auto_submitted')`

/**
 * Compte admis dans la population d'un examen (`CONTEXT.md`) : un étudiant,
 * hors comptes admin et supprimés. Suppose une jointure sur `user`.
 */
export const populationAccount = and(
  eq(user.role, "user"),
  isNull(user.deletedAt),
)

/**
 * Participations que comptent le classement d'examen et le percentile, pour
 * que « Rang X sur N » et « mieux que Y % » portent sur les mêmes candidats.
 * Un score retenu en sort aussi, au calcul (`ownerReadableScore` nul).
 */
export const examPopulation = and(SUBMITTED, populationAccount)
