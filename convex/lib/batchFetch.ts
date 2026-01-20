import { QueryCtx } from "../_generated/server"
import { Id, TableNames, Doc } from "../_generated/dataModel"

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
