import { Id } from "../_generated/dataModel"
import { MutationCtx } from "../_generated/server"

/**
 * Incrémente le compteur de participations pour un examen.
 * Crée l'entrée si elle n'existe pas (upsert).
 */
export async function incrementExamParticipationCount(
  ctx: MutationCtx,
  examId: Id<"exams">,
) {
  const stat = await ctx.db
    .query("examParticipationStats")
    .withIndex("by_examId", (q) => q.eq("examId", examId))
    .unique()

  if (stat) {
    await ctx.db.patch(stat._id, { count: stat.count + 1 })
  } else {
    await ctx.db.insert("examParticipationStats", { examId, count: 1 })
  }
}

/**
 * Décrémente le compteur de participations pour un examen.
 * Supprime l'entrée si le compteur atteint 0.
 */
export async function decrementExamParticipationCount(
  ctx: MutationCtx,
  examId: Id<"exams">,
) {
  const stat = await ctx.db
    .query("examParticipationStats")
    .withIndex("by_examId", (q) => q.eq("examId", examId))
    .unique()

  if (stat && stat.count > 1) {
    await ctx.db.patch(stat._id, { count: stat.count - 1 })
  } else if (stat) {
    await ctx.db.delete(stat._id)
  }
}

/**
 * Supprime l'entrée de stats pour un examen (cascade delete).
 */
export async function deleteExamParticipationStats(
  ctx: MutationCtx,
  examId: Id<"exams">,
) {
  const stat = await ctx.db
    .query("examParticipationStats")
    .withIndex("by_examId", (q) => q.eq("examId", examId))
    .unique()

  if (stat) {
    await ctx.db.delete(stat._id)
  }
}
