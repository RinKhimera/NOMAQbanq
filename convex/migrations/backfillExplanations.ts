import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalMutation } from "../_generated/server"
import {
  startMigrationRow,
  updateMigrationProgress,
} from "./runner"

/**
 * Migration M1 — Backfill de la table `questionExplanations`.
 *
 * Pour chaque question existante de la table `questions`, crée une ligne
 * correspondante dans `questionExplanations` contenant `explanation` et
 * `references`. Idempotent : les questions déjà migrées sont skippées.
 *
 * Caractéristiques de sûreté :
 * - **Anti-duplication** : vérifie l'existence via `by_question` AVANT chaque
 *   insert. Une exécution répétée ne crée jamais de doublon.
 * - **Anti-omission** : pagination complète via `paginate()` — couvre toute
 *   la table. Les nouvelles questions créées pendant le backfill sont déjà
 *   migrées par construction grâce au dual-write actif dans `createQuestion`.
 * - **Resumable** : self-scheduled via `ctx.scheduler.runAfter`. Si un batch
 *   échoue, l'état du cursor est dans la table `migrations` et on peut
 *   reprendre proprement.
 * - **Tracking** : la progression est persistée dans la table `migrations`
 *   et consultable via `migrations/runner:getMigrationStatus`.
 *
 * Exécution recommandée — via le dashboard Convex :
 *   1. Sélectionner explicitement le déploiement cible (dev d'abord, prod ensuite)
 *   2. Onglet Functions → migrations/backfillExplanations → backfillExplanations
 *   3. Lancer sans arguments (les valeurs par défaut conviennent)
 *   Le worker se reschedule automatiquement jusqu'à `isDone: true`.
 *
 * Status check (dashboard) :
 *   Functions → migrations/runner → getMigrationStatus
 *   Args: { "name": "backfillExplanations" }
 *
 * Reset pour re-run forcée (dashboard) :
 *   Functions → migrations/runner → resetMigration
 *   Args: { "name": "backfillExplanations" }
 *
 * Alternative CLI (si tu sais ce que tu fais et quel deployment est actif) :
 *   npx convex run migrations/backfillExplanations:backfillExplanations
 */

const MIGRATION_NAME = "backfillExplanations"
const DEFAULT_BATCH_SIZE = 100

export const backfillExplanations = internalMutation({
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

    // Au premier batch : initialiser/réinitialiser la ligne de tracking
    if (isFirstBatch) {
      await startMigrationRow(ctx, MIGRATION_NAME)
    }

    // Récupérer un batch via pagination Convex native
    const result = await ctx.db
      .query("questions")
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null })

    let processed = 0
    let skipped = 0

    for (const question of result.page) {
      // Idempotence : skip si la ligne questionExplanations existe déjà
      const existing = await ctx.db
        .query("questionExplanations")
        .withIndex("by_question", (q) => q.eq("questionId", question._id))
        .unique()

      if (existing) {
        skipped++
        continue
      }

      await ctx.db.insert("questionExplanations", {
        questionId: question._id,
        explanation: question.explanation,
        references: question.references,
      })
      processed++
    }

    // Mettre à jour le tracking
    await updateMigrationProgress(ctx, MIGRATION_NAME, {
      processedDelta: processed,
      cursor: result.isDone ? undefined : result.continueCursor,
      isDone: result.isDone,
    })

    // Auto-schedule le batch suivant si pas fini
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillExplanations.backfillExplanations,
        {
          cursor: result.continueCursor,
          batchSize,
        },
      )
    }

    console.log(
      `[backfillExplanations] batch terminé : ${processed} créés, ${skipped} déjà migrés, isDone=${result.isDone}`,
    )

    return {
      processed,
      skipped,
      isDone: result.isDone,
      nextCursor: result.isDone ? undefined : result.continueCursor,
    }
  },
})
