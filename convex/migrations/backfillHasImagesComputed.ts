import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalMutation } from "../_generated/server"
import { startMigrationRow, updateMigrationProgress } from "./runner"

/**
 * Migration M3 — Backfill du champ `hasImagesComputed` dans la table `questions`.
 *
 * Alimente le filterField du searchIndex `search_question` pour permettre
 * à `getQuestionsWithFilters` de filtrer "avec/sans images" sans scanner
 * la table entière.
 *
 * **Idempotent** : les questions dont `hasImagesComputed` est déjà défini
 * (!== undefined) sont skippées. Une re-run ne ré-écrit rien inutilement.
 *
 * **Resumable** : self-scheduling via `ctx.scheduler.runAfter`.
 *
 * Dashboard : Functions → migrations/backfillHasImagesComputed → backfillHasImagesComputed
 *   Args (optionnels) : { "batchSize": 100 }
 *
 * Status check (dashboard) :
 *   Functions → migrations/runner → getMigrationStatus
 *   Args: { "name": "backfillHasImagesComputed" }
 */

const MIGRATION_NAME = "backfillHasImagesComputed"
const DEFAULT_BATCH_SIZE = 100

export const backfillHasImagesComputed = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    skipped: v.number(),
    isDone: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE
    const isFirstBatch = args.cursor === undefined

    if (isFirstBatch) {
      await startMigrationRow(ctx, MIGRATION_NAME)
    }

    const result = await ctx.db
      .query("questions")
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null })

    let processed = 0
    let skipped = 0

    for (const question of result.page) {
      // Idempotence : skip si déjà calculé
      if (question.hasImagesComputed !== undefined) {
        skipped++
        continue
      }

      const hasImages = !!(question.images && question.images.length > 0)
      await ctx.db.patch(question._id, { hasImagesComputed: hasImages })
      processed++
    }

    await updateMigrationProgress(ctx, MIGRATION_NAME, {
      processedDelta: processed,
      cursor: result.isDone ? undefined : result.continueCursor,
      isDone: result.isDone,
    })

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillHasImagesComputed.backfillHasImagesComputed,
        {
          cursor: result.continueCursor,
          batchSize,
        },
      )
    }

    console.log(
      `[backfillHasImagesComputed] batch terminé : ${processed} mis à jour, ${skipped} d\u00e9j\u00e0 calcul\u00e9s, isDone=${result.isDone}`,
    )

    return {
      processed,
      skipped,
      isDone: result.isDone,
      nextCursor: result.isDone ? undefined : result.continueCursor,
    }
  },
})
