import { Doc, Id, TableNames } from "../_generated/dataModel"
import { QueryCtx } from "../_generated/server"

/**
 * Batch fetch documents by IDs with deduplication and Map result
 *
 * Benefits over individual ctx.db.get() calls:
 * - Deduplicates IDs (same entity referenced multiple times = 1 fetch)
 * - Returns Map for O(1) lookups
 * - Cleaner code organization
 *
 * @example
 * const userIds = participations.map(p => p.userId)
 * const userMap = await batchGetByIds(ctx, "users", userIds)
 * const user = userMap.get(someUserId) // O(1) lookup
 */
export const batchGetByIds = async <T extends TableNames>(
  ctx: QueryCtx,
  _table: T,
  ids: Id<T>[],
): Promise<Map<Id<T>, Doc<T>>> => {
  // Deduplicate IDs
  const uniqueIds = [...new Set(ids)]

  // Fetch all in parallel
  const docs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)))

  // Build map (filter out nulls)
  const map = new Map<Id<T>, Doc<T>>()
  for (let i = 0; i < uniqueIds.length; i++) {
    const doc = docs[i]
    if (doc) {
      map.set(uniqueIds[i], doc)
    }
  }

  return map
}

/**
 * Batch fetch and return array (preserving order, nulls for missing)
 * Use when you need results in same order as input IDs
 *
 * @example
 * const questions = await batchGetOrderedByIds(ctx, "questions", questionIds)
 * // questions[i] corresponds to questionIds[i]
 */
export const batchGetOrderedByIds = async <T extends TableNames>(
  ctx: QueryCtx,
  _table: T,
  ids: Id<T>[],
): Promise<(Doc<T> | null)[]> => {
  // For ordered results, we fetch all (no deduplication to preserve indices)
  return Promise.all(ids.map((id) => ctx.db.get(id)))
}

/**
 * Batch fetch explanations by their `questionId` via the `by_question` index.
 * Returns a Map keyed by questionId for O(1) lookups.
 *
 * Uses parallel indexed lookups (no N+1) because each `.unique()` on the
 * `by_question` index is a single indexed read. Missing entries (questions
 * whose backfill hasn't run yet, or questions legitimately without an
 * explanation row) are simply absent from the Map — callers should default
 * to empty string / undefined.
 *
 * @example
 * const explanationsMap = await batchGetExplanationsByQuestionIds(ctx, questionIds)
 * const explanation = explanationsMap.get(someQuestionId)?.explanation ?? ""
 */
export const batchGetExplanationsByQuestionIds = async (
  ctx: QueryCtx,
  questionIds: Id<"questions">[],
): Promise<
  Map<
    Id<"questions">,
    { explanation: string; references: string[] | undefined }
  >
> => {
  // Deduplicate to avoid redundant lookups for the same question.
  const uniqueIds = [...new Set(questionIds)]

  const rows = await Promise.all(
    uniqueIds.map((questionId) =>
      ctx.db
        .query("questionExplanations")
        .withIndex("by_question", (q) => q.eq("questionId", questionId))
        .unique(),
    ),
  )

  const map = new Map<
    Id<"questions">,
    { explanation: string; references: string[] | undefined }
  >()
  for (let i = 0; i < uniqueIds.length; i++) {
    const row = rows[i]
    if (row) {
      map.set(uniqueIds[i], {
        explanation: row.explanation,
        references: row.references,
      })
    }
  }
  return map
}
