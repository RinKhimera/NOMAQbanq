import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import type { MutationCtx } from "../_generated/server"

/**
 * Generic migration runner — used by paginated, multi-batch internal
 * migrations to track progress in the `migrations` table.
 *
 * Pattern d'utilisation depuis une internalMutation paginée :
 *
 * ```ts
 * await startMigrationRow(ctx, "myMigration") // au premier batch
 * // ... traitement du batch ...
 * await updateMigrationProgress(ctx, "myMigration", {
 *   processedDelta: processed,
 *   cursor: result.continueCursor,
 *   isDone: result.isDone,
 * })
 * ```
 *
 * Statut consultable via le dashboard Convex :
 *   Functions → migrations/runner → getMigrationStatus
 *   Args: { "name": "myMigration" }
 *
 * (Alternative CLI : npx convex run migrations/runner:getMigrationStatus '{"name":"myMigration"}')
 */

// ============================================================
// Helpers (importables depuis d'autres fichiers de migration)
// ============================================================

/**
 * Crée ou réinitialise la ligne de tracking d'une migration.
 * Idempotent : si la ligne existe déjà, elle est remise à zéro pour
 * permettre une re-run propre.
 *
 * À appeler UNIQUEMENT au premier batch (cursor undefined).
 */
export const startMigrationRow = async (ctx: MutationCtx, name: string) => {
  const existing = await ctx.db
    .query("migrations")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique()

  const now = Date.now()

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "running",
      cursor: undefined,
      processedCount: 0,
      startedAt: now,
      completedAt: undefined,
      error: undefined,
    })
    return existing._id
  }

  return await ctx.db.insert("migrations", {
    name,
    status: "running",
    processedCount: 0,
    startedAt: now,
  })
}

/**
 * Met à jour la progression d'une migration en cours.
 * Marque automatiquement comme `completed` quand `isDone` est true.
 */
export const updateMigrationProgress = async (
  ctx: MutationCtx,
  name: string,
  args: {
    processedDelta: number
    cursor?: string
    isDone: boolean
  },
) => {
  const existing = await ctx.db
    .query("migrations")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique()

  if (!existing) {
    // Defensive : si la ligne n'existe pas (oubli de startMigrationRow),
    // on la crée à la volée pour ne pas perdre le tracking.
    await ctx.db.insert("migrations", {
      name,
      status: args.isDone ? "completed" : "running",
      cursor: args.cursor,
      processedCount: args.processedDelta,
      startedAt: Date.now(),
      ...(args.isDone && { completedAt: Date.now() }),
    })
    return
  }

  await ctx.db.patch(existing._id, {
    cursor: args.cursor,
    processedCount: existing.processedCount + args.processedDelta,
    ...(args.isDone && {
      status: "completed" as const,
      completedAt: Date.now(),
    }),
  })
}

/**
 * Marque une migration comme failed avec un message d'erreur.
 * À utiliser dans un try/catch englobant le worker.
 */
export const failMigrationRow = async (
  ctx: MutationCtx,
  name: string,
  error: string,
) => {
  const existing = await ctx.db
    .query("migrations")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique()

  if (!existing) return

  await ctx.db.patch(existing._id, {
    status: "failed",
    error,
    completedAt: Date.now(),
  })
}

// ============================================================
// Convex functions (callables depuis CLI / dashboard)
// ============================================================

/**
 * Récupérer l'état d'une migration (générique, fonctionne pour n'importe
 * quel nom de migration).
 *
 * Dashboard : Functions → migrations/runner → getMigrationStatus
 *   Args: { "name": "backfillExplanations" }
 */
export const getMigrationStatus = internalQuery({
  args: { name: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("migrations"),
      _creationTime: v.number(),
      name: v.string(),
      status: v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      cursor: v.optional(v.string()),
      processedCount: v.number(),
      totalCount: v.optional(v.number()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique()
  },
})

/**
 * Réinitialiser manuellement une ligne de migration (pour debug ou re-run forcée).
 *
 * Dashboard : Functions → migrations/runner → resetMigration
 *   Args: { "name": "backfillExplanations" }
 */
export const resetMigration = internalMutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})
